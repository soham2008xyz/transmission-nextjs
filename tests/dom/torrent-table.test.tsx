import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type TableMeta,
  type VisibilityState,
} from "@tanstack/react-table";
import { columns } from "@/components/columns";
import { DataTable } from "@/components/data-table";
import { Navbar } from "@/components/navbar";
import type { Torrent } from "@/lib/types";

function makeTorrent(id: number, overrides: Partial<Torrent> = {}): Torrent {
  return {
    id,
    name: `torrent-${String(id).padStart(3, "0")}`,
    totalSize: id * 1024 * 1024,
    percentDone: 0.5,
    rateDownload: 1024,
    rateUpload: 512,
    status: 4,
    error: 0,
    errorString: "",
    ...overrides,
  };
}

interface HarnessProps {
  data: Torrent[];
  meta: TableMeta<Torrent>;
  navbar: Omit<Parameters<typeof Navbar>[0], "table" | "selectedCount">;
  onSelection?: (ids: string[]) => void;
}

// Wires the table the way the page does, without the polling.
function Harness({ data, meta, navbar, onSelection }: Readonly<HarnessProps>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  // eslint-disable-next-line react-hooks/incompatible-library -- same TanStack call as page.tsx
  const table = useReactTable({
    data,
    columns,
    meta,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      setRowSelection((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        onSelection?.(Object.keys(next).filter((k) => next[k]));
        return next;
      });
    },
    state: { sorting, columnFilters, columnVisibility, rowSelection },
  });
  const selectedCount = Object.values(rowSelection).filter(Boolean).length;
  return (
    <>
      <Navbar table={table} selectedCount={selectedCount} {...navbar} />
      <DataTable table={table} columns={columns} />
    </>
  );
}

function setup(data: Torrent[]) {
  const meta = {
    startTorrent: vi.fn(),
    stopTorrent: vi.fn(),
    removeTorrent: vi.fn(),
    viewTorrentDetails: vi.fn(),
  };
  const navbar = {
    onAddTorrentClick: vi.fn(),
    onStartSelected: vi.fn(),
    onStopSelected: vi.fn(),
    onRemoveSelected: vi.fn(),
  };
  const onSelection = vi.fn();
  render(<Harness data={data} meta={meta} navbar={navbar} onSelection={onSelection} />);
  return { user: userEvent.setup(), meta, navbar, onSelection };
}

/** Names in the table body, top to bottom. */
function visibleNames() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).queryAllByRole("cell")[1]?.textContent ?? "");
}

// The bulk buttons are icon-only, so find them by their lucide icon.
function iconButton(icon: string) {
  const svg = document.querySelector(`nav svg.lucide-${icon}`);
  if (!svg) throw new Error(`no button with icon ${icon}`);
  return svg.closest("button")!;
}

describe("torrent table", () => {
  it("formats each column", () => {
    setup([makeTorrent(1, { totalSize: 1536, percentDone: 0.12345, rateDownload: 2048, rateUpload: 0 })]);
    const cells = within(screen.getAllByRole("row")[1])
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(cells.slice(1, 7)).toEqual(["torrent-001", "Downloading", "1.5 KB", "12.35%", "2 KB/s", "0 B/s"]);
  });

  it("shows the error next to the status", () => {
    setup([makeTorrent(1, { error: 2, errorString: "Tracker gave HTTP 404" })]);
    const status = screen.getByText(/Downloading: Tracker gave HTTP 404/);
    expect(status.parentElement).toHaveAttribute("title", "Tracker gave HTTP 404");
  });

  it("says Error when the daemon gives no error text", () => {
    setup([makeTorrent(1, { status: 0, error: 3, errorString: "" })]);
    expect(screen.getByText("Stopped: Error")).toBeInTheDocument();
  });

  it("shows a placeholder row when empty", () => {
    setup([]);
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });

  it("colours each row by status and progress", () => {
    setup([makeTorrent(1, { status: 6, percentDone: 1 })]);
    expect(screen.getAllByRole("row")[1].getAttribute("style")).toContain("--seeding-h");
  });

  it("sorts by a column, toggling direction", async () => {
    const { user } = setup([makeTorrent(2), makeTorrent(3), makeTorrent(1)]);
    const sizeHeader = screen.getByRole("button", { name: "Size" });
    await user.click(sizeHeader);
    expect(visibleNames()).toEqual(["torrent-001", "torrent-002", "torrent-003"]);
    expect(sizeHeader.querySelector("svg.lucide-arrow-up")).not.toBeNull();
    await user.click(sizeHeader);
    expect(visibleNames()).toEqual(["torrent-003", "torrent-002", "torrent-001"]);
    expect(sizeHeader.querySelector("svg.lucide-arrow-down")).not.toBeNull();
  });

  describe("pagination", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => makeTorrent(i + 1));
    const pageButtons = () =>
      screen
        .getAllByRole("button")
        .filter((b) => /^\d+$/.test(b.textContent ?? ""))
        .map((b) => b.textContent);

    it("shows ten rows per page and moves between pages", async () => {
      const { user } = setup(many(25));
      expect(visibleNames()).toHaveLength(10);
      expect(pageButtons()).toEqual(["1", "2", "3"]);
      expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Next" }));
      expect(visibleNames()[0]).toBe("torrent-011");
      await user.click(screen.getByRole("button", { name: "3" }));
      expect(visibleNames()).toEqual(["torrent-021", "torrent-022", "torrent-023", "torrent-024", "torrent-025"]);
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    });

    it("collapses distant pages into an ellipsis", async () => {
      const { user } = setup(many(100));
      expect(pageButtons()).toEqual(["1", "2", "3", "10"]);
      expect(screen.getAllByText("...")).toHaveLength(1);

      await user.click(screen.getByRole("button", { name: "3" }));
      await user.click(screen.getByRole("button", { name: "5" }));
      expect(pageButtons()).toEqual(["1", "3", "4", "5", "6", "7", "10"]);
      expect(screen.getAllByText("...")).toHaveLength(2);
    });

    it("changes the page size", async () => {
      const { user } = setup(many(25));
      await user.click(screen.getByRole("combobox"));
      await user.click(await screen.findByRole("option", { name: "20" }));
      expect(visibleNames()).toHaveLength(20);
      expect(pageButtons()).toEqual(["1", "2"]);
    });
  });

  describe("row actions", () => {
    it.each([
      ["View Details", "viewTorrentDetails", [2]],
      ["Start", "startTorrent", [2]],
      ["Stop", "stopTorrent", [2]],
      ["Remove", "removeTorrent", [2]],
      ["Remove and Delete Data", "removeTorrent", [2, true]],
    ] as const)("%s calls %s", async (label, handler, args) => {
      const { user, meta } = setup([makeTorrent(1), makeTorrent(2)]);
      const row = screen.getByText("torrent-002").closest("tr")!;
      await user.click(within(row).getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByRole("menuitem", { name: label }));
      expect(meta[handler]).toHaveBeenCalledWith(...args);
    });
  });

  describe("selection", () => {
    it("selects single rows and the whole page", async () => {
      const { user, onSelection } = setup([makeTorrent(1), makeTorrent(2), makeTorrent(3)]);
      await user.click(screen.getAllByRole("checkbox", { name: "Select row" })[1]);
      expect(onSelection).toHaveBeenLastCalledWith(["2"]);
      await user.click(screen.getByRole("checkbox", { name: "Select all" }));
      expect(onSelection).toHaveBeenLastCalledWith(["1", "2", "3"]);
    });
  });
});

describe("navbar", () => {
  it("opens the add dialog", async () => {
    const { user, navbar } = setup([]);
    await user.click(iconButton("plus"));
    expect(navbar.onAddTorrentClick).toHaveBeenCalledOnce();
  });

  it("disables bulk actions until something is selected", async () => {
    const { user, navbar } = setup([makeTorrent(1)]);
    for (const icon of ["play", "pause", "trash-2", "circle-x"]) {
      expect(iconButton(icon)).toBeDisabled();
    }
    await user.click(screen.getByRole("checkbox", { name: "Select row" }));

    await user.click(iconButton("play"));
    await user.click(iconButton("pause"));
    await user.click(iconButton("trash-2"));
    await user.click(iconButton("circle-x"));
    expect(navbar.onStartSelected).toHaveBeenCalledOnce();
    expect(navbar.onStopSelected).toHaveBeenCalledOnce();
    expect(navbar.onRemoveSelected.mock.calls).toEqual([[false], [true]]);
  });

  it("filters by name", async () => {
    const { user } = setup([makeTorrent(1, { name: "debian.iso" }), makeTorrent(2, { name: "Ubuntu.iso" })]);
    await user.type(screen.getByPlaceholderText("Filter by name..."), "ubuntu");
    expect(visibleNames()).toEqual(["Ubuntu.iso"]);
  });

  it("filters by status", async () => {
    const { user } = setup([
      makeTorrent(1, { status: 0 }),
      makeTorrent(2, { status: 6 }),
      makeTorrent(3, { status: 6 }),
    ]);
    await user.click(screen.getByRole("button", { name: "Status: All" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Seeding" }));
    expect(visibleNames()).toEqual(["torrent-002", "torrent-003"]);
    expect(screen.getByRole("button", { name: "Status: Seeding" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Status: Seeding" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "All" }));
    expect(visibleNames()).toHaveLength(3);
  });

  it("hides and shows columns", async () => {
    const { user } = setup([makeTorrent(1)]);
    expect(screen.getByRole("button", { name: "Up Speed" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Columns" }));
    const toggle = await screen.findByRole("menuitemcheckbox", { name: "Up Speed" });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(screen.queryByRole("button", { name: "Up Speed" })).not.toBeInTheDocument();
  });

  it("does not offer to hide the selection column", async () => {
    const { user } = setup([makeTorrent(1)]);
    await user.click(screen.getByRole("button", { name: "Columns" }));
    const items = await screen.findAllByRole("menuitemcheckbox");
    expect(items.map((i) => i.textContent)).toEqual([
      "Name",
      "Status",
      "Size",
      "Progress",
      "Down Speed",
      "Up Speed",
      "Actions",
    ]);
  });
});
