# On Perfumaria e Importados

Base full-stack para ecommerce, painel administrativo e PDV de perfumes importados e arabes.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: Go + Gin + JWT
- Banco: PostgreSQL
- Infra: Docker Compose

## O que esta pronto

- Loja online com home, catalogo, detalhe de produto e checkout
- Painel admin com login, dashboard, pedidos, clientes e produtos
- PDV presencial integrado ao mesmo estoque
- PostgreSQL com migrations e seed automatica
- API REST com autenticacao JWT para admin e cliente
- Arquitetura de pagamento preparada com provider mockado

## Credenciais padrao

- Admin: `admin@onperfumaria.com`
- Senha: `admin123` (ou o valor de `ADMIN_PASSWORD`, se definido)

## Como rodar com Docker

```bash
JWT_SECRET=troque-por-algo-forte POSTGRES_PASSWORD=troque-por-algo-forte docker compose up --build
```

Sobem dois containers:

- `app`: backend Go + frontend buildado (estatico), servidos em `http://localhost:8080`
- `db`: PostgreSQL, acessivel apenas pela rede interna do compose (nao exposto no host)

O frontend ja sai buildado e servido pelo backend, entao nao precisa subir Vite separado para usar o sistema.

Em producao (ex.: EasyPanel), o `app` roda como servico "App" comum (build da `Dockerfile`) e o Postgres roda como servico de banco de dados nativo/gerenciado, apontado via `DATABASE_URL` — sem depender do `docker-compose.yml`, que serve principalmente para rodar tudo localmente.

## Desenvolvimento separado

Se quiser continuar desenvolvendo frontend e backend em modo local, a estrutura original continua organizada em `frontend/` e `backend/`.

## Variaveis de ambiente

- Backend: [backend/.env.example](backend/.env.example)
- Frontend: [frontend/.env.example](frontend/.env.example)

## Mercado Pago

No admin (aba Catalogo) tem um bloco "Mercado Pago" para colar o **Access Token** e a
**Public Key** da conta que vai receber os pagamentos. Sao encontrados no painel do
Mercado Pago, em "Suas integracoes" > aplicacao > Credenciais de producao. Depois de
salvar, o checkout online passa a criar pagamentos de verdade nessa conta; sem token
configurado, o backend usa um provider mockado.

O pagamento e feito com o Payment Brick (Checkout Transparente) embutido na propria
pagina de checkout — cartao de credito com parcelamento ou Pix, sem redirecionar o
cliente para o site do Mercado Pago. A Public Key e exposta via `GET /api/store/config`
(campo `mpPublicKey`) para o frontend inicializar o SDK; o Access Token nunca sai do
backend.

## Endpoints principais

- `GET /api/store/home`
- `GET /api/products`
- `GET /api/products/:slug`
- `POST /api/checkout`
- `POST /api/auth/customer/register`
- `POST /api/auth/customer/login`
- `POST /api/auth/admin/login`
- `GET /api/admin/dashboard`
- `GET /api/admin/orders`
- `GET /api/admin/customers`
- `POST /api/pos/sales`

## Observacoes

- Seed automatico cria categorias, marcas, produtos mockados, cupom e admin.
- Checkout cria cliente automaticamente para futuras compras.
- Estoque baixa em vendas pagas online e em todas as vendas do PDV.
- O gateway Mercado Pago e configurado direto no admin (veja secao "Mercado Pago" acima).
- Uploads (`/api/admin/upload`) salvam em `public/uploads` dentro do container da app — sem volume dedicado, esses arquivos se perdem a cada redeploy. Se for usar upload de imagens em producao, monte um volume persistente nesse caminho.
