import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Row } from "@tanstack/react-table";
import { Torrent } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export const getStatusText = (status: number) => {
  switch (status) {
    case 0:
      return "Stopped";
    case 1:
      return "Queued to check";
    case 2:
      return "Checking";
    case 3:
      return "Queued to download";
    case 4:
      return "Downloading";
    case 5:
      return "Queued to seed";
    case 6:
      return "Seeding";
    default:
      return "Unknown";
  }
};

export const getRowStyle = (row: Row<Torrent>) => {
  const { status, percentDone } = row.original;
  const percent = percentDone * 100;

  let color: string;

  switch (status) {
    case 4: // Downloading
      color = `linear-gradient(to right, hsl(var(--downloading-h) var(--downloading-s) var(--downloading-l)) ${percent}%, transparent ${percent}%)`;
      break;
    case 5: // Queued to seed
    case 6: // Seeding
      color = `linear-gradient(to right, hsl(var(--seeding-h) var(--seeding-s) var(--seeding-l)) ${percent}%, transparent ${percent}%)`;
      break;
    case 0: // Stopped
    default:
      color = `linear-gradient(to right, hsl(var(--stopped-h) var(--stopped-s) var(--stopped-l)) ${percent}%, transparent ${percent}%)`;
      break;
  }

  return { background: color };
};

export const statuses = [
  "All",
  "Stopped",
  "Queued to check",
  "Checking",
  "Queued to download",
  "Downloading",
  "Queued to seed",
  "Seeding"
];

export const statusMap: { [key: string]: number | undefined } = {
  "All": undefined,
  "Stopped": 0,
  "Queued to check": 1,
  "Checking": 2,
  "Queued to download": 3,
  "Downloading": 4,
  "Queued to seed": 5,
  "Seeding": 6
};

export const statusReverseMap: { [key: number]: string } = {
  0: "Stopped",
  1: "Queued to check",
  2: "Checking",
  3: "Queued to download",
  4: "Downloading",
  5: "Queued to seed",
  6: "Seeding"
};

export const columnHeaderNames: { [key: string]: string } = {
  name: "Name",
  status: "Status",
  totalSize: "Size",
  percentDone: "Progress",
  rateDownload: "Down Speed",
  rateUpload: "Up Speed",
  actions: "Actions"
};

export function validateDestination(path: string): string {
  if (!path) return "";
  const isPosix = /^\/.+/.test(path);
  const isWindowsDrive = /^[A-Za-z]:[\\/].*/.test(path);
  const isUnc = /^\\\\[^\\]+\\.+/.test(path);
  if (!isPosix && !isWindowsDrive && !isUnc) {
    return String.raw`Path must be absolute (e.g. /downloads or C:\Downloads)`;
  }
  return "";
}

export function errorMessage(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}
