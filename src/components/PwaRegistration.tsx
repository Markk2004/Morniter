"use client";

import { useEffect } from "react";

export default function PwaRegistration() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("PWA Service Worker registered:", reg.scope);
        })
        .catch((err) => {
          console.error("Service worker registration failed:", err);
        });
    }
  }, []);

  return null;
}
