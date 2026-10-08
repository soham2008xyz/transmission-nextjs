import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

function renderToggle() {
  render(
    <ThemeProvider attribute='class' defaultTheme='system' enableSystem>
      <ThemeToggle />
    </ThemeProvider>,
  );
  return userEvent.setup();
}

describe("ThemeToggle", () => {
  it("shows the current theme", () => {
    renderToggle();
    expect(screen.getByRole("button", { name: "System" })).toBeInTheDocument();
  });

  it.each([
    ["Dark", "dark"],
    ["Light", "light"],
  ])("switches to %s and remembers it", async (label, theme) => {
    const user = renderToggle();
    await user.click(screen.getByRole("button", { name: "System" }));
    await user.click(await screen.findByRole("menuitem", { name: label }));
    expect(await screen.findByRole("button", { name: label })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass(theme);
    expect(localStorage.getItem("theme")).toBe(theme);
  });

  it("switches back to the system theme", async () => {
    localStorage.setItem("theme", "dark");
    const user = renderToggle();
    await user.click(screen.getByRole("button", { name: "Dark" }));
    await user.click(await screen.findByRole("menuitem", { name: "System" }));
    expect(await screen.findByRole("button", { name: "System" })).toBeInTheDocument();
    expect(localStorage.getItem("theme")).toBe("system");
  });
});
