import { auth } from "./auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Server-side helper to check if user is authenticated
 * Returns session if authenticated, or null if not
 */
export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  return session;
}

/**
 * Helper to require authentication in API routes
 * Returns the session if authenticated, or a 401 response if not
 */
export async function requireAuth() {
  const session = await getSession();
  
  if (!session) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      ),
      session: null,
    };
  }
  
  return { session, error: null };
}
