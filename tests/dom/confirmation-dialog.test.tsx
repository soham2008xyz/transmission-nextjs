import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmationDialog } from "@/components/confirmation-dialog";

function setup(onConfirm: () => void | Promise<void> = vi.fn(), destructive = false) {
  const onOpenChange = vi.fn();
  render(
    <ConfirmationDialog
      open
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title='Remove ubuntu.iso?'
      description='The data will remain on disk.'
      destructive={destructive}
    />,
  );
  return { user: userEvent.setup(), onOpenChange };
}

describe("ConfirmationDialog", () => {
  it("shows the title and description", () => {
    setup();
    expect(screen.getByRole("dialog", { name: "Remove ubuntu.iso?" })).toBeInTheDocument();
    expect(screen.getByText("The data will remain on disk.")).toBeInTheDocument();
  });

  it("calls onConfirm when confirmed", async () => {
    const onConfirm = vi.fn();
    const { user } = setup(onConfirm);
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("closes on Cancel without confirming", async () => {
    const onConfirm = vi.fn();
    const { user, onOpenChange } = setup(onConfirm);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("styles the confirm button as destructive when asked", () => {
    setup(vi.fn(), true);
    expect(screen.getByRole("button", { name: "Confirm" }).className).toMatch(/destructive/);
  });

  it("locks the dialog while the action runs", async () => {
    let finish!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { user, onOpenChange } = setup(onConfirm);

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    const working = screen.getByRole("button", { name: "Working..." });
    expect(working).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    // Escape must not close it, and a second click must not run it again.
    await user.keyboard("{Escape}");
    await user.click(working);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledOnce();

    finish();
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled());
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the dialog open and shows the error when onConfirm rejects", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      const onConfirm = vi.fn().mockRejectedValue(new Error("Daemon unreachable"));
      const { user, onOpenChange } = setup(onConfirm);

      await user.click(screen.getByRole("button", { name: "Confirm" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Daemon unreachable");
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();

      // Let any stray rejection surface before asserting.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).not.toHaveBeenCalled();

      // Retrying clears the message while the action runs.
      onConfirm.mockImplementationOnce(() => new Promise<void>(() => {}));
      await user.click(screen.getByRole("button", { name: "Confirm" }));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  it("clears the error when the parent closes the dialog through `open`", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("Daemon unreachable"));
    const props = {
      onOpenChange: vi.fn(),
      onConfirm,
      title: "Remove ubuntu.iso?",
      description: "The data will remain on disk.",
    };
    const user = userEvent.setup();
    const { rerender } = render(<ConfirmationDialog open {...props} />);

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Daemon unreachable");

    rerender(<ConfirmationDialog open={false} {...props} />);
    rerender(<ConfirmationDialog open {...props} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
