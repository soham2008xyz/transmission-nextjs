import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialogProps } from "@/lib/types";

export function ConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  destructive = false,
}: Readonly<ConfirmationDialogProps>) {
  const [pending, setPending] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);

  // The parent can close the dialog through `open` without calling
  // onOpenChange, so drop a stale error whenever it closes.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setError(null);
  }

  const handleConfirm = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (pending) return;
    if (!next) setError(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() => void handleConfirm()}
          >
            {pending ? "Working..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
