## Sistema Pesque Pague

Aplicação web para pedidos por QR Code nas mesas/quiosques, painel administrativo e fluxo de atendimento.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## Variáveis de ambiente

Configure `NEXT_PUBLIC_APP_URL` com a URL pública do sistema (domínio da Vercel).

```env
NEXT_PUBLIC_APP_URL=https://seu-dominio.vercel.app
```

Essa variável é usada para gerar os QR Codes das mesas com o link público correto.

## Rotas principais

- `/app`: seleção de mesa para cliente.
- `/pique/[id]`: landing da mesa via QR Code.
- `/atendente`: app web de atendente para lançar pedido/manual por mesa.
- `/admin`: ERP (produtos, mesas, dashboard, caixa, etc.).

## Deploy na Vercel

1. Faça deploy do projeto.
2. Em **Project Settings > Environment Variables**, adicione `NEXT_PUBLIC_APP_URL`.
3. Gere os QR Codes no ERP em `admin/piques`.
