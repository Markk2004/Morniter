// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { RecipeBuilder } from "@/components/playwright-runner/recipe/RecipeBuilder";
import type { RecipeDraft, ReusableFlow } from "@/lib/playwright-runner/recipe-types";

afterEach(() => {
  cleanup();
});

describe("RecipeBuilder Component", () => {
  const initialDraft: RecipeDraft = {
    id: "recipe-login-check",
    title: "Login check",
    functionId: "FN-STS-01",
    output: "frontend/e2e/generated/fn-sts-01/login.spec.ts",
    risk: "read-only",
    actions: [
      { kind: "goto", url: "/login" },
    ],
  };

  const flows: ReusableFlow[] = [
    {
      id: "flow-login-uat",
      name: "Login as UAT user",
      actions: [
        { kind: "goto", url: "/login" },
      ],
    },
  ];

  it("renders initial draft fields and actions", () => {
    const onChange = vi.fn();
    render(
      <RecipeBuilder
        draft={initialDraft}
        flows={flows}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("Login check")).toBeInTheDocument();
    expect(screen.getByDisplayValue("/login")).toBeInTheDocument();
    expect(screen.getByText(/Add Action/i)).toBeInTheDocument();
  });

  it("allows adding and modifying actions", () => {
    const onChange = vi.fn();
    render(
      <RecipeBuilder
        draft={initialDraft}
        flows={flows}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Add Action/i }));
    expect(onChange).toHaveBeenCalled();
  });

  it("shows cleanup actions section when risk is mutating", () => {
    const mutatingDraft: RecipeDraft = {
      ...initialDraft,
      risk: "mutating",
      cleanupActions: [{ kind: "goto", url: "/cleanup" }],
    };

    render(
      <RecipeBuilder
        draft={mutatingDraft}
        flows={flows}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Cleanup Actions/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("/cleanup")).toBeInTheDocument();
  });

  it("enables Save as Automated Test only when draft is verified passing", () => {
    const onSave = vi.fn();
    const onRunDraft = vi.fn();

    // 1. Unverified draft -> Save button disabled
    const { rerender } = render(
      <RecipeBuilder
        draft={initialDraft}
        flows={flows}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onSave={onSave}
        onRunDraft={onRunDraft}
        isDraftVerified={false}
      />,
    );

    const saveBtn = screen.getByRole("button", { name: /Save as Automated Test/i });
    expect(saveBtn).toBeDisabled();
    expect(screen.getByText(/Unverified/i)).toBeInTheDocument();

    // 2. Verified passing draft -> Save button enabled
    rerender(
      <RecipeBuilder
        draft={initialDraft}
        flows={flows}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onSave={onSave}
        onRunDraft={onRunDraft}
        isDraftVerified={true}
      />,
    );

    expect(saveBtn).not.toBeDisabled();
    expect(screen.getByText(/Verified Passing/i)).toBeInTheDocument();
    fireEvent.click(saveBtn);
    expect(onSave).toHaveBeenCalled();
  });
});
