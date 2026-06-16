package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"onperfumaria/backend/internal/auth"
	"onperfumaria/backend/internal/config"
	"onperfumaria/backend/internal/middlewares"
	"onperfumaria/backend/internal/services"
	"onperfumaria/backend/internal/shipping"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func NewRouter(cfg config.Config, db *pgxpool.Pool) *gin.Engine {
	router := gin.Default()
	router.Use(cors(cfg.FrontendURL))

	service := services.NewService(cfg, db)

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := router.Group("/api")
	{
		api.GET("/store/home", func(c *gin.Context) {
			data, err := service.StoreHome(c.Request.Context())
			respond(c, data, err)
		})
		api.GET("/products", func(c *gin.Context) {
			data, err := service.ListProducts(c.Request.Context())
			respond(c, data, err)
		})
		api.GET("/products/:slug", func(c *gin.Context) {
			data, err := service.GetProduct(c.Request.Context(), c.Param("slug"))
			respond(c, data, err)
		})
		api.GET("/store/config", func(c *gin.Context) {
			data, err := service.StoreConfig(c.Request.Context())
			respond(c, data, err)
		})
		api.POST("/shipping/quote", func(c *gin.Context) {
			var input shipping.QuoteInput
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.QuoteShipping(c.Request.Context(), input)
			respond(c, data, err)
		})
		api.POST("/store/validate-coupon", func(c *gin.Context) {
			var input struct {
				Code     string  `json:"code"`
				Subtotal float64 `json:"subtotal"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.ValidateCoupon(c.Request.Context(), input.Code, input.Subtotal)
			respond(c, data, err)
		})
		api.GET("/shipping/correios", func(c *gin.Context) {
			cep := c.Query("cep")
			weightGrams, _ := strconv.Atoi(c.DefaultQuery("weight", "0"))
			data, err := shipping.FetchCorreiosOptions("79000000", cep, weightGrams)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
				return
			}
			respond(c, data, nil)
		})
		api.POST("/checkout", func(c *gin.Context) {
			var input services.CheckoutInput
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			header := c.GetHeader("Authorization")
			if strings.HasPrefix(header, "Bearer ") {
				claims, err := auth.ParseToken(cfg.JWTSecret, strings.TrimPrefix(header, "Bearer "))
				if err == nil && claims.Scope == "customer" {
					input.CustomerID = claims.UserID
				}
			}
			data, err := service.CreateOrder(c.Request.Context(), input)
			respond(c, data, err)
		})
		api.GET("/order/:id", func(c *gin.Context) {
			data, err := service.GetOrderPublic(c.Request.Context(), c.Param("id"))
			respond(c, data, err)
		})
		api.POST("/auth/customer/recover", func(c *gin.Context) {
			var input struct {
				Email string `json:"email"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.RequestPasswordReset(c.Request.Context(), input.Email)
			respond(c, gin.H{"token": data}, err)
		})
		api.POST("/auth/customer/reset", func(c *gin.Context) {
			var input struct {
				Token    string `json:"token"`
				Password string `json:"password"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			err := service.ResetPassword(c.Request.Context(), input.Token, input.Password)
			respond(c, gin.H{"success": true}, err)
		})
		api.GET("/cep/:cep", func(c *gin.Context) {
			cep := strings.ReplaceAll(c.Param("cep"), "-", "")
			resp, err := http.Get("https://viacep.com.br/ws/" + cep + "/json/")
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "erro ao consultar CEP"})
				return
			}
			defer resp.Body.Close()
			var result map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&result)
			respond(c, result, nil)
		})
		api.POST("/auth/customer/register", func(c *gin.Context) {
			var input struct {
				Name     string `json:"name"`
				Email    string `json:"email"`
				Phone    string `json:"phone"`
				CPF      string `json:"cpf"`
				Password string `json:"password"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			token, err := service.CustomerRegister(c.Request.Context(), input.Name, input.Email, input.Password, input.Phone, input.CPF)
			respond(c, gin.H{"token": token}, err)
		})
		api.POST("/auth/customer/login", func(c *gin.Context) {
			var input struct {
				Email    string `json:"email"`
				Password string `json:"password"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			token, err := service.CustomerLogin(c.Request.Context(), input.Email, input.Password)
			respond(c, gin.H{"token": token}, err)
		})
		api.POST("/auth/admin/login", func(c *gin.Context) {
			var input struct {
				Email    string `json:"email"`
				Password string `json:"password"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			token, err := service.AdminLogin(c.Request.Context(), input.Email, input.Password)
			respond(c, gin.H{"token": token}, err)
		})
	}

	customer := api.Group("/customer")
	customer.Use(middlewares.JWT(cfg, "customer"))
	{
		customer.GET("/me", func(c *gin.Context) {
			userID := c.GetString("userID")
			data, err := service.CustomerProfile(c.Request.Context(), userID)
			respond(c, data, err)
		})
		customer.PUT("/me", func(c *gin.Context) {
			userID := c.GetString("userID")
			var input services.CustomerProfilePayload
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.UpdateCustomerProfile(c.Request.Context(), userID, input)
			respond(c, data, err)
		})
		customer.POST("/addresses", func(c *gin.Context) {
			userID := c.GetString("userID")
			var input services.CustomerAddressPayload
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.SaveCustomerAddress(c.Request.Context(), userID, input)
			respond(c, data, err)
		})
		customer.PUT("/addresses/:id/default", func(c *gin.Context) {
			userID := c.GetString("userID")
			data, err := service.SetDefaultCustomerAddress(c.Request.Context(), userID, c.Param("id"))
			respond(c, data, err)
		})
	}

	admin := api.Group("/admin")
	admin.Use(middlewares.JWT(cfg, "admin"))
	{
		admin.GET("/dashboard", func(c *gin.Context) {
			data, err := service.Dashboard(c.Request.Context())
			respond(c, data, err)
		})
		admin.GET("/catalog-data", func(c *gin.Context) {
			data, err := service.CatalogOptions(c.Request.Context())
			respond(c, data, err)
		})
		admin.GET("/products", func(c *gin.Context) {
			data, err := service.ListAdminProducts(c.Request.Context())
			respond(c, data, err)
		})
		admin.GET("/products/:id", func(c *gin.Context) {
			data, err := service.GetAdminProduct(c.Request.Context(), c.Param("id"))
			respond(c, data, err)
		})
		admin.POST("/products", func(c *gin.Context) {
			var input services.ProductPayload
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.SaveProduct(c.Request.Context(), "", input)
			respond(c, data, err)
		})
		admin.PUT("/products/:id", func(c *gin.Context) {
			var input services.ProductPayload
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.SaveProduct(c.Request.Context(), c.Param("id"), input)
			respond(c, data, err)
		})
		admin.PUT("/orders/:id/status", func(c *gin.Context) {
			var input struct {
				Status string `json:"status"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			err := service.UpdateOrderStatus(c.Request.Context(), c.Param("id"), input.Status)
			respond(c, gin.H{"success": true}, err)
		})
		admin.GET("/coupons", func(c *gin.Context) {
			data, err := service.ListCoupons(c.Request.Context())
			respond(c, data, err)
		})
		admin.POST("/coupons", func(c *gin.Context) {
			var input struct {
				Code         string  `json:"code"`
				DiscountType string  `json:"discountType"`
				Value        float64 `json:"value"`
				IsActive     bool    `json:"isActive"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.SaveCoupon(c.Request.Context(), "", input.Code, input.DiscountType, input.Value, input.IsActive)
			respond(c, data, err)
		})
		admin.PUT("/coupons/:id", func(c *gin.Context) {
			var input struct {
				Code         string  `json:"code"`
				DiscountType string  `json:"discountType"`
				Value        float64 `json:"value"`
				IsActive     bool    `json:"isActive"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.SaveCoupon(c.Request.Context(), c.Param("id"), input.Code, input.DiscountType, input.Value, input.IsActive)
			respond(c, data, err)
		})
		admin.DELETE("/coupons/:id", func(c *gin.Context) {
			err := service.DeleteCoupon(c.Request.Context(), c.Param("id"))
			respond(c, gin.H{"success": true}, err)
		})
		admin.GET("/discount-rules", func(c *gin.Context) {
			data, err := service.ListDiscountRules(c.Request.Context())
			respond(c, data, err)
		})
		admin.POST("/discount-rules", func(c *gin.Context) {
			var input struct {
				Name         string  `json:"name"`
				TargetType   string  `json:"targetType"`
				TargetID     string  `json:"targetId"`
				DiscountType string  `json:"discountType"`
				Value        float64 `json:"value"`
				IsActive     bool    `json:"isActive"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.SaveDiscountRule(c.Request.Context(), "", input.Name, input.TargetType, input.TargetID, input.DiscountType, input.Value, input.IsActive)
			respond(c, data, err)
		})
		admin.PUT("/discount-rules/:id", func(c *gin.Context) {
			var input struct {
				Name         string  `json:"name"`
				TargetType   string  `json:"targetType"`
				TargetID     string  `json:"targetId"`
				DiscountType string  `json:"discountType"`
				Value        float64 `json:"value"`
				IsActive     bool    `json:"isActive"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.SaveDiscountRule(c.Request.Context(), c.Param("id"), input.Name, input.TargetType, input.TargetID, input.DiscountType, input.Value, input.IsActive)
			respond(c, data, err)
		})
		admin.DELETE("/discount-rules/:id", func(c *gin.Context) {
			err := service.DeleteDiscountRule(c.Request.Context(), c.Param("id"))
			respond(c, gin.H{"success": true}, err)
		})
		admin.GET("/export/orders", func(c *gin.Context) {
			data, err := service.ExportOrdersCSV(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
				return
			}
			c.Header("Content-Type", "text/csv; charset=utf-8")
			c.Header("Content-Disposition", "attachment; filename=pedidos.csv")
			c.String(http.StatusOK, string(data))
		})
		admin.GET("/products/:id/images", func(c *gin.Context) {
			data, err := service.ListProductImages(c.Request.Context(), c.Param("id"))
			respond(c, data, err)
		})
		admin.POST("/products/:id/images", func(c *gin.Context) {
			var input struct {
				ImageURL string `json:"imageUrl"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.AddProductImage(c.Request.Context(), c.Param("id"), input.ImageURL)
			respond(c, data, err)
		})
		admin.DELETE("/products/:id/images/:imageId", func(c *gin.Context) {
			err := service.DeleteProductImage(c.Request.Context(), c.Param("imageId"))
			respond(c, gin.H{"success": true}, err)
		})
		admin.PUT("/products/:id/main-image", func(c *gin.Context) {
			var input struct {
				ImageURL string `json:"imageUrl"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			err := service.SetProductMainImage(c.Request.Context(), c.Param("id"), input.ImageURL)
			respond(c, gin.H{"success": true}, err)
		})
		admin.DELETE("/products/:id", func(c *gin.Context) {
			err := service.DeactivateProduct(c.Request.Context(), c.Param("id"))
			respond(c, gin.H{"success": true}, err)
		})
		admin.GET("/orders", func(c *gin.Context) {
			page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
			limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
			filter := services.OrderFilter{
				Search:    c.Query("search"),
				Status:    c.Query("status"),
				Payment:   c.Query("payment"),
				StartDate: c.Query("startDate"),
				EndDate:   c.Query("endDate"),
				Page:      page,
				Limit:     limit,
			}
			data, err := service.Orders(c.Request.Context(), filter)
			respond(c, data, err)
		})
		admin.GET("/customers", func(c *gin.Context) {
			data, err := service.Customers(c.Request.Context(), c.Query("search"))
			respond(c, data, err)
		})
		admin.POST("/pos/sales", func(c *gin.Context) {
			var input struct {
				CustomerName  string                  `json:"customerName"`
				PaymentMethod string                  `json:"paymentMethod"`
				Discount      float64                 `json:"discount"`
				Items         []services.CheckoutItem `json:"items"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.POSSale(c.Request.Context(), input.CustomerName, input.PaymentMethod, input.Discount, input.Items)
			respond(c, data, err)
		})
		admin.POST("/upload", func(c *gin.Context) {
			file, err := c.FormFile("file")
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "arquivo obrigatorio"})
				return
			}

			uploadDir := filepath.Join("public", "uploads")
			if err := os.MkdirAll(uploadDir, 0755); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "erro ao criar diretorio de upload"})
				return
			}

			ext := filepath.Ext(file.Filename)
			filename := fmt.Sprintf("%s%s", uuid.New().String(), ext)
			savePath := filepath.Join(uploadDir, filename)

			if err := c.SaveUploadedFile(file, savePath); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "erro ao salvar arquivo"})
				return
			}

			respond(c, gin.H{"url": "/uploads/" + filename}, nil)
		})
		admin.GET("/brands", func(c *gin.Context) {
			data, err := service.ListBrands(c.Request.Context())
			respond(c, data, err)
		})
		admin.POST("/brands", func(c *gin.Context) {
			var input struct {
				Name string `json:"name"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.SaveBrand(c.Request.Context(), "", input.Name)
			respond(c, data, err)
		})
		admin.PUT("/brands/:id", func(c *gin.Context) {
			var input struct {
				Name string `json:"name"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.SaveBrand(c.Request.Context(), c.Param("id"), input.Name)
			respond(c, data, err)
		})
		admin.DELETE("/brands/:id", func(c *gin.Context) {
			err := service.DeleteBrand(c.Request.Context(), c.Param("id"))
			respond(c, gin.H{"success": true}, err)
		})
		admin.GET("/categories", func(c *gin.Context) {
			data, err := service.ListCategories(c.Request.Context())
			respond(c, data, err)
		})
		admin.POST("/categories", func(c *gin.Context) {
			var input struct {
				Name string `json:"name"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.SaveCategory(c.Request.Context(), "", input.Name)
			respond(c, data, err)
		})
		admin.PUT("/categories/:id", func(c *gin.Context) {
			var input struct {
				Name string `json:"name"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.SaveCategory(c.Request.Context(), c.Param("id"), input.Name)
			respond(c, data, err)
		})
		admin.DELETE("/categories/:id", func(c *gin.Context) {
			err := service.DeleteCategory(c.Request.Context(), c.Param("id"))
			respond(c, gin.H{"success": true}, err)
		})
		admin.GET("/product-types", func(c *gin.Context) {
			data, err := service.GetProductTypes(c.Request.Context())
			respond(c, data, err)
		})
		admin.PUT("/product-types", func(c *gin.Context) {
			var input struct {
				Types []string `json:"types"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.UpdateProductTypes(c.Request.Context(), input.Types)
			respond(c, data, err)
		})
		admin.GET("/mp-settings", func(c *gin.Context) {
			data, err := service.GetMPSettings(c.Request.Context())
			respond(c, data, err)
		})
		admin.PUT("/mp-settings", func(c *gin.Context) {
			var input struct {
				Key   string `json:"key"`
				Value string `json:"value"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			if err := service.SaveMPSetting(c.Request.Context(), input.Key, input.Value); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
				return
			}
			respond(c, gin.H{"success": true}, nil)
		})
	}

	router.Static("/uploads", filepath.Join("public", "uploads"))
	registerFrontend(router)

	router.POST("/api/webhooks/mercadopago", func(c *gin.Context) {
		var input struct {
			Action string `json:"action"`
			Data   struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		topic := c.Query("topic")
		paymentID := c.Query("id")

		if c.ShouldBindJSON(&input) == nil && input.Data.ID != "" {
			paymentID = input.Data.ID
		}

		if paymentID != "" {
			if err := service.HandleMPWebhook(c.Request.Context(), topic, paymentID); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
				return
			}
		}

		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	return router
}

func registerFrontend(router *gin.Engine) {
	publicDir := "public"
	indexPath := filepath.Join(publicDir, "index.html")

	if _, err := os.Stat(indexPath); err != nil {
		return
	}

	router.Static("/assets", filepath.Join(publicDir, "assets"))
	router.StaticFile("/", indexPath)
	router.NoRoute(func(c *gin.Context) {
		if c.Request.Method != http.MethodGet || strings.HasPrefix(c.Request.URL.Path, "/api") || c.Request.URL.Path == "/health" {
			c.JSON(http.StatusNotFound, gin.H{"message": "not found"})
			return
		}
		c.File(indexPath)
	})
}
