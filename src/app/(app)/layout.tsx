import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { ViewModeProvider } from "@/lib/view-mode";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewModeProvider>
      <AuthGuard>
        <AppShell>{children}</AppShell>
      </AuthGuard>
    </ViewModeProvider>
  );
}
