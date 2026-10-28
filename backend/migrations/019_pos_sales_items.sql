-- PDV (venda presencial na loja). A tabela pos_sales existe desde a 001;
-- aqui ela ganha itens, troco, parcelas, vendedor e cancelamento.
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS customer_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS installments INT NOT NULL DEFAULT 1;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS amount_received NUMERIC(10,2);
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS change_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'concluida';
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS pos_sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_sale_id UUID NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
    organizer_item_id TEXT NOT NULL DEFAULT '',
    product_name TEXT NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    quantity INT NOT NULL,
    line_total NUMERIC(10,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS pos_sale_items_sale_idx ON pos_sale_items (pos_sale_id);
CREATE INDEX IF NOT EXISTS pos_sales_created_idx ON pos_sales (created_at);
