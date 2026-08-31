import React from "react";
import type { TutorialIconName } from "./tutorial-steps";

interface TutorialIconProps {
  name: TutorialIconName;
  className?: string;
}

export default function TutorialIcon({ name, className = "w-5 h-5" }: TutorialIconProps) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": "true" as const,
    className,
  };

  switch (name) {
    case "agent":
      return (
        <svg {...commonProps}>
          {/* Server / agent desktop tower with status light */}
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <line x1="8" y1="6" x2="8.01" y2="6" strokeWidth={2.5} />
          <line x1="12" y1="6" x2="16" y2="6" />
          <line x1="8" y1="10" x2="8.01" y2="10" strokeWidth={2.5} />
          <line x1="12" y1="10" x2="16" y2="10" />
          <line x1="4" y1="16" x2="20" y2="16" />
          <circle cx="12" cy="18.5" r="1" fill="currentColor" />
        </svg>
      );

    case "lock":
      return (
        <svg {...commonProps}>
          {/* Padlock */}
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          <circle cx="12" cy="16" r="1.5" />
        </svg>
      );

    case "project":
      return (
        <svg {...commonProps}>
          {/* Folder with hierarchy / project book */}
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      );

    case "test":
      return (
        <svg {...commonProps}>
          {/* Checklist with checkboxes */}
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          <line x1="7" y1="11" x2="7.01" y2="11" strokeWidth={2} />
          <line x1="7" y1="16" x2="15" y2="16" />
        </svg>
      );

    case "browser":
      return (
        <svg {...commonProps}>
          {/* Browser window with address bar */}
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <circle cx="6" cy="6.5" r="0.75" fill="currentColor" />
          <circle cx="8.5" cy="6.5" r="0.75" fill="currentColor" />
          <circle cx="11" cy="6.5" r="0.75" fill="currentColor" />
        </svg>
      );

    case "code":
      return (
        <svg {...commonProps}>
          {/* Code brackets */}
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
          <line x1="14" y1="4" x2="10" y2="20" />
        </svg>
      );

    case "run":
      return (
        <svg {...commonProps}>
          {/* Play arrow in circle / action */}
          <circle cx="12" cy="12" r="10" />
          <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
        </svg>
      );

    case "terminal":
      return (
        <svg {...commonProps}>
          {/* Terminal prompt with cursor */}
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <polyline points="7 10 10 13 7 16" />
          <line x1="13" y1="16" x2="17" y2="16" strokeWidth={2} />
        </svg>
      );

    case "result":
      return (
        <svg {...commonProps}>
          {/* Bar chart with checkmark badge */}
          <path d="M3 3v18h18" />
          <rect x="7" y="10" width="3" height="8" rx="0.5" />
          <rect x="12" y="6" width="3" height="12" rx="0.5" />
          <rect x="17" y="13" width="3" height="5" rx="0.5" />
        </svg>
      );
  }
}
