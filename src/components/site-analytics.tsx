"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Visitor counting (Vercel Web Analytics: no cookies, no personal data).
 * The QR token is part of a verification link, so it is removed from the address before anything is
 * recorded, and signed-in app pages are not counted.
 */
function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);
    if (url.pathname.startsWith("/app")) return null;
    if (url.pathname.startsWith("/verify/")) {
      url.pathname = "/verify/[code]";
      url.search = "";
      return { ...event, url: url.toString() };
    }
    url.search = "";
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}

export function SiteAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
