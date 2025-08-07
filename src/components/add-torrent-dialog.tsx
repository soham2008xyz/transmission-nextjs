import React, { useState } from "react";
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

interface AddTorrentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (magnetLink: string, torrentFile: File | null) => Promise<void>;
  error?: string;
}

export function AddTorrentDialog({
  open,
  onOpenChange,
  onAdd,
  error
}: AddTorrentDialogProps) {
  const [magnetLink, setMagnetLink] = useState("");
  const [torrentFile, setTorrentFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState("");

  const handleAdd = async () => {
    setLocalError("");
    if (!magnetLink && !torrentFile) {
      setLocalError("Please provide a magnet link or select a file.");
      return;
    }
    await onAdd(magnetLink, torrentFile);
    setMagnetLink("");
    setTorrentFile(null);
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
