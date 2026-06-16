package models

type Product struct {
	ID                      string   `json:"id"`
	SKU                     string   `json:"sku"`
	Name                    string   `json:"name"`
	Slug                    string   `json:"slug"`
	BrandID                 string   `json:"brandId,omitempty"`
	Brand                   string   `json:"brand"`
	CategoryID              string   `json:"categoryId,omitempty"`
	Category                string   `json:"category"`
	Description             string   `json:"description"`
	SalePrice               float64  `json:"salePrice"`
	PromotionalPrice        *float64 `json:"promotionalPrice"`
	FinalPrice              float64  `json:"finalPrice"`
	AutomaticDiscountAmount float64  `json:"automaticDiscountAmount"`
	DiscountLabel           string   `json:"discountLabel"`
	CostPrice               float64  `json:"costPrice"`
	ProfitMargin            float64  `json:"profitMargin"`
	StockCurrent            int      `json:"stockCurrent"`
	StockMinimum            int      `json:"stockMinimum"`
	WeightGrams             int      `json:"weightGrams"`
	VolumeML                int      `json:"volumeMl"`
	Gender                  string   `json:"gender"`
	ProductType             string   `json:"productType"`
	ImageURL                string   `json:"imageUrl"`
	Images                  []string `json:"images"`
	IsActive                bool     `json:"isActive"`
	IsFeatured              bool     `json:"isFeatured"`
	IsAvailable             bool     `json:"isAvailable"`
}

type Dashboard struct {
	RevenueToday     float64 `json:"revenueToday"`
	RevenueMonth     float64 `json:"revenueMonth"`
	PendingOrders    int     `json:"pendingOrders"`
	PaidOrders       int     `json:"paidOrders"`
	LowStockProducts int     `json:"lowStockProducts"`
	Customers        int     `json:"customers"`
}
