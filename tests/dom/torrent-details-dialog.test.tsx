import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TorrentDetailsDialog } from "@/components/torrent-details-dialog";
import { getTorrentDetails, setFileWantedState } from "@/lib/transmission";
import type { Torrent, TorrentDetails } from "@/lib/types";

vi.mock("@/lib/transmission", () => ({
  getTorrentDetails: vi.fn(),
  setFileWantedState: vi.fn(),
}));

const torrent: Torrent = {
  id: 7,
  name: "ubuntu-24.04.iso",
  totalSize: 4 * 1024 ** 3,
  percentDone: 0.5,
  rateDownload: 2048,
  rateUpload: 1024,
  status: 4,
  error: 0,
  errorString: "",
};

function details(overrides: Partial<TorrentDetails> = {}): TorrentDetails {
  return {
    ...torrent,
    percentDone: 0.75,
    hashString: "0123456789abcdef0123456789abcdef01234567",
    downloadDir: "/downloads",
    creator: "mktorrent",
    comment: "Release build",
    isPrivate: false,
    eta: 3725,
    uploadRatio: 1.5,
    uploadedEver: 1024,
    downloadedEver: 2048,
    addedDate: 1_700_000_000,
    pieceCount: 10,
    pieceSize: 256 * 1024,
    // Pieces 0, 1, 2 and 9 are complete.
    pieces: Buffer.from([0b1110_0000, 0b0100_0000]).toString("base64"),
    trackerStats: [{}, {}],
    peers: [],
    files: [
      { name: "ubuntu/disk.iso", length: 4000 },
      { name: "ubuntu/README", length: 0 },
    ],
    fileStats: [
      { bytesCompleted: 1000, wanted: true },
      { bytesCompleted: 0, wanted: false },
    ],
    ...overrides,
  };
}

function renderDialog(props: Partial<Parameters<typeof TorrentDetailsDialog>[0]> = {}) {
  const onOpenChange = vi.fn();
  const view = render(
    <TorrentDetailsDialog torrent={torrent} open onOpenChange={onOpenChange} {...props} />,
  );
  return { ...view, onOpenChange, user: userEvent.setup() };
}

/** Value cell of the Info tab row with this heading. */
function infoValue(heading: string) {
  const row = screen.getByRole("rowheader", { name: heading }).closest("tr")!;
  return within(row).getByRole("cell").textContent;
}

beforeEach(() => {
  vi.mocked(getTorrentDetails).mockResolvedValue(details());
  vi.mocked(setFileWantedState).mockResolvedValue();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("TorrentDetailsDialog", () => {
  it("renders nothing without a torrent", () => {
    const { container } = renderDialog({ torrent: null });
    expect(container).toBeEmptyDOMElement();
    expect(getTorrentDetails).not.toHaveBeenCalled();
  });

  it("does not fetch while closed", () => {
    renderDialog({ open: false });
    expect(getTorrentDetails).not.toHaveBeenCalled();
  });

  it("shows the list snapshot first, then the fetched details", async () => {
    vi.mocked(getTorrentDetails).mockReturnValue(new Promise(() => {}));
    const { unmount } = renderDialog();
    expect(screen.getByRole("dialog", { name: torrent.name })).toBeInTheDocument();
    expect(infoValue("Progress")).toBe("50.00%");
    expect(infoValue("Hash")).toBe("-");
    unmount();

    vi.mocked(getTorrentDetails).mockResolvedValue(details());
    renderDialog();
    await waitFor(() => expect(infoValue("Progress")).toBe("75.00%"));
    expect(getTorrentDetails).toHaveBeenCalledWith(7);
    expect(infoValue("Hash")).toBe("0123456789abcdef0123456789abcdef01234567");
    expect(infoValue("Size")).toBe("4 GB");
    expect(infoValue("Status")).toBe("Downloading");
    expect(infoValue("Download Speed")).toBe("2 KB/s");
    expect(infoValue("Download Directory")).toBe("/downloads");
    expect(infoValue("Creator")).toBe("mktorrent");
    expect(infoValue("Comment")).toBe("Release build");
    expect(infoValue("Private")).toBe("No");
    expect(infoValue("Piece Count")).toBe("10");
    expect(infoValue("Piece Size")).toBe("256 KB");
    expect(infoValue("Tracker Stats")).toBe("2");
    expect(infoValue("Uploaded Ever")).toBe("1 KB");
    expect(infoValue("Date Added")).toBe(new Date(1_700_000_000_000).toLocaleString());
    expect(infoValue("Done Date")).toBe("-");
  });

  it.each([
    [3725, "1h 2m"],
    [59, "0h 0m"],
    [0, "Done"],
    [-1, "N/A"],
    [-2, "Unknown"],
    [undefined, "-"],
  ])("formats ETA %s as %s", async (eta, text) => {
    vi.mocked(getTorrentDetails).mockResolvedValue(details({ eta }));
    renderDialog();
    await waitFor(() => expect(infoValue("Hash")).not.toBe("-"));
    expect(infoValue("ETA")).toBe(text);
  });

  it.each([
    [1.5, "1.50"],
    [0, "0.00"],
    [-1, "None"],
    [-2, "∞"],
    [undefined, "-"],
  ])("formats ratio %s as %s", async (uploadRatio, text) => {
    vi.mocked(getTorrentDetails).mockResolvedValue(details({ uploadRatio }));
    renderDialog();
    await waitFor(() => expect(infoValue("Hash")).not.toBe("-"));
    expect(infoValue("Upload Ratio")).toBe(text);
  });

  it("ignores details that belong to another torrent", async () => {
    vi.mocked(getTorrentDetails).mockResolvedValue(details({ id: 99, hashString: "other" }));
    renderDialog();
    await waitFor(() => expect(getTorrentDetails).toHaveBeenCalled());
    await act(async () => {});
    expect(infoValue("Hash")).toBe("-");
  });

  it("refreshes every 5 seconds while open and stops when closed", async () => {
    vi.useFakeTimers();
    const { rerender } = renderDialog();
    await act(async () => {});
    expect(getTorrentDetails).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTime(5000));
    expect(getTorrentDetails).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTime(5000));
    expect(getTorrentDetails).toHaveBeenCalledTimes(3);

    rerender(<TorrentDetailsDialog torrent={torrent} open={false} onOpenChange={vi.fn()} />);
    await act(async () => vi.advanceTimersByTime(20_000));
    expect(getTorrentDetails).toHaveBeenCalledTimes(3);
  });

  describe("Peers tab", () => {
    it("says when there are no peers", async () => {
      const { user } = renderDialog();
      await user.click(screen.getByRole("tab", { name: "Peers" }));
      expect(screen.getByText("No peers found.")).toBeInTheDocument();
    });

    it("lists peers", async () => {
      vi.mocked(getTorrentDetails).mockResolvedValue(
        details({
          peers: [
            {
              address: "10.0.0.2",
              port: 51413,
              clientName: "Transmission 4.0",
              progress: 0.5,
              rateToClient: 1024,
              rateToPeer: 0,
              flagStr: "TDE",
            },
          ],
        }),
      );
      const { user } = renderDialog();
      await user.click(screen.getByRole("tab", { name: "Peers" }));
      const row = (await screen.findByText("10.0.0.2")).closest("tr")!;
      expect(
        within(row)
          .getAllByRole("cell")
          .map((c) => c.textContent),
      ).toEqual(["10.0.0.2", "Transmission 4.0", "50.00%", "1 KB/s", "0 B/s", "TDE"]);
    });
  });

  describe("Pieces tab", () => {
    it("counts completed pieces", async () => {
      const { user } = renderDialog();
      await user.click(screen.getByRole("tab", { name: "Pieces" }));
      expect(await screen.findByText("4 of 10 pieces complete")).toBeInTheDocument();
    });

    it("groups pieces when there are too many to draw one each", async () => {
      const pieceCount = 20_001;
      vi.mocked(getTorrentDetails).mockResolvedValue(
        details({
          pieceCount,
          pieces: Buffer.alloc(Math.ceil(pieceCount / 8), 0xff).toString("base64"),
        }),
      );
      const { user } = renderDialog();
      await user.click(screen.getByRole("tab", { name: "Pieces" }));
      expect(
        await screen.findByText("20001 of 20001 pieces complete (each square covers 3 pieces)"),
      ).toBeInTheDocument();
    });

    it("handles bad piece data", async () => {
      vi.mocked(getTorrentDetails).mockResolvedValue(details({ pieces: "%%%not base64%%%" }));
      const { user } = renderDialog();
      await user.click(screen.getByRole("tab", { name: "Pieces" }));
      expect(await screen.findByText("Piece data unavailable.")).toBeInTheDocument();
    });

    it("handles missing piece data", async () => {
      vi.mocked(getTorrentDetails).mockResolvedValue(details({ pieces: "", pieceCount: 0 }));
      const { user } = renderDialog();
      await user.click(screen.getByRole("tab", { name: "Pieces" }));
      expect(await screen.findByText("No piece data.")).toBeInTheDocument();
    });

    it("says it is loading before details arrive", async () => {
      vi.mocked(getTorrentDetails).mockReturnValue(new Promise(() => {}));
      const { user } = renderDialog();
      await user.click(screen.getByRole("tab", { name: "Pieces" }));
      expect(screen.getByText("Loading pieces...")).toBeInTheDocument();
    });
  });

  describe("Files tab", () => {
    it("lists files with their progress and wanted state", async () => {
      const { user } = renderDialog();
      await user.click(screen.getByRole("tab", { name: "Files" }));
      const iso = await screen.findByRole("checkbox", { name: "Toggle download for ubuntu/disk.iso" });
      const readme = screen.getByRole("checkbox", { name: "Toggle download for ubuntu/README" });
      expect(iso).toBeChecked();
      expect(readme).not.toBeChecked();
      const cells = within(iso.closest("tr")!)
        .getAllByRole("cell")
        .map((c) => c.textContent);
      expect(cells.slice(1)).toEqual(["ubuntu/disk.iso", "3.91 KB", "1000 B", "25.00%"]);
      // An empty file has no meaningful progress.
      expect(within(readme.closest("tr")!).getAllByRole("cell").at(-1)!.textContent).toBe("-");
    });

    it("toggles a file by its index and shows the refreshed state", async () => {
      const { user } = renderDialog();
      await user.click(screen.getByRole("tab", { name: "Files" }));
      const iso = await screen.findByRole("checkbox", { name: "Toggle download for ubuntu/disk.iso" });

      vi.mocked(getTorrentDetails).mockResolvedValue(
        details({
          fileStats: [
            { bytesCompleted: 1000, wanted: false },
            { bytesCompleted: 0, wanted: false },
          ],
        }),
      );
      await user.click(iso);
      expect(setFileWantedState).toHaveBeenCalledWith(7, [0], false);
      await waitFor(() => expect(iso).not.toBeChecked());

      await user.click(screen.getByRole("checkbox", { name: "Toggle download for ubuntu/README" }));
      expect(setFileWantedState).toHaveBeenLastCalledWith(7, [1], true);
    });

    it("says when there are no files", async () => {
      vi.mocked(getTorrentDetails).mockResolvedValue(details({ files: [], fileStats: [] }));
      const { user } = renderDialog();
      await user.click(screen.getByRole("tab", { name: "Files" }));
      expect(await screen.findByText("No files found.")).toBeInTheDocument();
    });
  });
});
