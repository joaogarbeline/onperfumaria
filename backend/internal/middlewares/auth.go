package middlewares

import (
	"net/http"
	"strings"

	"onperfumaria/backend/internal/auth"
	"onperfumaria/backend/internal/config"

	"github.com/gin-gonic/gin"
)

func JWT(cfg config.Config, scope string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "missing token"})
			c.Abort()
			return
		}

		claims, err := auth.ParseToken(cfg.JWTSecret, strings.TrimPrefix(header, "Bearer "))
		if err != nil || claims.Scope != scope {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "invalid token"})
			c.Abort()
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("role", claims.Role)
		c.Next()
	}
}
