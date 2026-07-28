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

  it("keeps the password input accessible and the submit state explicit", () => {
    render(<LoginPage />);

    const input = screen.getByLabelText(/group password/i);
    const button = screen.getByRole("button", { name: /sign in/i });

    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "current-password");
    expect(input).toHaveAttribute("aria-describedby", "group-password-help");
    expect(button).toBeDisabled();
  });

  it("does not use gradient classes on the login surface", () => {
    const { container } = render(<LoginPage />);
    expect(container.querySelector('[class*="gradient"]')).toBeNull();
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

    expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials");

    vi.unstubAllGlobals();
  });
});
