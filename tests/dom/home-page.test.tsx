import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";
import {
  RpcError,
  addTorrentByFile,
  addTorrentByMagnet,
  getFreeSpace,
  getTorrentDetails,
  getTorrents,
  removeTorrent,
  startTorrent,
  stopTorrent,
} from "@/lib/transmission";
import type { Torrent } from "@/lib/types";

vi.mock("@/lib/transmission", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/transmission")>();
  return {
    RpcError: actual.RpcError,
    getTorrents: vi.fn(),
    getTorrentDetails: vi.fn(),
    getFreeSpace: vi.fn(),
    startTorrent: vi.fn(),
    stopTorrent: vi.fn(),
    removeTorrent: vi.fn(),
    addTorrentByMagnet: vi.fn(),
    addTorrentByFile: vi.fn(),
    setFileWantedState: vi.fn(),
  };
});

const MAGNET = "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567";

function makeTorrent(id: number, overrides: Partial<Torrent> = {}): Torrent {
  return {
    id,
    name: `torrent-${id}`,
    totalSize: 1024,
    percentDone: 1,
    rateDownload: 0,
    rateUpload: 0,
    status: 6,
    error: 0,
    errorString: "",
    ...overrides,
  };
}

const ubuntu = makeTorrent(1, { name: "ubuntu.iso" });
const debian = makeTorrent(2, { name: "debian.iso", status: 0 });

async function renderHome(initial: Torrent[] = [ubuntu, debian]) {
  vi.mocked(getTorrents).mockResolvedValue(initial);
  const user = userEvent.setup();
  render(<Home />);
  await screen.findByText(new RegExp(`of ${initial.length} results`));
  return user;
}

/** Runs the next poll now instead of waiting five seconds. */
async function pollNow() {
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

function iconButton(icon: string) {
  return document.querySelector(`nav svg.lucide-${icon}`)!.closest("button")!;
}

async function openRowMenu(user: ReturnType<typeof userEvent.setup>, name: string, item: string) {
  const row = screen.getByText(name).closest("tr")!;
  await user.click(within(row).getByRole("button", { name: "Open menu" }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
}

beforeEach(() => {
  for (const fn of [startTorrent, stopTorrent, removeTorrent, addTorrentByMagnet, addTorrentByFile]) {
    vi.mocked(fn).mockResolvedValue(undefined);
  }
  vi.mocked(getTorrentDetails).mockReturnValue(new Promise(() => {}));
  // The add dialog looks up free space on a debounce timer whenever a destination is typed,
  // so the mock must always return a promise, however late that timer fires.
  vi.mocked(getFreeSpace).mockResolvedValue({ free: 1024, total: 4096 });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Home", () => {
  it("lists torrents and summarises the page", async () => {
    await renderHome();
    expect(screen.getByText("debian.iso")).toBeInTheDocument();
    expect(screen.getByText("Showing 1-2 of 2 results")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows 0-0 when there are no torrents", async () => {
    vi.mocked(getTorrents).mockResolvedValue([]);
    render(<Home />);
    expect(await screen.findByText("Showing 0-0 of 0 results")).toBeInTheDocument();
  });

  it("notes when a filter hides rows", async () => {
    const user = await renderHome();
    await user.type(screen.getByPlaceholderText("Filter by name..."), "debian");
    expect(screen.getByText("Showing 1-1 of 1 results (filtered from total 2 items)")).toBeInTheDocument();
  });

  describe("connection state", () => {
    it("keeps the last rows and shows one banner while Transmission is unreachable", async () => {
      await renderHome();
      vi.mocked(getTorrents).mockRejectedValue(new RpcError("Could not connect to Transmission.", true));
      await pollNow();

      expect(await screen.findByRole("alert")).toHaveTextContent(/Disconnected: could not reach Transmission/);
      expect(screen.getByText("ubuntu.iso")).toBeInTheDocument();

      vi.mocked(getTorrents).mockResolvedValue([ubuntu]);
      await pollNow();
      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
      expect(screen.queryByText("debian.iso")).not.toBeInTheDocument();
    });

    it("logs other errors without the banner", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      await renderHome();
      vi.mocked(getTorrents).mockRejectedValue(new RpcError("method not allowed"));
      await pollNow();
      await waitFor(() => expect(log).toHaveBeenCalledWith("Failed to fetch torrents:", expect.any(RpcError)));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      log.mockRestore();
    });

    it("polls every five seconds", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        vi.mocked(getTorrents).mockResolvedValue([ubuntu]);
        render(<Home />);
        await act(async () => {});
        expect(getTorrents).toHaveBeenCalledTimes(1);
        await act(async () => vi.advanceTimersByTime(5000));
        expect(getTorrents).toHaveBeenCalledTimes(2);
        await act(async () => vi.advanceTimersByTime(5000));
        expect(getTorrents).toHaveBeenCalledTimes(3);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("row actions", () => {
    it("starts a torrent and refreshes", async () => {
      const user = await renderHome();
      vi.mocked(getTorrents).mockClear();
      await openRowMenu(user, "debian.iso", "Start");
      expect(startTorrent).toHaveBeenCalledWith(2);
      await waitFor(() => expect(getTorrents).toHaveBeenCalled());
    });

    it("stops a torrent", async () => {
      const user = await renderHome();
      await openRowMenu(user, "ubuntu.iso", "Stop");
      expect(stopTorrent).toHaveBeenCalledWith(1);
    });

    it("shows a toast when an action fails", async () => {
      vi.mocked(startTorrent).mockRejectedValue(new RpcError("torrent not found"));
      const user = await renderHome();
      await openRowMenu(user, "debian.iso", "Start");
      expect(await screen.findByText("torrent not found")).toBeInTheDocument();
    });

    it("asks before removing, then keeps the data", async () => {
      const user = await renderHome();
      await openRowMenu(user, "ubuntu.iso", "Remove");
      const dialog = await screen.findByRole("dialog", { name: "Remove ubuntu.iso?" });
      expect(within(dialog).getByText(/data will remain on disk/)).toBeInTheDocument();
      expect(removeTorrent).not.toHaveBeenCalled();

      await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
      expect(removeTorrent).toHaveBeenCalledWith(1, false);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("asks before deleting data", async () => {
      const user = await renderHome();
      await openRowMenu(user, "ubuntu.iso", "Remove and Delete Data");
      const dialog = await screen.findByRole("dialog", { name: "Permanently delete ubuntu.iso?" });
      await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
      expect(removeTorrent).toHaveBeenCalledWith(1, true);
    });

    it("does nothing when removal is cancelled", async () => {
      const user = await renderHome();
      await openRowMenu(user, "ubuntu.iso", "Remove");
      await user.click(await screen.findByRole("button", { name: "Cancel" }));
      expect(removeTorrent).not.toHaveBeenCalled();
    });

    it("opens the details dialog", async () => {
      const user = await renderHome();
      await openRowMenu(user, "debian.iso", "View Details");
      expect(await screen.findByRole("dialog", { name: "debian.iso" })).toBeInTheDocument();
      expect(getTorrentDetails).toHaveBeenCalledWith(2);
    });
  });

  describe("bulk actions", () => {
    async function selectBoth(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole("checkbox", { name: "Select all" }));
    }

    it("starts and stops the selected torrents in one call each", async () => {
      const user = await renderHome();
      await selectBoth(user);
      await user.click(iconButton("play"));
      await user.click(iconButton("pause"));
      expect(startTorrent).toHaveBeenCalledWith([1, 2]);
      expect(stopTorrent).toHaveBeenCalledWith([1, 2]);
    });

    it("confirms before removing the selection", async () => {
      const user = await renderHome();
      await selectBoth(user);
      await user.click(iconButton("circle-x"));
      const dialog = await screen.findByRole("dialog", { name: "Permanently delete 2 selected torrents?" });
      await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
      expect(removeTorrent).toHaveBeenCalledWith([1, 2], true);
    });

    it("drops torrents that disappear from the selection", async () => {
      const user = await renderHome();
      await user.click(within(screen.getByText("debian.iso").closest("tr")!).getByRole("checkbox"));
      expect(iconButton("play")).toBeEnabled();

      vi.mocked(getTorrents).mockResolvedValue([ubuntu]);
      await pollNow();
      await waitFor(() => expect(iconButton("play")).toBeDisabled());
    });
  });

  describe("adding", () => {
    it("adds a magnet link and closes the dialog", async () => {
      const user = await renderHome();
      await user.click(iconButton("plus"));
      await user.type(await screen.findByPlaceholderText("Magnet link"), MAGNET);
      await user.click(screen.getByRole("button", { name: "Add" }));
      expect(addTorrentByMagnet).toHaveBeenCalledWith(MAGNET, "");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("adds a file with a destination", async () => {
      const user = await renderHome();
      await user.click(iconButton("plus"));
      const file = new File(["d4:infoe"], "a.torrent");
      await user.upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, file);
      await user.type(screen.getByPlaceholderText("Destination path (optional)"), "/data");
      await user.click(screen.getByRole("button", { name: "Add" }));
      expect(addTorrentByFile).toHaveBeenCalledWith(file, "/data");
      // Let the dialog close so its pending free-space lookup is cancelled before the test ends.
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("keeps the dialog open with the error when adding fails", async () => {
      vi.mocked(addTorrentByMagnet).mockRejectedValue(new RpcError("Torrent already exists"));
      const user = await renderHome();
      await user.click(iconButton("plus"));
      await user.type(await screen.findByPlaceholderText("Magnet link"), MAGNET);
      await user.click(screen.getByRole("button", { name: "Add" }));
      const dialog = screen.getByRole("dialog");
      expect(await within(dialog).findByText("Torrent already exists")).toBeInTheDocument();

      // Closing clears the error for next time.
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
      await user.click(iconButton("plus"));
      expect(await screen.findByRole("dialog")).not.toHaveTextContent("Torrent already exists");
    });

    it("treats a failed refresh after adding as success", async () => {
      const user = await renderHome();
      vi.mocked(getTorrents).mockRejectedValue(new RpcError("Could not connect to Transmission.", true));
      await user.click(iconButton("plus"));
      await user.type(await screen.findByPlaceholderText("Magnet link"), MAGNET);
      await user.click(screen.getByRole("button", { name: "Add" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });
  });

  describe("saved table state", () => {
    it("restores the page size and clamps a saved page that no longer exists", async () => {
      localStorage.setItem("table_pageSize", "20");
      localStorage.setItem("table_pageIndex", "4");
      await renderHome(Array.from({ length: 25 }, (_, i) => makeTorrent(i + 1)));
      await waitFor(() => expect(screen.getByText("Showing 21-25 of 25 results")).toBeInTheDocument());
      expect(localStorage.getItem("table_pageIndex")).toBe("1");
    });

    it("restores the saved sort", async () => {
      localStorage.setItem("table_sorting", JSON.stringify([{ id: "name", desc: false }]));
      await renderHome([ubuntu, debian]);
      const names = screen
        .getAllByRole("row")
        .slice(1)
        .map((r) => within(r).getAllByRole("cell")[1].textContent);
      expect(names).toEqual(["debian.iso", "ubuntu.iso"]);
    });

    it("goes back to the first page when a filter changes", async () => {
      const user = await renderHome(Array.from({ length: 25 }, (_, i) => makeTorrent(i + 1)));
      await user.click(screen.getByRole("button", { name: "Next" }));
      expect(screen.getByText("Showing 11-20 of 25 results")).toBeInTheDocument();
      await user.type(screen.getByPlaceholderText("Filter by name..."), "torrent-1");
      expect(screen.getByText(/^Showing 1-/)).toBeInTheDocument();
      expect(localStorage.getItem("table_pageIndex")).toBe("0");
    });
  });
});
