import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

/**
 * Shell das telas autenticadas: sidebar escura fixa de 240px + área principal.
 * Resolve o usuário pelo DAL (verificação real no banco) e o repassa ao sidebar;
 * sem sessão válida → /login. O `proxy.ts` já faz o gate ótimista por assinatura.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Nome + foto do perfil p/ o chip da sidebar (mantém `getCurrentUser` enxuto — não
  // carrega name/avatar). Query leve: só a flag/updatedAt do avatar, nunca o blob.
  const profile = await db.user.findUnique({
    where: { id: user.id },
    select: { name: true, avatar: { select: { updatedAt: true } } },
  });

  return (
    <div className="flex min-h-dvh flex-1 bg-surface-primary">
      <Sidebar
        user={{
          email: user.email,
          role: user.role,
          name: profile?.name ?? null,
          hasAvatar: profile?.avatar != null,
          avatarVersion: profile?.avatar?.updatedAt.getTime() ?? 0,
        }}
      />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
