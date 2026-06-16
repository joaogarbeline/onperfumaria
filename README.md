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
- Senha: `admin123`

## Como rodar em um container so

```bash
docker compose up --build
```

Tudo sobe no mesmo container `onperfumaria-app`:

- Loja, admin, PDV e API em `http://localhost:8080`
- PostgreSQL no mesmo container, exposto em `localhost:5432`

O frontend ja sai buildado e servido pelo backend, entao nao precisa subir Vite separado para usar o sistema.

## Desenvolvimento separado

Se quiser continuar desenvolvendo frontend e backend em modo local, a estrutura original continua organizada em `frontend/` e `backend/`.

## Variaveis de ambiente

- Backend: [backend/.env.example](/C:/Users/joao.garbeline/Desktop/On%20Perfumaria/backend/.env.example)
- Frontend: [frontend/.env.example](/C:/Users/joao.garbeline/Desktop/On%20Perfumaria/frontend/.env.example)

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
- O gateway real ainda nao foi conectado, mas o backend ja separa provider e status de pagamento para evolucao futura.
- Em Docker, banco + backend + frontend rodam no mesmo container por pedido seu.
