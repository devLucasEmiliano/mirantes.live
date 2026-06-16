# src/components/login

## Propósito
Componentes da tela de login.

## Estrutura
Um único componente cliente.

## Arquivos
- **`login-form.tsx`** (`"use client"`) — formulário controlado de email/senha. No submit
  faz `POST /api/auth/login`; trata `400` (entrada inválida), `401` (credencial),
  `429` (rate-limit) e erro de rede, com mensagens distintas. No sucesso navega para `/dashboard` e chama `router.refresh()` para
  os Server Components relerem a sessão. Não acessa banco — só fala com o Route Handler.

## O que NÃO vai aqui
- **Sem verificação de senha / acesso a banco** — isso é do Route Handler `api/auth/login`.
- **Sem gravar cookie no cliente** — o cookie de sessão é httpOnly, setado pelo servidor.
