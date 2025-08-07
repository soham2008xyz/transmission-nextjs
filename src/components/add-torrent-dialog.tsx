import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getFreeSpace } from "@/lib/transmission";

interface AddTorrentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (
    magnetLink: string,
    torrentFile: File | null,
    destination: string
  ) => Promise<void>;
  error?: string;
}

async function fetchDiskSpace(
  path: string
): Promise<{ free: number; total: number } | null> {
  if (!path) return null;
  try {
    return await getFreeSpace(path);
  } catch {
    return null;
  }
}

export function AddTorrentDialog({
  open,
  onOpenChange,
  onAdd,
  error
}: AddTorrentDialogProps) {
  const [magnetLink, setMagnetLink] = useState("");
  const [torrentFile, setTorrentFile] = useState<File | null>(null);
  const [destination, setDestination] = useState("");
  const [localError, setLocalError] = useState("");
  const [diskSpace, setDiskSpace] = useState<{
    free: number;
    total: number;
  } | null>(null);
  const [diskLoading, setDiskLoading] = useState(false);

  useEffect(() => {
    if (!destination) {
      setDiskSpace(null);
      return;
    }
    setDiskLoading(true);
    fetchDiskSpace(destination).then((info) => {
      setDiskSpace(info);
      setDiskLoading(false);
    });
  }, [destination]);

  const validateDestination = (path: string) => {
    if (!path) return "";
    // Example: must start with / and be at least 2 chars
    if (!/^\/.+/.test(path)) return "Path must start with /";
    if (path.length < 2) return "Path is too short";
    return "";
  };

  const handleAdd = async () => {
    setLocalError("");
    const destError = validateDestination(destination);
    if (destError) {
      setLocalError(destError);
      return;
    }
    if (!magnetLink && !torrentFile) {
      setLocalError("Please provide a magnet link or select a file.");
      return;
    }
    await onAdd(magnetLink, torrentFile, destination);
    setMagnetLink("");
    setTorrentFile(null);
    setDestination("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Torrent</DialogTitle>
          <DialogDescription>
            Add a torrent by magnet link or upload a .torrent file.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <Input
            placeholder='Magnet link'
            value={magnetLink}
            onChange={(e) => setMagnetLink(e.target.value)}
          />
          <div>or</div>
          <Input
            type='file'
            accept='.torrent'
            onChange={(e) => setTorrentFile(e.target.files?.[0] || null)}
          />
          <Input
            placeholder='Destination path (optional)'
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          {diskLoading && destination && (
            <div className='text-xs text-muted-foreground'>
              Checking disk space...
            </div>
          )}
          {diskSpace && (
            <div className='text-xs text-muted-foreground'>
              Free: {formatBytes(diskSpace.free)} / Total:{" "}
              {formatBytes(diskSpace.total)}
            </div>
          )}
          {(localError || error) && (
            <div className='text-destructive text-sm'>
              {localError || error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleAdd}>Add</Button>
          <DialogClose asChild>
            <Button variant='outline'>Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
