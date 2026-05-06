import { auth } from "@/lib/auth";
import { getUserRole, isTicketOwner } from "@/lib/user-role";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const MESSAGES_ROUTE = "/messages";
const STAFF_OVERVIEW_ROUTE = "/users/staff";
const STAFF_ROUTES = ["/tickets", "/users"];

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

  const isMessagesRoute = pathname === MESSAGES_ROUTE || pathname.startsWith(MESSAGES_ROUTE + "/")

  if (isMessagesRoute) {
    const result = await getUserRole(session.user.id)

    if (!result || !result.capabilities.canAccessMessagesPage) {
      return NextResponse.redirect(new URL("/my-tickets", request.url))
    }
  }

  const isStaffOverviewRoute = pathname === STAFF_OVERVIEW_ROUTE || pathname.startsWith(STAFF_OVERVIEW_ROUTE + "/")

  if (isStaffOverviewRoute) {
    const result = await getUserRole(session.user.id)

    if (!result) {
      return NextResponse.redirect(new URL("/my-tickets", request.url))
    }

    if (!result.capabilities.canAccessStaffOverview) {
      const fallbackPath = result.capabilities.canAccessUsersPage ? "/users" : "/my-tickets"
      return NextResponse.redirect(new URL(fallbackPath, request.url))
    }
  }

  const isStaffRoute = STAFF_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  )

  if (isStaffRoute) {
    const result = await getUserRole(session.user.id)

    if (!result) {
      return NextResponse.redirect(new URL("/my-tickets", request.url))
    }

    if (pathname === "/users" || pathname.startsWith("/users/")) {
      if (!result.capabilities.canAccessUsersPage) {
        return NextResponse.redirect(new URL("/my-tickets", request.url))
      }
    } else if (pathname === "/tickets" || pathname.startsWith("/tickets/")) {
      if (!result.capabilities.canAccessTicketsPage) {
        return NextResponse.redirect(new URL("/my-tickets", request.url))
      }
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
