"use client";

import { useContext } from "react";
import { UserContext } from "@/providers/UserProvider";

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used inside UserProvider");
  return context;
}
