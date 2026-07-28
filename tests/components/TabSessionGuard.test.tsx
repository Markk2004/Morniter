// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import TabSessionGuard from "@/components/auth/TabSessionGuard";
import { TAB_SESSION_STORAGE_KEY } from "@/lib/auth/tab-session";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

describe("TabSessionGuard", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    replaceMock.mockClear();
  });

  it("requires login when the tab has no session marker", async () => {
    render(<TabSessionGuard />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login?reason=tab-expired");
    });
  });

  it("keeps the current tab active when its marker exists", async () => {
    sessionStorage.setItem(TAB_SESSION_STORAGE_KEY, "active-tab");

    render(<TabSessionGuard />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(replaceMock).not.toHaveBeenCalled();
  });
});
