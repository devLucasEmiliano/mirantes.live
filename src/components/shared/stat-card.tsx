import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Card de estatística do design: fundo branco, raio 4px, título
 * Funnel Sans 13/500 com tracking. O conteúdo (valor, ring, barra)
 * vem dos filhos para acomodar as variações de cada card.
 */
export function StatCard({ title, className, children }: StatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-3 rounded-sm bg-surface-card p-5",
        className,
      )}
    >
      <span className="font-display text-[13px] font-medium tracking-[0.3px] text-foreground-muted">
        {title}
      </span>
      {children}
    </div>
  );
}
