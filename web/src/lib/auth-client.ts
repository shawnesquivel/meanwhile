"use client";

import { createAuthClient } from "better-auth/react";

/** Browser-side auth client. Base URL defaults to the current origin. */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
