package repositories

import (
	"context"

	"onperfumaria/backend/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type StoreRepository struct {
	db *pgxpool.Pool
}

func NewStoreRepository(db *pgxpool.Pool) *StoreRepository {
	return &StoreRepository{db: db}
}

func (r *StoreRepository) ListProducts(ctx context.Context, includeInactive bool) ([]models.Product, error) {
	query := `
		SELECT p.id::text, p.sku, p.name, p.slug, p.brand_id::text, b.name, p.category_id::text, c.name, p.description,
			p.sale_price, p.promotional_price, p.cost_price, p.profit_margin, p.stock_current, p.stock_minimum,
			p.weight_grams, p.volume_ml, p.gender, p.product_type, p.image_url, p.is_active, p.is_featured
		FROM products p
		JOIN brands b ON b.id = p.brand_id
		JOIN categories c ON c.id = p.category_id`
	if !includeInactive {
		query += ` WHERE p.is_active = true`
	}
	query += ` ORDER BY p.created_at DESC`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := []models.Product{}
	for rows.Next() {
		product, err := scanProduct(rows)
		if err != nil {
			return nil, err
		}
		products = append(products, product)
	}

	return products, rows.Err()
}

func (r *StoreRepository) GetProductBySlug(ctx context.Context, slug string) (*models.Product, error) {
	row := r.db.QueryRow(ctx, `
		SELECT p.id::text, p.sku, p.name, p.slug, p.brand_id::text, b.name, p.category_id::text, c.name, p.description,
			p.sale_price, p.promotional_price, p.cost_price, p.profit_margin, p.stock_current, p.stock_minimum,
			p.weight_grams, p.volume_ml, p.gender, p.product_type, p.image_url, p.is_active, p.is_featured
		FROM products p
		JOIN brands b ON b.id = p.brand_id
		JOIN categories c ON c.id = p.category_id
		WHERE p.slug = $1 AND p.is_active = true`, slug)

	product, err := scanProduct(row)
	if err != nil {
		return nil, err
	}
	return &product, nil
}

func (r *StoreRepository) GetProductByID(ctx context.Context, id string) (*models.Product, error) {
	row := r.db.QueryRow(ctx, `
		SELECT p.id::text, p.sku, p.name, p.slug, p.brand_id::text, b.name, p.category_id::text, c.name, p.description,
			p.sale_price, p.promotional_price, p.cost_price, p.profit_margin, p.stock_current, p.stock_minimum,
			p.weight_grams, p.volume_ml, p.gender, p.product_type, p.image_url, p.is_active, p.is_featured
		FROM products p
		JOIN brands b ON b.id = p.brand_id
		JOIN categories c ON c.id = p.category_id
		WHERE p.id = $1`, id)

	product, err := scanProduct(row)
	if err != nil {
		return nil, err
	}
	return &product, nil
}

type scanner interface {
	Scan(dest ...any) error
}

func scanProduct(row scanner) (models.Product, error) {
	var product models.Product
	err := row.Scan(
		&product.ID,
		&product.SKU,
		&product.Name,
		&product.Slug,
		&product.BrandID,
		&product.Brand,
		&product.CategoryID,
		&product.Category,
		&product.Description,
		&product.SalePrice,
		&product.PromotionalPrice,
		&product.CostPrice,
		&product.ProfitMargin,
		&product.StockCurrent,
		&product.StockMinimum,
		&product.WeightGrams,
		&product.VolumeML,
		&product.Gender,
		&product.ProductType,
		&product.ImageURL,
		&product.IsActive,
		&product.IsFeatured,
	)
	return product, err
}
