# On Perfumaria e Importados

Aplicacao full-stack para ecommerce de perfumes importados e arabes.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: Go + Gin + JWT
- Banco: PostgreSQL
- Infra: Docker Compose

## O que esta pronto

- Loja online com home, categorias, detalhe de produto, pedidos e checkout
- Catalogo, paginas e estoque gerenciados pelo Organizador (admin)
- PostgreSQL com migrations e seed dos dados iniciais da loja
- API REST com autenticacao JWT para clientes e administradores
- Pagamento pelo Mercado Pago (cartao e Pix), com provider mockado so em desenvolvimento

## Como rodar com Docker

```bash
JWT_SECRET=$(openssl rand -hex 32) POSTGRES_PASSWORD=troque-por-algo-forte docker compose up --build
```

`JWT_SECRET` e obrigatorio: o backend nao sobe se ele estiver vazio, com o
antigo valor de exemplo (`change-me-in-production`) ou com menos de 32
caracteres. Em producao, gere um valor fixo com `openssl rand -hex 32` e guarde
nas variaveis do servico - trocar o segredo desloga todo mundo. O ambiente de
desenvolvimento do VS Code (`.vscode/docker-compose.dev.yml`) ja traz um valor
proprio e nao precisa de nada.

Sobem dois containers:

- `app`: backend Go + frontend buildado (estatico), servidos em `http://localhost:8080`
- `db`: PostgreSQL, acessivel apenas pela rede interna do compose (nao exposto no host)

O frontend ja sai buildado e servido pelo backend, entao nao precisa subir Vite separado para usar o sistema.

Em producao (ex.: EasyPanel), o `app` roda como servico "App" comum (build da `Dockerfile`) e o Postgres roda como servico de banco de dados nativo/gerenciado, apontado via `DATABASE_URL` — sem depender do `docker-compose.yml`, que serve principalmente para rodar tudo localmente.

## Desenvolvimento separado

Para desenvolver frontend e backend separadamente, use as pastas `frontend/` e
`backend/`. A organizacao do frontend esta documentada em
[frontend/README.md](frontend/README.md) e a API em
[backend/README.md](backend/README.md).

```text
backend/   API, regras de negocio, banco de dados e arquivos estaticos
frontend/  interface React, rotas, componentes e estado do cliente
Iconi/     arquivos originais dos icones do projeto
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Validacoes disponiveis:

```bash
npm run lint
npm run format:check
npm run build
```

## Variaveis de ambiente

- Backend: [backend/.env.example](backend/.env.example)
- Frontend: [frontend/.env.example](frontend/.env.example)

## Mercado Pago

Sem o Access Token do Mercado Pago, o checkout responde "pagamento indisponivel
no momento". O provider mockado (aprova sem cobrar) so entra com
`PAYMENTS_MOCK=true`, ligado apenas no ambiente de desenvolvimento
(`.vscode/docker-compose.dev.yml`).

O pagamento e feito com o Payment Brick (Checkout Transparente) embutido na propria
pagina de checkout — cartao de credito com parcelamento ou Pix, sem redirecionar o
cliente para o site do Mercado Pago. A Public Key e exposta via `GET /api/store/config`
(campo `mpPublicKey`) para o frontend inicializar o SDK; o Access Token nunca sai do
backend.

## Endpoints principais

Loja (publicos):

- `GET /api/organizer` - estrutura da loja: paginas, itens, precos, estoque e tags
- `GET /api/store/config` - opcoes de entrega, chave publica do Mercado Pago, WhatsApp
- `POST /api/shipping/quote` e `POST /api/store/validate-coupon`
- `POST /api/checkout` e `GET /api/order/:id`
- `POST /api/webhooks/mercadopago`

Cliente:

- `POST /api/auth/customer/register`, `/login`, `/google`, `/recover`, `/reset`
- `GET|PUT /api/customer/me`, `GET /api/customer/orders/:id`, `POST /api/customer/addresses`

Admin (token de administrador):

- `PUT /api/organizer` - salva o Organizador (preserva vendas feitas com a tela aberta)
- `GET /api/orders`, `GET /api/customers`, `GET /api/customers/:id`
- `PUT /api/orders/:id/status` (pago -> enviado -> entregue) e `GET /api/orders/export` (CSV)
- `GET|POST /api/coupons`, `PUT|DELETE /api/coupons/:id`
- `GET|PUT /api/admin/api-settings` (so o administrador fixo), `/api/admin/store-whatsapp`, `/api/admin/notifications`

A lista completa esta em `backend/internal/handlers/router.go`.

## Observacoes

- O seed (`AUTO_SEED=true`) so cria o que falta: textos da loja, regras de frete e
  o cupom `BEMVINDA10`. Nunca sobrescreve o que o admin mudou; correcoes de dados
  ja gravados vao em migrations.
- Os produtos vivem no Organizador (nao ha mais tabela/rotas de produtos).
- Checkout cria cliente automaticamente para futuras compras.
- Estoque do Organizador baixa em vendas pagas online.
- A entrega pelos Correios esta desligada (`correiosEnabled` em
  `backend/internal/services/app_service.go`): o webservice antigo saiu do ar e a
  API nova so cota preco com contrato.
