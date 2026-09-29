UPDATE banners
SET
    cta_label = CASE
        WHEN cta_label = 'Explorar catalogo' THEN 'Explorar produtos'
        ELSE cta_label
    END,
    cta_link = '/comercial'
WHERE cta_link = '/catalogo';
