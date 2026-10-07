package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

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
		api.PUT("/organizer", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
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
			input.CustomerID = customerIDFromHeader(cfg, c)
			data, err := service.CreateOrder(c.Request.Context(), input)
			respond(c, data, err)
		})
		api.GET("/order/:id", func(c *gin.Context) {
			data, err := service.GetOrderPublic(c.Request.Context(), c.Param("id"))
			respond(c, data, err)
		})
		api.GET("/orders", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
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
		api.GET("/customers", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
			data, err := service.Customers(c.Request.Context(), c.Query("search"), c.GetString("userID"))
			respond(c, data, err)
		})
		api.GET("/customers/:id", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
			data, err := service.CustomerProfile(c.Request.Context(), c.Param("id"), c.GetString("userID"))
			respond(c, data, err)
		})
		// A gaveta "API" guarda tokens e chaves sensiveis (Mercado Pago, Google) e
		// so o administrador fixo da loja pode ver ou editar - mesmo outro admin
		// promovido em Contas recebe 403 aqui.
		api.GET("/admin/api-settings", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
			isFixedAdmin, err := service.IsFixedAdmin(c.Request.Context(), c.GetString("userID"))
			if err != nil || !isFixedAdmin {
				c.JSON(http.StatusForbidden, gin.H{"message": "acesso restrito ao administrador fixo"})
				return
			}
			data, err := service.GetAPISettings(c.Request.Context())
			respond(c, data, err)
		})
		api.PUT("/admin/api-settings", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
			isFixedAdmin, err := service.IsFixedAdmin(c.Request.Context(), c.GetString("userID"))
			if err != nil || !isFixedAdmin {
				c.JSON(http.StatusForbidden, gin.H{"message": "acesso restrito ao administrador fixo"})
				return
			}
			var input struct {
				Key   string `json:"key"`
				Value string `json:"value"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			allowedKeys := map[string]bool{
				"mp_access_token": true, "mp_public_key": true, "mp_webhook_secret": true, "google_client_id": true,
			}
			if !allowedKeys[input.Key] {
				c.JSON(http.StatusBadRequest, gin.H{"message": "chave de configuracao invalida"})
				return
			}
			err = service.SaveSetting(c.Request.Context(), input.Key, input.Value)
			respond(c, gin.H{"success": true}, err)
		})
		// So quem ja e admin pode promover outro cliente. A unica excecao e a
		// loja recem-instalada (nenhum admin ainda): nesse caso a rota libera
		// uma vez sem token para destravar o primeiro acesso.
		api.PUT("/customers/:id/admin", func(c *gin.Context) {
			var input struct {
				IsAdmin bool `json:"isAdmin"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}

			adminCount, err := service.CountAdmins(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
				return
			}

			if adminCount > 0 {
				header := c.GetHeader("Authorization")
				claims, err := auth.ParseToken(cfg.JWTSecret, strings.TrimPrefix(header, "Bearer "))
				if !strings.HasPrefix(header, "Bearer ") || err != nil || claims.Scope != "customer" || claims.Role != "admin" {
					c.JSON(http.StatusForbidden, gin.H{"message": "acesso restrito a administradores"})
					return
				}
			}

			data, err := service.SetCustomerAdmin(c.Request.Context(), c.Param("id"), input.IsAdmin)
			respond(c, data, err)
		})
		// Enviar e-mail custa caro e e uma via de abuso, entao a janela aqui e
		// bem mais curta que a das outras rotas.
		api.POST("/auth/customer/recover", middlewares.RateLimit("recover", 5, 15*time.Minute), func(c *gin.Context) {
			var input struct {
				Identifier string `json:"identifier"`
				Email      string `json:"email"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			identifier := input.Identifier
			if identifier == "" {
				identifier = input.Email
			}
			// A resposta e sempre a mesma, com ou sem cadastro: o token sai por
			// e-mail e nunca pelo corpo da resposta.
			err := service.RequestPasswordReset(c.Request.Context(), identifier)
			respond(c, gin.H{"sent": true}, err)
		})
		api.POST("/auth/customer/reset", middlewares.RateLimit("reset", 10, time.Minute), func(c *gin.Context) {
			var input struct {
				Token    string `json:"token"`
				Password string `json:"password"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.ResetPassword(c.Request.Context(), input.Token, input.Password)
			respond(c, data, err)
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
		// Etapa 1 do login: descobre se o e-mail/CPF digitado tem cadastro e
		// como essa conta entra (senha, Google ou os dois).
		api.POST("/auth/customer/identify", middlewares.RateLimit("identify", 20, time.Minute), func(c *gin.Context) {
			var input struct {
				Identifier string `json:"identifier"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.IdentifyCustomer(c.Request.Context(), input.Identifier)
			respond(c, data, err)
		})
		// Checagem em tempo real da ficha: diz quais campos ja existem no banco.
		api.POST("/auth/customer/availability", middlewares.RateLimit("availability", 30, time.Minute), func(c *gin.Context) {
			var input struct {
				Email string `json:"email"`
				CPF   string `json:"cpf"`
				Phone string `json:"phone"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.CustomerFieldConflicts(c.Request.Context(), input.Email, input.CPF, input.Phone, customerIDFromHeader(cfg, c))
			respond(c, gin.H{"conflicts": data}, err)
		})
		api.POST("/auth/customer/google", middlewares.RateLimit("google", 10, time.Minute), func(c *gin.Context) {
			var input struct {
				Credential string `json:"credential"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.GoogleSignIn(c.Request.Context(), input.Credential)
			respond(c, data, err)
		})
		api.POST("/auth/customer/register", middlewares.RateLimit("register", 5, 10*time.Minute), func(c *gin.Context) {
			var input services.CustomerRegistrationPayload
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			// Com token, a mesma ficha completa o cadastro de quem entrou pelo
			// Google e chegou aqui com telefone/CPF/endereco em branco.
			data, err := service.RegisterCustomer(c.Request.Context(), customerIDFromHeader(cfg, c), input)
			respond(c, data, err)
		})
		api.POST("/auth/customer/login", middlewares.RateLimit("login", 10, time.Minute), func(c *gin.Context) {
			var input struct {
				Identifier string `json:"identifier"`
				Email      string `json:"email"`
				Password   string `json:"password"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			identifier := input.Identifier
			if identifier == "" {
				identifier = input.Email
			}
			token, err := service.CustomerLoginIdentifier(c.Request.Context(), identifier, input.Password)
			respond(c, gin.H{"token": token}, err)
		})
	}

	customer := api.Group("/customer")
	customer.Use(middlewares.JWT(cfg, "customer"))
	{
		customer.GET("/me", func(c *gin.Context) {
			userID := c.GetString("userID")
			data, err := service.CustomerProfile(c.Request.Context(), userID, userID)
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

	// Os arquivos em /assets têm hash no nome (ex: index-AbC123.js) e mudam a
	// cada build, então podem ser cacheados para sempre. Já o index.html
	// referencia esses hashes e é sobrescrito a cada deploy: sem
	// no-cache aqui, o navegador podia guardar uma versão antiga da página
	// apontando para arquivos que o deploy seguinte já apagou.
	router.Use(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/assets/") {
			c.Header("Cache-Control", "public, max-age=31536000, immutable")
		}
		c.Next()
	})

	serveIndex := func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.File(indexPath)
	}

	router.Static("/assets", filepath.Join(publicDir, "assets"))
	router.GET("/", serveIndex)
	router.NoRoute(func(c *gin.Context) {
		if c.Request.Method != http.MethodGet || strings.HasPrefix(c.Request.URL.Path, "/api") || c.Request.URL.Path == "/health" {
			c.JSON(http.StatusNotFound, gin.H{"message": "not found"})
			return
		}
		serveIndex(c)
	})
}

// customerIDFromHeader le o token opcional de rotas publicas que mudam de
// comportamento quando o cliente ja esta logado. Devolve "" para visitantes.
func customerIDFromHeader(cfg config.Config, c *gin.Context) string {
	header := c.GetHeader("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return ""
	}
	claims, err := auth.ParseToken(cfg.JWTSecret, strings.TrimPrefix(header, "Bearer "))
	if err != nil || claims.Scope != "customer" {
		return ""
	}
	return claims.UserID
}
