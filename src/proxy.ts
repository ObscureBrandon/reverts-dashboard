import { auth } from "@/lib/auth";
import { getUserRole, isTicketOwner } from "@/lib/user-role";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Routes only accessible to mods
const MOD_ONLY_ROUTES = ["/tickets", "/users", "/messages"];

function getTicketDetailId(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length !== 2 || segments[0] !== 'tickets') {
    return null
  }

  const ticketId = Number.parseInt(segments[1], 10)

  return Number.isInteger(ticketId) && ticketId > 0 ? ticketId : null
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow public routes and static files
  if ((pathname !== "/") && (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    // Allow all static files (PNG, SVG, ICO, etc.)
    pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|xml|json)$/)
  )) {
    return NextResponse.next();
  }

  // Check for valid session
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  // Redirect to login if no session
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const ticketDetailId = getTicketDetailId(pathname)

  if (ticketDetailId !== null) {
    const result = await getUserRole(session.user.id)

    if (!result) {
      return NextResponse.redirect(new URL('/my-tickets', request.url))
    }

    if (result.role !== 'mod') {
      const ownsTicket = await isTicketOwner(result.discordId, ticketDetailId)

      if (!ownsTicket) {
        return NextResponse.redirect(new URL('/my-tickets', request.url))
      }
    }

    return NextResponse.next()
  }

  // Redirect non-mods away from mod-only routes
  const isModOnlyRoute = MOD_ONLY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isModOnlyRoute) {
    const result = await getUserRole(session.user.id);
    if (!result || result.role !== "mod") {
      return NextResponse.redirect(new URL("/my-tickets", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     */
    "/((?!_next/static|_next/image).*)",
  ],
};
