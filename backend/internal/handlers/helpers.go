package handlers

import (
	"errors"
	"net/http"

	"onperfumaria/backend/internal/services"

	"github.com/gin-gonic/gin"
)

func respond(c *gin.Context, data interface{}, err error) {
	if err != nil {
		if errors.Is(err, services.ErrInvalidCredentials) {
			c.JSON(http.StatusUnauthorized, gin.H{"message": err.Error()})
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
