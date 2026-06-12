"use client";

import { createAuthClient } from "better-auth/react";

/** Browser-side auth client. Server-side lives in lib/auth.ts. */
export const authClient = createAuthClient({});

export const { useSession, signIn, signUp, signOut } = authClient;
