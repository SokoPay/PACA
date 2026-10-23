"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/api";

export const AdminSessionContext = createContext<SessionUser | null>(null);

/** The admin layout guarantees a non-MEMBER session before rendering children. */
export function useAdminSession(): SessionUser {
  const user = useContext(AdminSessionContext);
  if (!user) throw new Error("useAdminSession() called outside the admin layout");
  return user;
}
