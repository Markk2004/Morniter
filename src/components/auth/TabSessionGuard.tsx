"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { TAB_SESSION_STORAGE_KEY } from "@/lib/auth/tab-session";

export function TabSessionGuard() {
  const router = useRouter();
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    let marker: string | null = null;
    try {
      marker = window.sessionStorage.getItem(TAB_SESSION_STORAGE_KEY);
    } catch {
      marker = null;
    }

    if (!marker) {
      router.replace("/login?reason=tab-expired");
    }
  }, [router]);

  return null;
}

export default TabSessionGuard;
