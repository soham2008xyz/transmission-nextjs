import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../setup/msw";
import { AddTorrentDialog } from "@/components/add-torrent-dialog";
import { MAX_TORRENT_FILE_BYTES } from "@/lib/limits";
import type { AddTorrentDialogProps } from "@/lib/types";

const MAGNET = "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567";

function setup(props: Partial<AddTorrentDialogProps> = {}) {
  const onAdd = vi.fn<AddTorrentDialogProps["onAdd"]>().mockResolvedValue(true);
  const onOpenChange = vi.fn();
  const user = userEvent.setup();
  render(<AddTorrentDialog open onOpenChange={onOpenChange} onAdd={onAdd} {...props} />);
  return {
    user,
    onAdd: (props.onAdd as typeof onAdd | undefined) ?? onAdd,
    onOpenChange,
    magnet: screen.getByPlaceholderText("Magnet link"),
    destination: screen.getByPlaceholderText("Destination path (optional)"),
    fileInput: document.querySelector<HTMLInputElement>('input[type="file"]')!,
    addButton: () => screen.getByRole("button", { name: /add/i }),
  };
}

function torrentFile(name = "ubuntu.torrent", size?: number) {
  const file = new File(["d4:infoe"], name, { type: "application/x-bittorrent" });
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  return file;
}

/** Answers free-space requests and records the paths asked for. */
function mockFreeSpace(respond: (path: string) => Response) {
  const paths: string[] = [];
  server.use(
    http.post("*/api/transmission/rpc", async ({ request }) => {
      const body = (await request.json()) as { method: string; arguments: { path: string } };
      paths.push(body.arguments.path);
      return respond(body.arguments.path);
    }),
  );
  return paths;
}

describe("AddTorrentDialog", () => {
  it("renders nothing when closed", () => {
    render(<AddTorrentDialog open={false} onOpenChange={vi.fn()} onAdd={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks for a magnet link or a file", async () => {
    const { user, onAdd, addButton } = setup();
    await user.click(addButton());
    expect(screen.getByText("Please provide a magnet link or select a file.")).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("rejects a relative destination before anything else", async () => {
    mockFreeSpace(() => HttpResponse.json({ result: "No such file or directory", arguments: {} }));
    const { user, onAdd, magnet, destination, addButton } = setup();
    await user.type(magnet, MAGNET);
    await user.type(destination, "downloads");
    await user.click(addButton());
    expect(screen.getByText(/Path must be absolute/)).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("adds a magnet link and clears the form", async () => {
    const { user, onAdd, magnet, addButton } = setup();
    await user.type(magnet, MAGNET);
    await user.click(addButton());
    expect(onAdd).toHaveBeenCalledWith(MAGNET, null, "");
    await waitFor(() => expect(magnet).toHaveValue(""));
  });

  it("adds a file", async () => {
    const { user, onAdd, fileInput, addButton } = setup();
    const file = torrentFile();
    await user.upload(fileInput, file);
    await user.click(addButton());
    expect(onAdd).toHaveBeenCalledWith("", file, "");
    await waitFor(() => expect(fileInput.value).toBe(""));
  });

  it("warns that only the magnet is used when both are set", async () => {
    const { user, onAdd, magnet, fileInput, addButton } = setup();
    await user.type(magnet, MAGNET);
    await user.upload(fileInput, torrentFile());
    expect(screen.getByText(/Only the magnet link will be added/)).toBeInTheDocument();
    await user.click(addButton());
    expect(onAdd).toHaveBeenCalledWith(MAGNET, expect.any(File), "");
  });

  it("refuses a file over the size limit as soon as it is picked", async () => {
    const { user, onAdd, fileInput, addButton } = setup();
    await user.upload(fileInput, torrentFile("huge.torrent", MAX_TORRENT_FILE_BYTES + 1));
    expect(screen.getByText(/huge\.torrent is 20 MB\. \.torrent files can be at most 20 MB\./)).toBeInTheDocument();
    await user.click(addButton());
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("accepts a file of exactly the size limit", async () => {
    const { user, onAdd, fileInput, addButton } = setup();
    await user.upload(fileInput, torrentFile("max.torrent", MAX_TORRENT_FILE_BYTES));
    expect(screen.queryByText(/can be at most/)).not.toBeInTheDocument();
    await user.click(addButton());
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("keeps the form when adding fails", async () => {
    const onAdd = vi.fn().mockResolvedValue(false);
    const { user, magnet, addButton } = setup({ onAdd });
    await user.type(magnet, MAGNET);
    await user.click(addButton());
    await waitFor(() => expect(addButton()).toBeEnabled());
    expect(magnet).toHaveValue(MAGNET);
  });

  it("disables Add while a request is in flight", async () => {
    let finish!: (added: boolean) => void;
    const onAdd = vi.fn(() => new Promise<boolean>((resolve) => (finish = resolve)));
    const { user, magnet, addButton } = setup({ onAdd });
    await user.type(magnet, MAGNET);
    await user.click(addButton());
    expect(addButton()).toHaveTextContent("Adding...");
    expect(addButton()).toBeDisabled();
    await user.click(addButton());
    expect(onAdd).toHaveBeenCalledOnce();
    finish(true);
    await waitFor(() => expect(addButton()).toHaveTextContent(/^Add$/));
  });

  it("shows an error passed in by the parent", () => {
    setup({ error: "Torrent already exists" });
    expect(screen.getByText("Torrent already exists")).toBeInTheDocument();
  });

  describe("free space", () => {
    it("checks the destination once typing pauses and shows the result", async () => {
      const paths = mockFreeSpace(() =>
        HttpResponse.json({
          result: "success",
          arguments: { "size-bytes": 1024 ** 3, total_size: 4 * 1024 ** 3 },
        }),
      );
      const { user, destination } = setup();
      await user.type(destination, "/data");
      expect(screen.getByText("Checking disk space...")).toBeInTheDocument();
      expect(await screen.findByText("Free: 1 GB / Total: 4 GB")).toBeInTheDocument();
      expect(paths).toEqual(["/data"]);
    });

    it("shows only free space when the total is unknown", async () => {
      mockFreeSpace(() => HttpResponse.json({ result: "success", arguments: { "size-bytes": 2048 } }));
      const { user, destination } = setup();
      await user.type(destination, "/x");
      expect(await screen.findByText("Free: 2 KB")).toBeInTheDocument();
    });

    it("hides the result when the check fails", async () => {
      mockFreeSpace(() => HttpResponse.json({ result: "No such file or directory", arguments: {} }));
      const { user, destination } = setup();
      await user.type(destination, "/missing");
      await waitFor(() => expect(screen.queryByText("Checking disk space...")).not.toBeInTheDocument());
      expect(screen.queryByText(/^Free:/)).not.toBeInTheDocument();
    });

    it("clears the result when the destination is emptied", async () => {
      mockFreeSpace(() => HttpResponse.json({ result: "success", arguments: { "size-bytes": 1024 } }));
      const { user, destination } = setup();
      await user.type(destination, "/d");
      await screen.findByText("Free: 1 KB");
      await user.clear(destination);
      expect(screen.queryByText(/^Free:/)).not.toBeInTheDocument();
    });

    it("ignores a slow reply for a path that has since changed", async () => {
      let releaseSlow!: () => void;
      const slow = new Promise<void>((resolve) => (releaseSlow = resolve));
      server.use(
        http.post("*/api/transmission/rpc", async ({ request }) => {
          const { arguments: args } = (await request.json()) as { arguments: { path: string } };
          if (args.path === "/old") {
            await slow;
            return HttpResponse.json({ result: "success", arguments: { "size-bytes": 1 } });
          }
          return HttpResponse.json({ result: "success", arguments: { "size-bytes": 1024 ** 2 } });
        }),
      );
      const { user, destination } = setup();
      await user.type(destination, "/old");
      // Let the debounce fire for /old, then change the path.
      await new Promise((r) => setTimeout(r, 500));
      await user.clear(destination);
      await user.type(destination, "/new");
      expect(await screen.findByText("Free: 1 MB")).toBeInTheDocument();
      releaseSlow();
      await new Promise((r) => setTimeout(r, 50));
      expect(screen.getByText("Free: 1 MB")).toBeInTheDocument();
      expect(screen.queryByText("Free: 1 B")).not.toBeInTheDocument();
    });
  });
});
