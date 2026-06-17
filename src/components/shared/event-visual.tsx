import {
  CircleCheckBig,
  CirclePlus,
  GitCommitHorizontal,
  GitMerge,
  Pencil,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import { type EventVisualKind, eventVisualKind } from "@/lib/events/visual";
import type { TimelineEvent } from "@/lib/types";

// Fonte ÚNICA de ícone + cor por evento, compartilhada pela Timeline (`timeline-view`) e pela
// Atividade Recente (`timeline-feed`) — antes a lógica vivia duplicada (e divergente) nos dois.
// A CATEGORIA vem de `eventVisualKind` (puro, lib); aqui só escolhemos os pixels (ícone/cor).
const KIND_VISUAL: Record<
  EventVisualKind,
  { Icon: typeof Pencil; color: string }
> = {
  commit: { Icon: GitCommitHorizontal, color: "#8F5A3C" }, // marrom
  merge: { Icon: GitMerge, color: "#7C5CBF" }, // roxo (merge)
  ci: { Icon: Workflow, color: "#3C6E8F" }, // azul (GitHub Actions/CI)
  "goal-created": { Icon: CirclePlus, color: "#8F5A3C" },
  "goal-completed": { Icon: CircleCheckBig, color: "#4A7A5B" },
  "incident-open": { Icon: TriangleAlert, color: "#B54A4A" },
  "incident-resolved": { Icon: CircleCheckBig, color: "#4A7A5B" },
  generic: { Icon: Pencil, color: "#C2956A" },
};

/** Ícone lucide + cor de um evento, conforme o design. */
export function eventVisual(event: TimelineEvent): {
  Icon: typeof Pencil;
  color: string;
} {
  return KIND_VISUAL[eventVisualKind(event)];
}
