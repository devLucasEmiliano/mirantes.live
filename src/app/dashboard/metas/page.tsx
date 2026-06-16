import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { MetasView } from "@/components/metas/metas-view";
import { mockGoals } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Metas — Mirantes.Live",
};

export default function MetasPage() {
  return (
    <>
      <AppHeader title="Metas" breadcrumb="Dashboard / Metas" />
      <MetasView goals={mockGoals} />
    </>
  );
}
