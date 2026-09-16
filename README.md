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

O admin tem um botao "Conectar com Mercado Pago" (aba Catalogo) que leva o lojista a
fazer login na propria conta Mercado Pago e autorizar o sistema (fluxo OAuth / Mercado
Pago Connect). Depois disso os pagamentos caem direto na conta que autorizou — ninguem
precisa copiar Access Token ou Public Key manualmente.

Para isso funcionar, o backend precisa de credenciais de uma **aplicacao** Mercado Pago
(`MP_CLIENT_ID` e `MP_CLIENT_SECRET`), que sao diferentes do Access Token de uma conta:
elas so identificam o sistema perante o Mercado Pago, e podem ser as mesmas em varios
projetos/lojas — quem recebe o dinheiro e definido por quem faz login na tela do
Mercado Pago, nao por quem gerou essas credenciais.

1. Acesse https://www.mercadopago.com.br/developers/panel/app (pode reaproveitar uma
   aplicacao ja criada para outro projeto, ou criar uma nova).
2. Em "Configuracoes > URIs de redirecionamento", cadastre exatamente:
   `<FRONTEND_URL>/api/mercadopago/callback` (ex.: `https://perfumes.performancetriade.com.br/api/mercadopago/callback`).
3. Copie o Client ID e o Client Secret da aplicacao e defina `MP_CLIENT_ID` /
   `MP_CLIENT_SECRET` nas variaveis de ambiente do backend (veja
   [backend/.env.example](backend/.env.example)).

Sem essas duas variaveis configuradas no servidor, o botao "Conectar" mostra uma
mensagem de erro. O campo "Configuracao manual (avancado)" no admin continua disponivel
como alternativa, caso quiram colar um Access Token/Public Key de uma unica conta fixa
em vez de usar o login.

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
- O gateway Mercado Pago e conectado via OAuth pelo proprio admin (veja secao "Mercado Pago" acima); sem conexao, o backend usa um provider mockado.
- Uploads (`/api/admin/upload`) salvam em `public/uploads` dentro do container da app — sem volume dedicado, esses arquivos se perdem a cada redeploy. Se for usar upload de imagens em producao, monte um volume persistente nesse caminho.
