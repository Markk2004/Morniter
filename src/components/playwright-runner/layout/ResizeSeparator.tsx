"use client";

import React, { useRef, useCallback, useEffect } from "react";

export interface ResizeSeparatorProps {
  orientation: "vertical" | "horizontal";
  value: number;
  min: number;
  max: number;
  resetValue: number;
  label: string;
  onChange: (value: number) => void;
}

const STEP_SIZE = 16;

export function ResizeSeparator({
  orientation,
  value,
  min,
  max,
  resetValue,
  label,
  onChange,
}: ResizeSeparatorProps) {
  const isDraggingRef = useRef(false);
  const startPosRef = useRef(0);
  const startValRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    startPosRef.current = orientation === "vertical" ? e.clientX : e.clientY;
    startValRef.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const currentPos = orientation === "vertical" ? e.clientX : e.clientY;
    const delta = orientation === "vertical"
      ? currentPos - startPosRef.current
      : startPosRef.current - currentPos; // For bottom-pinned terminal, dragging up increases height

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const next = Math.min(max, Math.max(min, Math.round(startValRef.current + delta)));
      onChange(next);
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (orientation === "vertical") {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onChange(Math.min(max, Math.max(min, value + STEP_SIZE)));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onChange(Math.min(max, Math.max(min, value - STEP_SIZE)));
      } else if (e.key === "Home") {
        e.preventDefault();
        onChange(min);
      } else if (e.key === "End") {
        e.preventDefault();
        onChange(max);
      }
    } else {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onChange(Math.min(max, Math.max(min, value + STEP_SIZE)));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        onChange(Math.min(max, Math.max(min, value - STEP_SIZE)));
      } else if (e.key === "Home") {
        e.preventDefault();
        onChange(min);
      } else if (e.key === "End") {
        e.preventDefault();
        onChange(max);
      }
    }
  };

  const handleDoubleClick = useCallback(() => {
    onChange(resetValue);
  }, [onChange, resetValue]);

  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={label}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        onDoubleClick={handleDoubleClick}
        title={`${label} (Double-click to reset)`}
        className="w-3 flex items-center justify-center cursor-col-resize select-none touch-none group outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded"
      >
        <div className="w-[1px] h-full bg-slate-800 group-hover:bg-indigo-500 group-focus-visible:bg-indigo-400 transition-colors" />
      </div>
    );
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="horizontal"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      onDoubleClick={handleDoubleClick}
      title={`${label} (Double-click to reset)`}
      className="h-3 w-full flex items-center justify-center cursor-row-resize select-none touch-none group outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded my-0.5"
    >
      <div className="h-[1px] w-full bg-slate-800 group-hover:bg-indigo-500 group-focus-visible:bg-indigo-400 transition-colors" />
    </div>
  );
}
