INSERT INTO settings (key, value)
VALUES ('product_types', '["Importado","Arabe","Nacional","Tester","Decant"]')
ON CONFLICT (key) DO NOTHING;
