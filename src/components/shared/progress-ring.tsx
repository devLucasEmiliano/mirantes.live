interface ProgressRingProps {
  /** 0–100 */
  value: number;
  /** Diâmetro em px. */
  size?: number;
  strokeWidth?: number;
  /** Cor do arco (CSS color). */
  color?: string;
  /** Texto central; default `${value}%`. */
  label?: string;
}

/**
 * Anel de progresso em SVG puro (sem lib de gráfico — fora da stack).
 * Usado nos cards "Progresso Total", "Saúde do Projeto" e "Uptime Total".
 */
export function ProgressRing({
  value,
  size = 88,
  strokeWidth = 8,
  color = "var(--color-accent-primary)",
  label,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${value}%`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-elevated)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-lg font-bold text-foreground-primary">
        {label ?? `${value}%`}
      </span>
    </div>
  );
}
