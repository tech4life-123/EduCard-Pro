import { requireUser } from "@/lib/auth";

/** Everything under /app needs a signed-in user. (Real checks run here, not only in the proxy.) */
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  await requireUser();
  return <>{children}</>;
}
