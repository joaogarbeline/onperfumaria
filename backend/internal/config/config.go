package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port          string
	DatabaseURL   string
	JWTSecret     string
	FrontendURL   string
	AutoSeed      bool
	DefaultTaxFee float64
}

func Load() Config {
	_ = godotenv.Load()

	cfg := Config{
		Port:          getEnv("PORT", "8080"),
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/onperfumaria?sslmode=disable"),
		JWTSecret:     getEnv("JWT_SECRET", "change-me-in-production"),
		FrontendURL:   getEnv("FRONTEND_URL", "http://localhost:5173"),
		AutoSeed:      getEnv("AUTO_SEED", "true") == "true",
		DefaultTaxFee: getFloatEnv("DEFAULT_TAX_FEE", 4.5),
	}

	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET must be set")
	}

	return cfg
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func getFloatEnv(key string, fallback float64) float64 {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fallback
	}
	return parsed
}
