import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session cookie and does an optimistic redirect for signed-out
 * visitors. It is NOT the authorization boundary: every page and Server Action re-checks the
 * user server-side, and RLS enforces tenant isolation in the database.
 * Public routes (/verify/*) skip it so verification stays fast and cookie-free.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const { pathname, search } = request.nextUrl;

  const redirectTo = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    // Keep any refreshed session cookies on the redirect response.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!data.user && (pathname === "/app" || pathname.startsWith("/app/"))) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return redirectTo(url);
  }
  if (data.user && (pathname === "/login" || pathname === "/signup")) {
    return redirectTo(new URL("/app", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!verify/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
