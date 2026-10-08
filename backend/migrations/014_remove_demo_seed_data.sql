-- Esconde o catalogo de demonstracao que um seed antigo inseriu em producao
-- (backend/internal/database/seed.go ja nao tem mais esse bloco, mas as
-- linhas que ele criou em deploys anteriores continuam no banco). Desativa
-- em vez de apagar: se algum desses produtos ja tiver pedido/carrinho
-- vinculado, um DELETE esbarraria na chave estrangeira e faria a migration
-- inteira falhar - e isso derruba o backend (RunMigrations usa log.Fatalf
-- no cmd/api/main.go). UPDATE nunca tem esse problema e fica reversivel.
UPDATE discount_rules SET is_active = false WHERE name IN (
	'Desconto automatico Lattafa',
	'Desconto automatico femininos premium'
);

UPDATE products SET is_active = false WHERE sku IN (
	'LATTAFA_YARA_100ML',
	'ASAD_LATTAFA_100ML',
	'CLUB_NUIT_105ML',
	'212_VIP_ROSE_80ML',
	'GOOD_GIRL_80ML',
	'SAUVAGE_DIOR_100ML',
	'SCANDAL_JPG',
	'INVICTUS_PACO_RABANNE',
	'FAKHAR_LATTAFA',
	'BADEE_AL_OUD'
);

UPDATE banners SET is_active = false WHERE title = 'Perfumes importados e arabes com entrega rapida em Campo Grande-MS';
