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

  const [error, setError] = useState<{ session: number; message: string } | null>(null);
  const [session, setSession] = useState(0);
  const [prevOpen, setPrevOpen] = useState(open);

  // Each close starts a new session, including a close the parent makes through
  // `open` without calling onOpenChange. An error only shows in the session
  // that raised it, so a rejection settling after a close stays hidden.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setSession((s) => s + 1);
  }

  const handleConfirm = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError({
        session,
        message: err instanceof Error && err.message ? err.message : "Something went wrong.",
      });
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
        {error?.session === session && (
          <p role="alert" className="text-sm text-destructive">
            {error.message}
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
