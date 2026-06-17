import Link from "next/link";
import { eventTime } from "@/lib/events/format";
import type { TimelineEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { eventVisual } from "./event-visual";

export function TimelineEventRow({
  event,
  className,
}: {
  event: TimelineEvent;
  className?: string;
}) {
  const { Icon, color } = eventVisual(event);
  return (
    <div className={cn("flex gap-3 py-3", className)}>
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="size-3.5" style={{ color }} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="truncate text-[13px] font-medium text-foreground-primary">
          {event.title}
        </span>
        {event.detail && (
          <span className="truncate font-body text-[11px] text-foreground-muted">
            {event.detail}
          </span>
        )}
      </div>
      <span className="shrink-0 font-body text-[11px] text-foreground-muted">
        {eventTime(new Date(event.createdAt))}
      </span>
    </div>
  );
}

interface TimelineFeedProps {
  events: TimelineEvent[];
  title?: string;
  /** Link "Ver tudo →" do cabeçalho (omitido quando ausente). */
  seeAllHref?: string;
}

/** Card "Atividade Recente" da Visão Geral/Home. */
export function TimelineFeed({
  events,
  title = "Atividade Recente",
  seeAllHref,
}: TimelineFeedProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex h-8 items-center justify-between">
        <h2 className="font-display text-base font-bold text-foreground-primary">
          {title}
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="font-body text-xs font-medium text-accent-primary hover:underline"
          >
            Ver tudo →
          </Link>
        )}
      </div>
      <div className="flex flex-1 flex-col rounded-sm bg-surface-card p-4">
        {events.map((event, index) => (
          <div key={event.id} className="flex flex-col">
            {index > 0 && <span className="h-px w-full bg-border-subtle" />}
            <TimelineEventRow event={event} />
          </div>
        ))}
      </div>
    </section>
  );
}
