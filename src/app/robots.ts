import type { MetadataRoute } from "next";

/** Only the public landing page is indexable; the app and verification results never are. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/verify/", "/auth/", "/api/"] }] };
}
