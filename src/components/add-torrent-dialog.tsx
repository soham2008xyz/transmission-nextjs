import React, { useState, useEffect, useRef } from "react";
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
import { formatBytes, validateDestination } from "@/lib/utils";
import { AddTorrentDialogProps } from "@/lib/types";
import { MAX_TORRENT_FILE_BYTES } from "@/lib/limits";

const FREE_SPACE_DEBOUNCE_MS = 400;

const tooLargeMessage = (file: File) =>
  `${file.name} is ${formatBytes(file.size)}. .torrent files can be at most ${formatBytes(MAX_TORRENT_FILE_BYTES)}.`;

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
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!destination) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale disk info when the field empties
      setDiskSpace(null);
      setDiskLoading(false);
      return;
    }
    // Wait for typing to pause, and ignore replies for an older path.
    let stale = false;
    setDiskLoading(true);
    const timer = setTimeout(() => {
      getFreeSpace(destination)
        .then((info) => {
          if (stale) return;
          setDiskSpace(info);
          setDiskLoading(false);
        })
        .catch(() => {
          if (stale) return;
          setDiskSpace(null);
          setDiskLoading(false);
        });
    }, FREE_SPACE_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [destination]);

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
    if (!magnetLink && torrentFile && torrentFile.size > MAX_TORRENT_FILE_BYTES) {
      setLocalError(tooLargeMessage(torrentFile));
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const added = await onAdd(magnetLink, torrentFile, destination);
      if (!added) return;
      setMagnetLink("");
      setTorrentFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setDestination("");
    } finally {
      setSubmitting(false);
    }
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
            ref={fileInputRef}
            type='file'
            accept='.torrent'
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setTorrentFile(file);
              setLocalError(file && file.size > MAX_TORRENT_FILE_BYTES ? tooLargeMessage(file) : "");
            }}
          />
          <Input
            placeholder='Destination path (optional)'
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          {magnetLink && torrentFile && (
            <div className='text-xs text-muted-foreground'>
              Both a magnet link and a file are set. Only the magnet link will
              be added.
            </div>
          )}
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
          <Button onClick={handleAdd} disabled={submitting}>
            {submitting ? "Adding..." : "Add"}
          </Button>
          <DialogClose asChild>
            <Button variant='outline'>Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
