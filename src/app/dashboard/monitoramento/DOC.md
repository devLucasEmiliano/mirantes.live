# src/app/dashboard/monitoramento

## Propósito
Rota autenticada `/dashboard/monitoramento` — saúde da infraestrutura: uptime, status dos
serviços, incidentes e tempo de resposta.

## Estrutura
Página única que monta o cabeçalho, a faixa de StatCards e duas colunas de cards.

## Arquivos
- **`page.tsx`** — `MonitoramentoPage` (Server Component). Define `metadata.title`
  ("Monitoramento — Mirantes.Live"); renderiza o `AppHeader`, quatro `StatCard`
  (Uptime Total, Serviços Online, Tempo Médio, Incidentes) a partir de
  `mockMonitoringSummary`, e os cards de `@/components/monitoramento/service-cards`
  (`ServiceStatusCard`, `UptimeByServiceCard`, `IncidentsCard`, `ResponseTimeCard`). Usa
  `ProgressRing` e `UptimeDaysBar` (de `shared/`) e os mocks `mockServices` /
  `mockProjectUptimeDays`. Subcomponente interno `RingStat`. O botão "Registrar Incidente" é
  visual.

## O que NÃO vai aqui
- **Sem probes/health-check nem worker de polling** — coleta real de uptime, detecção de
  incidentes e cálculo de saúde pertencem à spec de Monitoramento (SPEC; externos como
  HTTP/Docker só stubados com fixtures realistas, §5.3).
- **Sem banco/Redis/segredos na página** — valores vêm de `@/lib/mock-data`.
