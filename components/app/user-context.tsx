"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SessionUser } from "@/lib/insforge/server";

const UserContext = createContext<SessionUser | null>(null);

export function UserProvider({ user, children }: { user: SessionUser | null; children: ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export const useUser = () => useContext(UserContext);
