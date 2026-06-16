import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { TimelineView } from "@/components/timeline/timeline-view";
import { mockEvents } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Timeline — Mirantes.Live",
};

export default function TimelinePage() {
  return (
    <>
      <AppHeader title="Timeline" breadcrumb="Dashboard / Timeline" />
      <TimelineView events={mockEvents} />
    </>
  );
}
