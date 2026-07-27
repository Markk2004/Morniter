// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import LoginPage from "@/app/login/page";

describe("LoginPage UI", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders group password field and submit button", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/group password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("submits password to /api/auth/login and shows error on failure", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid credentials" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<LoginPage />);

    const input = screen.getByLabelText(/group password/i);
    const submitBtn = screen.getByRole("button", { name: /sign in/i });

    fireEvent.change(input, { target: { value: "wrongpass" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });
});
