package handlers

import (
	"errors"
	"net/http"
	"strings"

	"onperfumaria/backend/internal/auth"
	"onperfumaria/backend/internal/config"
	"onperfumaria/backend/internal/services"

	"github.com/gin-gonic/gin"
)

// optionalCustomerID le o token "Bearer" quando presente, sem exigir login:
// usada em rotas publicas que personalizam a resposta so quando ha cliente
// autenticado (ex.: eventos de produto, carrosseis da home).
func optionalCustomerID(cfg config.Config, c *gin.Context) string {
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

func respond(c *gin.Context, data interface{}, err error) {
	if err != nil {
		if errors.Is(err, services.ErrInvalidCredentials) {
			c.JSON(http.StatusUnauthorized, gin.H{"message": err.Error()})
			return
		}
		// A ficha de cadastro precisa saber qual campo reprovou para destacar o
		// input certo em vez de mostrar um erro generico no topo do formulario.
		var conflict *services.FieldConflictError
		if errors.As(err, &conflict) {
			c.JSON(http.StatusConflict, gin.H{"message": conflict.Message, "field": conflict.Field})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func cors(frontendURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if frontendURL != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", frontendURL)
		}
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
