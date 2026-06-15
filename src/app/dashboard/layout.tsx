import { Sidebar } from "@/components/layout/sidebar";

/**
 * Shell das telas autenticadas: sidebar escura fixa de 240px + área
 * principal. O header fica em cada página (título/breadcrumb próprios).
 */
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh flex-1 bg-surface-primary">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
