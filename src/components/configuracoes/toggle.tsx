"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Switch visual (estado local; sem persistência nesta fase mock). */
export function Toggle({
  defaultChecked = false,
  label,
}: {
  defaultChecked?: boolean;
  label: string;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => setChecked((value) => !value)}
      className={cn(
        "flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
        checked
          ? "justify-end bg-accent-primary"
          : "justify-start bg-surface-elevated",
      )}
    >
      <span
        className={cn(
          "size-5 rounded-full",
          checked ? "bg-foreground-inverse" : "bg-foreground-muted",
        )}
      />
    </button>
  );
}
