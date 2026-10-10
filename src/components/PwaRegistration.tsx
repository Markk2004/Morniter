"use client";

import { useEffect } from "react";

export default function PwaRegistration() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("PWA Service Worker registered:", reg.scope);
          // Check for service worker updates immediately
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.error("Service worker registration failed:", err);
        });

      // When a new service worker takes over, clear session and reload
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          try {
            sessionStorage.clear();
          } catch {}
          window.location.reload();
        }
      });
    }
  }, []);

  return null;
}
