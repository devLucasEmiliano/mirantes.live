# src/components/configuracoes

## Propósito
Cards de apresentação da tela `/dashboard/configuracoes`. Camada **visual**: montam o layout
dos blocos de configurações a partir de dados mock. A funcionalidade real (Perfil, Senha,
Projetos, Monitoramento) entra em specs próprias (007+); aqui só há UI.

## Estrutura
Três módulos de componentes, consumidos por `src/app/dashboard/configuracoes/page.tsx`:
coluna esquerda (conta/projetos) e coluna direita (ferramentas).

## Arquivos
- **`profile-cards.tsx`** (server) — helper `CardShell` + cards da coluna esquerda:
  `ProfileCard` (perfil do usuário), `PasswordCard` (alterar senha), `ProjectCard` (projetos
  com repositório Git). Lê `mockUser` de `@/lib/mock-data`. Campos hoje **read-only / mock**.
- **`tools-cards.tsx`** (server) — cards da coluna direita: `ReportsCard` (Relatórios &
  Exportação — PDF e CSV), `UptimeMonitoringCard` (lista de serviços de `mockServices`, badge
  de status), `ProjectSettingsCard` (toggles "Configurações de Projetos"), `DangerZoneCard`
  (ações destrutivas). Botões "Adicionar Serviço" e exportações ainda **sem handler**.
- **`toggle.tsx`** (`"use client"`) — `Toggle`: switch acessível (`role="switch"`,
  `aria-checked`) com estado local; **sem persistência** nesta fase mock.

## O que NÃO vai aqui
- **Sem acesso a banco/API nem lógica de negócio** — estes são componentes de apresentação.
  Dados reais devem chegar por props a partir de Server Components/DAL nas specs funcionais.
- **Sem checagem de autorização** — o gate (`requireAdmin`) é da página/DAL, não dos cards.
- **Sem segredos no cliente** (PAT etc.) — jamais renderizar aqui.
