import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { GoalForm } from "@/components/metas/goal-form";

export const metadata: Metadata = {
  title: "Nova Meta — Mirantes.Live",
};

export default function NovaMetaPage() {
  return (
    <>
      <AppHeader title="Nova Meta" breadcrumb="Dashboard / Metas / Nova Meta" />
      <div className="flex flex-1 flex-col items-center p-8">
        <GoalForm />
      </div>
    </>
  );
}
