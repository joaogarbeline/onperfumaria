ALTER TABLE products ADD COLUMN IF NOT EXISTS registered_stock INT NOT NULL DEFAULT 0;

-- Preenche o estoque registrado dos produtos ja cadastrados com o estoque atual,
-- ja que nao existia esse historico antes desta coluna. Depois deste backfill,
-- o valor so e definido uma vez no cadastro do produto e nunca mais muda.
UPDATE products SET registered_stock = stock_current WHERE registered_stock = 0;
