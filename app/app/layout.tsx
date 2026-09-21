import { AppShell } from "@/components/app/app-shell";
import { UserProvider } from "@/components/app/user-context";
import { getSessionUser } from "@/lib/insforge/server";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await getSessionUser();
  return (
    <UserProvider user={user}>
      <AppShell user={user}>{children}</AppShell>
    </UserProvider>
  );
}
