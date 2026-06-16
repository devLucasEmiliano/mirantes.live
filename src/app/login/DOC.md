# src/app/login

## Propósito
Rota pública `/login` — tela de entrada. Renderiza o painel de marca (esquerda) e o
formulário de autenticação (direita).

## Estrutura
Página única (Server Component) que monta o layout e delega a interação ao `LoginForm`.

## Arquivos
- **`page.tsx`** — `LoginPage` (Server Component). Define `metadata.title`
  ("Entrar — Mirantes.Live"), o painel de marca (`bg-surface-inverse`, wordmark, headline,
  rodapé © ) e renderiza `@/components/login/login-form` no painel direito. Toda a lógica de
  login (fetch, tratamento de 401/429, redirect) está no `LoginForm` (cliente) — ver
  `src/components/login/DOC.md`.

## O que NÃO vai aqui
- **Sem chamada de auth aqui** — o `page.tsx` é só apresentação; `fetch('/api/auth/login')`
  e o tratamento de erro vivem no `LoginForm`.
- **Sem setar cookie** (é Server Component) — cookies só em Route Handler/proxy (Next 16).
- **Sem acesso a banco/segredos.**
