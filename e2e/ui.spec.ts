import { existsSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { CONTAINER_DOWNLOAD_DIR, createDaemonClient, seedPayload } from "../tests/support/daemon";
import { makeTorrent, randomMagnet, uniqueName, type PayloadFile } from "../tests/support/torrent";
import { daemonInfo } from "./env";

// The real UI, in Chromium, against the real daemon.

const daemon = daemonInfo();
const direct = createDaemonClient(daemon);

test.afterEach(async () => {
  // Start every test from an empty list.
  const { torrents } = await direct.call("torrent-get", { fields: ["id"] });
  if (torrents.length) {
    await direct.call("torrent-remove", {
      ids: torrents.map((t: { id: number }) => t.id),
      "delete-local-data": true,
    });
  }
});

function payload(...files: Array<[string, number]>): PayloadFile[] {
  return files.map(([p, size], i) => ({
    path: p,
    content: Buffer.from(Array.from({ length: size }, (_, j) => (i * 11 + j * 17) % 256)),
  }));
}

const row = (page: Page, name: string) => page.getByRole("row").filter({ hasText: name });
const navButton = (page: Page, icon: string) => page.locator(`nav button:has(svg.lucide-${icon})`);

async function rowAction(page: Page, name: string, action: string) {
  await row(page, name).getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
}

/** Adds a seeded .torrent through the Add dialog. */
async function addTorrentFile(page: Page, files: PayloadFile[], prefix = "ui") {
  const built = makeTorrent(uniqueName(prefix), files);
  seedPayload(daemon.downloadDir, built.name, files);
  await navButton(page, "plus").click();
  const dialog = page.getByRole("dialog", { name: "Add Torrent" });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: `${built.name}.torrent`,
    mimeType: "application/x-bittorrent",
    buffer: built.torrent,
  });
  await dialog.getByPlaceholder("Destination path (optional)").fill(CONTAINER_DOWNLOAD_DIR);
  await expect(dialog.getByText(/^Free: .+ \/ Total: /)).toBeVisible();
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog).toBeHidden();
  return built;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Showing 0-0 of 0 results")).toBeVisible();
});

test("adds a .torrent file and shows it seeding once verified", async ({ page }) => {
  const { name } = await addTorrentFile(page, payload(["movie.mkv", 80_000]));
  const r = row(page, name);
  await expect(r).toBeVisible();
  await expect(r).toContainText("Seeding");
  await expect(r).toContainText("100.00%");
  await expect(r).toContainText("78.13 KB");
  await expect(page.getByText("Showing 1-1 of 1 results")).toBeVisible();
});

test("stops and starts a torrent from its row menu", async ({ page }) => {
  const { name } = await addTorrentFile(page, payload(["iso.img", 30_000]));
  await expect(row(page, name)).toContainText("Seeding");

  await rowAction(page, name, "Stop");
  await expect(row(page, name)).toContainText("Stopped");

  await rowAction(page, name, "Start");
  await expect(row(page, name)).toContainText("Seeding");
});

test("stops and starts selected torrents in bulk", async ({ page }) => {
  const a = await addTorrentFile(page, payload(["a.bin", 10_000]), "bulk");
  const b = await addTorrentFile(page, payload(["b.bin", 10_000]), "bulk");
  await expect(row(page, a.name)).toContainText("Seeding");
  await expect(row(page, b.name)).toContainText("Seeding");

  await page.getByRole("checkbox", { name: "Select all" }).click();
  await navButton(page, "pause").click();
  await expect(row(page, a.name)).toContainText("Stopped");
  await expect(row(page, b.name)).toContainText("Stopped");

  await navButton(page, "play").click();
  await expect(row(page, a.name)).toContainText("Seeding");
  await expect(row(page, b.name)).toContainText("Seeding");
});

test("shows details and toggles a file", async ({ page }) => {
  const files = payload(["set/one.flac", 20_000], ["set/two.flac", 20_000]);
  const { name, infoHash } = await addTorrentFile(page, files, "details");
  await expect(row(page, name)).toContainText("Seeding");

  await rowAction(page, name, "View Details");
  const dialog = page.getByRole("dialog", { name });
  await expect(dialog.getByRole("row", { name: /Hash/ })).toContainText(infoHash);
  await expect(dialog.getByRole("row", { name: /Download Directory/ })).toContainText(CONTAINER_DOWNLOAD_DIR);

  await dialog.getByRole("tab", { name: "Pieces" }).click();
  await expect(dialog.getByText("3 of 3 pieces complete")).toBeVisible();

  await dialog.getByRole("tab", { name: "Files" }).click();
  const second = dialog.getByRole("checkbox", { name: `Toggle download for ${name}/set/two.flac` });
  await expect(second).toBeChecked();
  await second.click();
  await expect(second).not.toBeChecked();
  const torrent = await direct.getTorrent(infoHash, ["fileStats"]);
  expect(torrent.fileStats.map((s: { wanted: boolean }) => s.wanted)).toEqual([true, false]);
});

test("adds a magnet link and reports a duplicate", async ({ page }) => {
  const name = uniqueName("magnet");
  const { magnet } = randomMagnet(name);

  await navButton(page, "plus").click();
  let dialog = page.getByRole("dialog", { name: "Add Torrent" });
  await dialog.getByPlaceholder("Magnet link").fill(magnet);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(row(page, name)).toBeVisible();

  await navButton(page, "plus").click();
  dialog = page.getByRole("dialog", { name: "Add Torrent" });
  await dialog.getByPlaceholder("Magnet link").fill(magnet);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByText("Torrent already exists")).toBeVisible();
});

test("removes a torrent but keeps its data", async ({ page }) => {
  const { name } = await addTorrentFile(page, payload(["keep.bin", 10_000]), "keep");
  await expect(row(page, name)).toBeVisible();

  await rowAction(page, name, "Remove");
  const confirm = page.getByRole("dialog", { name: `Remove ${name}?` });
  await confirm.getByRole("button", { name: "Confirm" }).click();
  await expect(row(page, name)).toHaveCount(0);
  expect(existsSync(path.join(daemon.downloadDir, name))).toBe(true);
});

test("removes a torrent and deletes its data", async ({ page }) => {
  const { name } = await addTorrentFile(page, payload(["gone.bin", 10_000]), "gone");
  await expect(row(page, name)).toContainText("Seeding");

  await rowAction(page, name, "Remove and Delete Data");
  const confirm = page.getByRole("dialog", { name: `Permanently delete ${name}?` });
  await confirm.getByRole("button", { name: "Confirm" }).click();
  await expect(row(page, name)).toHaveCount(0);
  await expect.poll(() => existsSync(path.join(daemon.downloadDir, name))).toBe(false);
});

test("filters by name and status", async ({ page }) => {
  const seeding = await addTorrentFile(page, payload(["s.bin", 10_000]), "alpha");
  const stopped = await addTorrentFile(page, payload(["t.bin", 10_000]), "beta");
  await expect(row(page, stopped.name)).toContainText("Seeding");
  await rowAction(page, stopped.name, "Stop");
  await expect(row(page, stopped.name)).toContainText("Stopped");

  await page.getByPlaceholder("Filter by name...").fill("alpha");
  await expect(row(page, seeding.name)).toBeVisible();
  await expect(row(page, stopped.name)).toHaveCount(0);
  await expect(page.getByText("(filtered from total 2 items)")).toBeVisible();
  await page.getByPlaceholder("Filter by name...").fill("");

  await page.getByRole("button", { name: "Status: All" }).click();
  await page.getByRole("menuitemradio", { name: "Stopped" }).click();
  await expect(row(page, stopped.name)).toBeVisible();
  await expect(row(page, seeding.name)).toHaveCount(0);
});

test("remembers the column layout across reloads", async ({ page }) => {
  await page.getByRole("button", { name: "Columns" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Up Speed" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Up Speed" })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: "Down Speed" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Up Speed" })).toHaveCount(0);
});
