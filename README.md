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

### Cadastro de atendentes (painel admin)

Para criar login/senha de atendentes pelo ERP, adicione a chave de service account do Firebase (JSON em uma linha):

```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

No Firebase Console: **Configurações do projeto → Contas de serviço → Gerar nova chave privada**.

**Primeiro administrador:** faça login no `/admin` com o usuário já criado no Firebase Authentication. Se a coleção `usuarios` estiver vazia, esse usuário vira administrador automaticamente.

**Atendentes:** em `/admin/atendentes`, cadastre nome, e-mail e senha. Eles entram em `/atendente/login`.

## Rotas principais

- `/app`: seleção de mesa para cliente.
- `/pique/[id]`: landing da mesa via QR Code.
- `/atendente`: app web de atendente para lançar pedido/manual por mesa.
- `/admin`: ERP (produtos, mesas, dashboard, caixa, etc.).

## Deploy na Vercel

1. Faça deploy do projeto.
2. Em **Project Settings > Environment Variables**, adicione `NEXT_PUBLIC_APP_URL`.
3. Gere os QR Codes no ERP em `admin/piques`.
