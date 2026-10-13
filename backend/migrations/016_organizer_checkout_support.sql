-- Itens criados no Organizador (ex.: "item-<uuid>") nunca tiveram uma linha
-- correspondente na tabela "products" (que hoje esta vazia em producao - o
-- Organizador e o unico catalogo realmente usado). Ate aqui, finalizar um
-- pedido com um item do Organizador quebrava: o backend tentava validar
-- product_id contra "products", e um id fora do formato UUID derrubava a
-- query com "invalid input syntax for type uuid".
--
-- product_id deixa de ser obrigatorio para permitir uma linha de pedido sem
-- produto real vinculado; organizer_item_id guarda o id do item do
-- Organizador nesse caso, para manter o historico/relatorio rastreavel.
ALTER TABLE order_items
	ALTER COLUMN product_id DROP NOT NULL,
	ADD COLUMN IF NOT EXISTS organizer_item_id TEXT;
