-- Aparelhos dos administradores que aceitaram receber notificacao de venda
-- (Web Push do app instalado / PWA). Um registro por aparelho+navegador: o
-- endpoint e o endereco unico que o servico de push do navegador fornece.
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_customer_idx ON push_subscriptions (customer_id);
