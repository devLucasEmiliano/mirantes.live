"use client";

import { Loader2, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";

// Picker genérico "busca + lista clicável" (spec 023), no visual já validado do seletor de
// repositórios de Integrações (`projects-manager.tsx`). É CONTROLADO e BURRO: quem guarda a
// `query` e quem aplica o filtro (`@/lib/teams-filter`) é o pai — aqui só desenha. Isso mantém
// toda a lógica de busca em funções puras, testáveis em unit sem jsdom.
// Não sabe o que é usuário/projeto: `renderItem` decide o conteúdo da linha.

export interface SearchPickerProps<T> {
  /** JÁ filtrado pelo pai (`filterUsers`/`filterProjects`). */
  items: T[];
  query: string;
  onQueryChange: (query: string) => void;
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onPick: (item: T) => void;
  placeholder: string;
  /** Nada disponível (lista de origem vazia, com a busca em branco). */
  emptyLabel: string;
  /** A busca não achou nada. */
  noResultsLabel: string;
  /** Chave em andamento — `Loader2` na linha, resto desabilitado. */
  busyKey?: string | null;
  testId: string;
  /** Nome do atributo `data-*` que carrega o id do item (ex. `data-user-id`). */
  itemIdAttr: string;
}

export function SearchPicker<T>({
  items,
  query,
  onQueryChange,
  keyOf,
  renderItem,
  onPick,
  placeholder,
  emptyLabel,
  noResultsLabel,
  busyKey = null,
  testId,
  itemIdAttr,
}: SearchPickerProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-foreground-muted" />
        <input
          data-testid={`${testId}-search`}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-sm border border-border-subtle bg-surface-primary py-2.5 pr-3.5 pl-9 text-sm text-foreground-primary outline-none focus:border-accent-primary"
        />
      </div>

      <div className="flex max-h-64 flex-col overflow-y-auto rounded-sm border border-border-subtle">
        {items.length === 0 ? (
          <span className="px-3.5 py-3 text-[12px] text-foreground-muted">
            {query.trim() === "" ? emptyLabel : noResultsLabel}
          </span>
        ) : (
          items.map((item) => {
            const key = keyOf(item);
            return (
              <button
                key={key}
                type="button"
                data-testid={`${testId}-option`}
                {...{ [itemIdAttr]: key }}
                onClick={() => onPick(item)}
                disabled={busyKey !== null}
                className="flex items-center justify-between gap-2.5 border-b border-border-subtle px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-surface-elevated disabled:opacity-50"
              >
                {renderItem(item)}
                {busyKey === key ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-foreground-muted" />
                ) : (
                  <Plus className="size-3.5 shrink-0 text-accent-primary" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
