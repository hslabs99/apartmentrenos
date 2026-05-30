import { AppShell } from "@/components/app-shell";
import { ViewModeProvider } from "@/lib/view-mode";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewModeProvider>
      <AppShell>{children}</AppShell>
    </ViewModeProvider>
  );
}
