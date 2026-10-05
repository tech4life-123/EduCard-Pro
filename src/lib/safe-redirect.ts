/**
 * Only allow same-site relative paths as post-login redirect targets.
 * Blocks "//evil.com", "/\evil.com", absolute URLs and anything not starting with "/app".
 */
export function safeNext(value: unknown, fallback = "/app"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (value !== "/app" && !value.startsWith("/app/") && !value.startsWith("/app?")) return fallback;
  return value;
}
