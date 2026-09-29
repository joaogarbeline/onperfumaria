package handlers

import (
	"encoding/json"
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
		api.GET("/organizer", func(c *gin.Context) {
			data, err := service.GetOrganizerStore(c.Request.Context())
			respond(c, data, err)
		})
		api.PUT("/organizer", func(c *gin.Context) {
			var input json.RawMessage
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.SaveOrganizerStore(c.Request.Context(), input)
			respond(c, data, err)
		})
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
			_ = json.NewDecoder(resp.Body).Decode(&result)
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
	}

	customer := api.Group("/customer")
	customer.Use(middlewares.JWT(cfg, "customer"))
	{
		customer.GET("/me", func(c *gin.Context) {
			data, err := service.CustomerProfile(c.Request.Context(), c.GetString("userID"))
			respond(c, data, err)
		})
		customer.GET("/orders/:id", func(c *gin.Context) {
			data, err := service.CustomerOrder(c.Request.Context(), c.GetString("userID"), c.Param("id"))
			respond(c, data, err)
		})
		customer.PUT("/me", func(c *gin.Context) {
			var input services.CustomerProfilePayload
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.UpdateCustomerProfile(c.Request.Context(), c.GetString("userID"), input)
			respond(c, data, err)
		})
		customer.POST("/addresses", func(c *gin.Context) {
			var input services.CustomerAddressPayload
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.SaveCustomerAddress(c.Request.Context(), c.GetString("userID"), input)
			respond(c, data, err)
		})
		customer.PUT("/addresses/:id/default", func(c *gin.Context) {
			data, err := service.SetDefaultCustomerAddress(c.Request.Context(), c.GetString("userID"), c.Param("id"))
			respond(c, data, err)
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
