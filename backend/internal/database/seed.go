package database

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Seed cria os dados iniciais da loja (textos, regras de frete e cupom de
// boas-vindas) so quando ainda nao existem. Roda a cada boot com AUTO_SEED, entao
// nunca sobrescreve: o que o admin mudou (ou um cupom que ele desativou) fica
// como esta. Para corrigir um valor ja gravado, crie uma migration.
func Seed(db *pgxpool.Pool) error {
	ctx := context.Background()

	queries := []string{
		`INSERT INTO settings (key, value) VALUES
		 ('store_name', 'On Perfumaria e Importados'),
		 ('instagram', '@onperfumariaeimportados'),
		 ('highlight_city', 'Campo Grande-MS'),
		 ('benefit_1', 'Perfumes 100% originais'),
		 ('benefit_2', 'Checkout rapido e seguro'),
		 ('benefit_3', 'Descontos automaticos validados no sistema'),
		 ('benefit_4', 'Entrega local e retirada na loja')
		 ON CONFLICT (key) DO NOTHING;`,
		`INSERT INTO shipping_rules (name, code, rule_type, amount, min_order_amount, weight_min_grams, weight_max_grams, region_prefix, description, is_active)
		 VALUES
		 ('Frete fixo Brasil', 'fixed', 'fixed', 18.90, NULL, NULL, NULL, NULL, 'Taxa base para envios nacionais', true),
		 ('Frete gratis premium', 'free_over', 'free_over', 0, 349.90, NULL, NULL, NULL, 'Frete gratis acima do valor minimo', true),
		 ('Taxa por peso leve', 'weight_light', 'weight', 4.90, NULL, 0, 1000, NULL, 'Faixa ate 1kg', true),
		 ('Taxa por peso adicional', 'weight_extra', 'weight', 7.50, NULL, 1001, 999999, NULL, 'Faixa acima de 1kg', true),
		 ('Entrega local Campo Grande-MS', 'local', 'local', 12.00, NULL, NULL, NULL, '79', 'Entrega local em Campo Grande-MS', true),
		 ('Retirada na loja', 'pickup', 'pickup', 0, NULL, NULL, NULL, NULL, 'Retire na loja', true),
		 ('Frete a consultar', 'manual', 'manual', 0, NULL, NULL, NULL, NULL, 'Consultar frete manualmente', true)
		 ON CONFLICT (code) DO NOTHING;`,
		`INSERT INTO coupons (code, discount_type, value, is_active)
		 VALUES ('BEMVINDA10', 'percent', 10, true)
		 ON CONFLICT (code) DO NOTHING;`,
	}

	for _, query := range queries {
		if _, err := db.Exec(ctx, query); err != nil {
			return err
		}
	}

	return nil
}
