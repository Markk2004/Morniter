// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";

afterEach(() => {
  cleanup();
});

describe("PwaInstallPrompt", () => {
  it("shows the desktop install button when the browser supports installation", async () => {
    render(<PwaInstallPrompt />);

    const installEvent = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    });

    fireEvent(window, installEvent);

    const button = await screen.findByRole("button", { name: "Install app" });
    expect(button).toBeInTheDocument();
    expect(installEvent.defaultPrevented).toBe(true);

    fireEvent.click(button);

    await waitFor(() => {
      expect(installEvent.prompt).toHaveBeenCalledOnce();
      expect(screen.queryByRole("button", { name: "Install app" })).not.toBeInTheDocument();
    });
  });
});
