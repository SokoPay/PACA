"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, restoreSession, subscribeSession, type SessionUser } from "@/lib/api";

/**
 * The signed-in user, shared by every component (undefined while still checking).
 * Updates live on sign-in, sign-out and email verification.
 */
export function useSession(): SessionUser | null | undefined {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = subscribeSession(setUser);
    const known = getCurrentUser();
    if (known !== undefined) setUser(known);
    else restoreSession().catch(() => setUser(null));
    return unsubscribe;
  }, []);

  return user;
}
