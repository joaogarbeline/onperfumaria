# Estado atual do projeto

Este arquivo registra apenas decisoes estruturais que ajudam a continuar o
desenvolvimento. Instrucoes de instalacao e a lista completa de rotas ficam nos
READMEs da raiz, do frontend e do backend.

## Decisoes atuais

- A antiga pagina publica `/catalogo` foi removida. A navegacao publica usa as
  paginas de categoria e `/comercial`.
- O item `Catalogo` do rodape mobile foi substituido por `Pedidos`; o arquivo do
  icone antigo continua sendo usado apenas como representacao visual desse item.
- Carrosseis devem usar o componente compartilhado `components/Carousel.tsx`.
- As seis paginas de categoria usam `components/category/CategoryWindow.tsx` e
  `CategoryFilterDrawer.tsx`; nao crie uma copia do filtro para cada categoria.
- O item demonstrativo esta isolado em `components/item`, com dados, avaliacoes
  e componentes visuais separados.
- Tipos e regras compartilhadas de checkout e pedidos ficam em `types` e
  `utils`, fora das paginas.
- O historico de pedidos usa `/pedidos` e os detalhes usam `/pedidos/:id`.

## Validacao antes de entregar

Frontend:

```bash
cd frontend
npm run format:check
npm run lint
npm run build
npm audit
```

Backend:

```bash
cd backend
gofmt -l .
go test ./...
go vet ./...
go build ./cmd/api
```

O projeto ainda nao possui testes automatizados proprios; atualmente `go test`
valida somente a compilacao dos pacotes sem arquivos de teste.
