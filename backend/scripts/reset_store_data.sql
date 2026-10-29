-- ============================================================================
-- ZERA A LOJA, MANTENDO SO A(S) CONTA(S) DE ADMIN E AS CONFIGURACOES.
-- IRREVERSIVEL: faca um backup do banco antes (EasyPanel > Postgres > Backups).
--
-- Apaga: pedidos, pagamentos, vendas do PDV, clientes (nao admin), enderecos,
-- cupons, recuperacoes de senha, estatisticas de produto, e TODOS os produtos
-- e tags do organizador (as paginas, carrosseis e catalogos padrao ficam).
-- Mantem: contas admin (+ notificacoes dos aparelhos delas), Mercado Pago,
-- nome da loja, beneficios, regras de frete, chaves das notificacoes.
--
-- Antes de rodar, FECHE o painel admin em todos os aparelhos: uma aba aberta
-- poderia salvar de volta os produtos que ela tem em memoria.
-- ============================================================================
BEGIN;

TRUNCATE order_items, payments, orders, pos_sale_items, pos_sales,
         product_events, password_resets, addresses, coupons;

DELETE FROM customers WHERE NOT is_admin;

-- Organizador: tira itens (produtos) e pastas de itens; zera tags, lixeira e
-- historico; limpa os produtos escolhidos a mao e as regras de vitrine (as
-- regras padrao voltam a valer sozinhas).
UPDATE settings
SET value = jsonb_build_object(
      'nodes', COALESCE((
        SELECT jsonb_agg((node - 'autoFill') || jsonb_build_object('itemIds', '[]'::jsonb) ORDER BY ord)
        FROM jsonb_array_elements(value::jsonb -> 'nodes') WITH ORDINALITY AS t(node, ord)
        WHERE node ->> 'type' NOT IN ('item', 'folder')
      ), '[]'::jsonb),
      'tags', '[]'::jsonb,
      'activities', '[]'::jsonb,
      'trash', '[]'::jsonb
    )::text
WHERE key = 'organizer_store';

COMMIT;

-- Conferencia: deve sobrar so o admin e nenhum produto.
SELECT email, is_admin FROM customers;
SELECT
  (SELECT count(*) FROM orders) AS pedidos,
  (SELECT count(*) FROM pos_sales) AS vendas_pdv,
  (SELECT count(*) FROM jsonb_array_elements((SELECT value::jsonb -> 'nodes' FROM settings WHERE key = 'organizer_store')) n
     WHERE n ->> 'type' = 'item') AS produtos;
