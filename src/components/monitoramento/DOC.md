# src/components/monitoramento

## Propósito
Cards da tela de **Monitoramento** (`/dashboard/monitoramento`): status dos serviços,
uptime por serviço, incidentes recentes e tempo de resposta. Apresentação a partir do mock.

## Estrutura
Arquivo único com vários cards exportados; componentes de apresentação (sem `"use client"`).

## Arquivos
- **`service-cards.tsx`** — consolida os cards que a spec 002 nomeou como `service-row`,
  `incident-item` e `uptime-bars`. Exporta:
  - `ServiceStatusCard` — "Status dos Serviços": ícone, nome, barra de uptime, % e estado
    (online/degraded/offline) por serviço de `mockServices`.
  - `UptimeByServiceCard` — "Uptime por Serviço": linha do tempo segmentada de 30 dias
    (`service.history`) + legenda; usa o subcomponente interno `ServiceTimelineRow`.
  - `IncidentsCard` — "Incidentes Recentes": lista ilustrativa fixa (`RECENT_INCIDENTS`)
    com ícone/cor por severidade.
  - `ResponseTimeCard` — "Tempo de Resposta": barras de latência por endpoint
    (`mockEndpointLatencies`), normalizadas pelo maior valor.

  Mapeia `ServiceIcon`/`ServiceState` (de `@/lib/types`) para ícones Lucide e classes de cor.

## O que NÃO vai aqui
- **Sem probes/health-check reais** — o worker de monitoramento, polling e cálculo de
  uptime/incidentes pertencem à spec de Monitoramento (SPEC). Aqui é só visual.
- **Sem banco/Redis/segredos** — dados vêm de `@/lib/mock-data` (e da lista fixa de
  incidentes ilustrativos).
