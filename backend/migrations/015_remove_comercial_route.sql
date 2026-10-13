ALTER TABLE banners ALTER COLUMN cta_link SET DEFAULT '/';

UPDATE banners
SET cta_link = '/'
WHERE cta_link = '/comercial';
