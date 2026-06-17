// Formatação pura de datas p/ a Timeline. `now` é parâmetro (sem relógio escondido) →
// testável e estável em qualquer fuso; tudo em horário LOCAL (getHours/getDate/…).

const MONTHS_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/** "14:32" — hora:minuto 24h com zero à esquerda. */
export function eventTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** "11 Jun 2026" — sem zero à esquerda no dia (casa o design). */
function dateLabel(date: Date): string {
  return `${date.getDate()} ${MONTHS_PT[date.getMonth()]} ${date.getFullYear()}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Rótulo do cabeçalho do grupo de eventos por dia:
 * "Hoje — 11 Jun 2026" / "Ontem — 10 Jun 2026" / "3 Jun 2026" (mais antigo, sem prefixo).
 */
export function eventDateGroup(date: Date, now: Date): string {
  const label = dateLabel(date);
  if (sameDay(date, now)) return `Hoje — ${label}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return `Ontem — ${label}`;
  return label;
}
