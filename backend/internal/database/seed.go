package database

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

func Seed(db *pgxpool.Pool) error {
	ctx := context.Background()

	password, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	queries := []string{
		`INSERT INTO users_admin (name, email, password_hash, role, must_change_password)
		 VALUES ('Administrador On', 'admin@onperfumaria.com', '` + string(password) + `', 'owner', true)
		 ON CONFLICT (email) DO NOTHING;`,
		`INSERT INTO categories (name, slug) VALUES
		 ('Arabes', 'arabes'),
		 ('Importados', 'importados'),
		 ('Femininos', 'femininos'),
		 ('Masculinos', 'masculinos')
		 ON CONFLICT (slug) DO NOTHING;`,
		`INSERT INTO brands (name, slug) VALUES
		 ('Lattafa', 'lattafa'),
		 ('Armaf', 'armaf'),
		 ('Carolina Herrera', 'carolina-herrera'),
		 ('Dior', 'dior'),
		 ('Paco Rabanne', 'paco-rabanne'),
		 ('Jean Paul Gaultier', 'jean-paul-gaultier')
		 ON CONFLICT (slug) DO NOTHING;`,
		`INSERT INTO settings (key, value) VALUES
		 ('store_name', 'On Perfumaria e Importados'),
		 ('instagram', '@onperfumariaeimportados'),
		 ('highlight_city', 'Campo Grande-MS'),
		 ('benefit_1', 'Perfumes 100% originais'),
		 ('benefit_2', 'Checkout rapido e seguro'),
		 ('benefit_3', 'Descontos automaticos validados no sistema'),
		 ('benefit_4', 'Entrega local e retirada na loja')
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`,
		`INSERT INTO banners (title, subtitle, image_url, cta_label, cta_link, is_active)
		 SELECT 'Perfumes importados e arabes com entrega rapida em Campo Grande-MS',
		        'Curadoria premium, estoque em tempo real e experiencia elegante da loja ao checkout.',
		        'https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=1200&q=80',
		        'Explorar catalogo',
		        '/catalogo',
		        true
		 WHERE NOT EXISTS (SELECT 1 FROM banners);`,
		`INSERT INTO shipping_rules (name, code, rule_type, amount, min_order_amount, weight_min_grams, weight_max_grams, region_prefix, description, is_active)
		 VALUES
		 ('Frete fixo Brasil', 'fixed', 'fixed', 18.90, NULL, NULL, NULL, NULL, 'Taxa base para envios nacionais', true),
		 ('Frete gratis premium', 'free_over', 'free_over', 0, 349.90, NULL, NULL, NULL, 'Frete gratis acima do valor minimo', true),
		 ('Taxa por peso leve', 'weight_light', 'weight', 4.90, NULL, 0, 1000, NULL, 'Faixa ate 1kg', true),
		 ('Taxa por peso adicional', 'weight_extra', 'weight', 7.50, NULL, 1001, 999999, NULL, 'Faixa acima de 1kg', true),
		 ('Entrega local Campo Grande-MS', 'local', 'local', 12.00, NULL, NULL, NULL, '79', 'Entrega local em Campo Grande-MS', true),
		 ('Retirada na loja', 'pickup', 'pickup', 0, NULL, NULL, NULL, NULL, 'Retire na loja', true),
		 ('Frete a consultar', 'manual', 'manual', 0, NULL, NULL, NULL, NULL, 'Consultar frete manualmente', true)
		 ON CONFLICT (code) DO UPDATE
		 SET name = EXCLUDED.name,
		     rule_type = EXCLUDED.rule_type,
		     amount = EXCLUDED.amount,
		     min_order_amount = EXCLUDED.min_order_amount,
		     weight_min_grams = EXCLUDED.weight_min_grams,
		     weight_max_grams = EXCLUDED.weight_max_grams,
		     region_prefix = EXCLUDED.region_prefix,
		     description = EXCLUDED.description,
		     is_active = EXCLUDED.is_active;`,
		`INSERT INTO coupons (code, discount_type, value, is_active)
		 VALUES ('BEMVINDA10', 'percent', 10, true)
		 ON CONFLICT (code) DO UPDATE SET value = EXCLUDED.value, is_active = EXCLUDED.is_active;`,
		`INSERT INTO products
		 (name, sku, slug, brand_id, category_id, description, sale_price, promotional_price, cost_price, profit_margin, stock_current, stock_minimum, weight_grams, volume_ml, gender, product_type, image_url, is_active, is_featured)
		 VALUES
		 ('Lattafa Yara 100ml', 'LATTAFA_YARA_100ML', 'lattafa-yara-100ml', (SELECT id FROM brands WHERE slug = 'lattafa'), (SELECT id FROM categories WHERE slug = 'arabes'), 'Doce, cremoso e muito pedido para o dia a dia.', 189.90, NULL, 98.00, 48.4, 22, 5, 420, 100, 'feminino', 'arabe', 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=900&q=80', true, true),
		 ('Asad Lattafa 100ml', 'ASAD_LATTAFA_100ML', 'asad-lattafa-100ml', (SELECT id FROM brands WHERE slug = 'lattafa'), (SELECT id FROM categories WHERE slug = 'arabes'), 'Amadeirado intenso com assinatura elegante.', 219.90, NULL, 115.00, 47.7, 18, 4, 430, 100, 'masculino', 'arabe', 'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80', true, true),
		 ('Club de Nuit Intense Man 105ml', 'CLUB_NUIT_105ML', 'club-de-nuit-intense-man-105ml', (SELECT id FROM brands WHERE slug = 'armaf'), (SELECT id FROM categories WHERE slug = 'importados'), 'Citrico marcante e alta performance.', 329.90, NULL, 180.00, 45.0, 14, 4, 450, 105, 'masculino', 'importado', 'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=900&q=80', true, true),
		 ('212 VIP Rose 80ml', '212_VIP_ROSE_80ML', '212-vip-rose-80ml', (SELECT id FROM brands WHERE slug = 'carolina-herrera'), (SELECT id FROM categories WHERE slug = 'femininos'), 'Floral frutado sofisticado para noite e eventos.', 479.90, NULL, 270.00, 41.0, 9, 3, 410, 80, 'feminino', 'importado', 'https://images.unsplash.com/photo-1615634260167-c8cdede054de?auto=format&fit=crop&w=900&q=80', true, true),
		 ('Good Girl 80ml', 'GOOD_GIRL_80ML', 'good-girl-80ml', (SELECT id FROM brands WHERE slug = 'carolina-herrera'), (SELECT id FROM categories WHERE slug = 'femininos'), 'Iconico, sensual e de presenca.', 589.90, NULL, 330.00, 39.9, 7, 2, 520, 80, 'feminino', 'importado', 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=900&q=80', true, true),
		 ('Sauvage Dior 100ml', 'SAUVAGE_DIOR_100ML', 'sauvage-dior-100ml', (SELECT id FROM brands WHERE slug = 'dior'), (SELECT id FROM categories WHERE slug = 'masculinos'), 'Fresco especiado com assinatura de luxo.', 799.90, NULL, 455.00, 39.3, 6, 2, 420, 100, 'masculino', 'importado', 'https://images.unsplash.com/photo-1588405748880-12d1d2a59df1?auto=format&fit=crop&w=900&q=80', true, true),
		 ('Scandal Jean Paul Gaultier', 'SCANDAL_JPG', 'scandal-jean-paul-gaultier', (SELECT id FROM brands WHERE slug = 'jean-paul-gaultier'), (SELECT id FROM categories WHERE slug = 'femininos'), 'Mel e flores brancas para quem gosta de impacto.', 629.90, NULL, 355.00, 43.6, 5, 2, 430, 80, 'feminino', 'importado', 'https://images.unsplash.com/photo-1563170351-be82bc888aa4?auto=format&fit=crop&w=900&q=80', true, false),
		 ('Invictus Paco Rabanne', 'INVICTUS_PACO_RABANNE', 'invictus-paco-rabanne', (SELECT id FROM brands WHERE slug = 'paco-rabanne'), (SELECT id FROM categories WHERE slug = 'masculinos'), 'Refrescante, versatil e campeao de vendas.', 539.90, NULL, 300.00, 40.0, 8, 3, 440, 100, 'masculino', 'importado', 'https://images.unsplash.com/photo-1611078489935-0cb964de46d6?auto=format&fit=crop&w=900&q=80', true, false),
		 ('Fakhar Lattafa', 'FAKHAR_LATTAFA', 'fakhar-lattafa', (SELECT id FROM brands WHERE slug = 'lattafa'), (SELECT id FROM categories WHERE slug = 'arabes'), 'Perfume arabe elegante e moderno.', 209.90, NULL, 108.00, 48.5, 16, 4, 430, 100, 'masculino', 'arabe', 'https://images.unsplash.com/photo-1619994403073-2cec6d49f5c9?auto=format&fit=crop&w=900&q=80', true, false),
		 ('Badee Al Oud', 'BADEE_AL_OUD', 'badee-al-oud', (SELECT id FROM brands WHERE slug = 'lattafa'), (SELECT id FROM categories WHERE slug = 'arabes'), 'Oud encorpado com personalidade marcante.', 239.90, NULL, 124.00, 47.6, 11, 3, 430, 100, 'unissex', 'arabe', 'https://images.unsplash.com/photo-1595425964072-85b3b1fa0fe6?auto=format&fit=crop&w=900&q=80', true, false)
		 ON CONFLICT (slug) DO UPDATE
		 SET name = EXCLUDED.name,
		     sku = EXCLUDED.sku,
		     slug = EXCLUDED.slug,
		     brand_id = EXCLUDED.brand_id,
		     category_id = EXCLUDED.category_id,
		     description = EXCLUDED.description,
		     sale_price = EXCLUDED.sale_price,
		     promotional_price = EXCLUDED.promotional_price,
		     cost_price = EXCLUDED.cost_price,
		     profit_margin = EXCLUDED.profit_margin,
		     stock_minimum = EXCLUDED.stock_minimum,
		     weight_grams = EXCLUDED.weight_grams,
		     volume_ml = EXCLUDED.volume_ml,
		     gender = EXCLUDED.gender,
		     product_type = EXCLUDED.product_type,
		     image_url = EXCLUDED.image_url,
		     is_active = EXCLUDED.is_active,
		     is_featured = EXCLUDED.is_featured;`,
		`INSERT INTO discount_rules (name, target_type, target_id, discount_type, value, is_active)
		 VALUES
		 ('Desconto automatico Lattafa', 'brand', (SELECT id FROM brands WHERE slug = 'lattafa'), 'percent', 8, true),
		 ('Desconto automatico femininos premium', 'category', (SELECT id FROM categories WHERE slug = 'femininos'), 'percent', 5, true)
		 ON CONFLICT DO NOTHING;`,
	}

	for _, query := range queries {
		if _, err := db.Exec(ctx, query); err != nil {
			return err
		}
	}

	return nil
}
