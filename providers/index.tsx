"use client";
import type { ReactNode } from "react";
import { UserProvider } from "./UserProvider";
export default function Providers({ children }: { children: ReactNode }) { return <UserProvider>{children}</UserProvider>; }
