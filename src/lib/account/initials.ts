/**
 * Iniciais para o avatar quando não há foto: 1ª letra do primeiro nome + 1ª do
 * último. Nome com um único token → as 2 primeiras letras. Vazio (ou só espaços)
 * → "?". Colapsa espaços extras. Sempre em maiúsculas.
 */
export function deriveInitials(displayName: string): string {
  const tokens = displayName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  const first = tokens[0][0];
  const last = tokens[tokens.length - 1][0];
  return (first + last).toUpperCase();
}
