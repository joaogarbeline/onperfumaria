package config

import (
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// minJWTSecretLength: quem conhece o JWT_SECRET assina token de admin, entao
// ele precisa ser longo e exclusivo de cada ambiente.
const minJWTSecretLength = 32

type Config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	FrontendURL    string
	GoogleClientID string
	AutoSeed       bool
	// Cria a conta de teste do seed_demo.go. So para desenvolvimento.
	SeedDemoCustomer bool
	DefaultTaxFee    float64
	// Garantem a conta fixa de administrador em qualquer ambiente, inclusive
	// producao. Sem as duas, SeedAdmin nao faz nada.
	AdminEmail    string
	AdminPassword string

	SMTPHost     string
	SMTPPort     string
	SMTPUser     string
	SMTPPassword string
	SMTPFrom     string
	SMTPFromName string
	// Em dev, sem SMTP, imprime o link de recuperacao no log do servidor.
	// Nunca ligar em producao: quem le o log troca a senha de qualquer cliente.
	DebugPasswordResetLink bool
	// Em dev, sem token do Mercado Pago, usa o provider de mentira, que
	// aprova cartao sem cobrar nada. Nunca ligar em producao: desligado, o
	// checkout sem token e recusado.
	PaymentsMock bool
}

func Load() Config {
	_ = godotenv.Load()

	cfg := Config{
		Port:             getEnv("PORT", "8080"),
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/onperfumaria?sslmode=disable"),
		JWTSecret:        getEnv("JWT_SECRET", ""),
		FrontendURL:      getEnv("FRONTEND_URL", "http://localhost:5173"),
		GoogleClientID:   getEnv("GOOGLE_CLIENT_ID", ""),
		AutoSeed:         getEnv("AUTO_SEED", "true") == "true",
		SeedDemoCustomer: getEnv("SEED_DEMO_CUSTOMER", "false") == "true",
		DefaultTaxFee:    getFloatEnv("DEFAULT_TAX_FEE", 4.5),
		AdminEmail:       getEnv("ADMIN_EMAIL", ""),
		AdminPassword:    getEnv("ADMIN_PASSWORD", ""),

		SMTPHost:               getEnv("SMTP_HOST", ""),
		SMTPPort:               getEnv("SMTP_PORT", "587"),
		SMTPUser:               getEnv("SMTP_USER", ""),
		SMTPPassword:           getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:               getEnv("SMTP_FROM", ""),
		SMTPFromName:           getEnv("SMTP_FROM_NAME", "On Perfumaria"),
		DebugPasswordResetLink: getEnv("DEBUG_PASSWORD_RESET_LINK", "false") == "true",
		PaymentsMock:           getEnv("PAYMENTS_MOCK", "false") == "true",
	}

	if err := validateJWTSecret(cfg.JWTSecret); err != nil {
		log.Fatalf("%v. Gere um segredo com: openssl rand -hex 32", err)
	}
	if cfg.PaymentsMock {
		log.Println("PAYMENTS_MOCK ligado: sem token do Mercado Pago, pagamentos sao aprovados sem cobranca. So para desenvolvimento.")
	}

	return cfg
}

// validateJWTSecret recusa segredo vazio, curto ou igual ao antigo valor
// padrao, que e publico no historico do repositorio.
func validateJWTSecret(secret string) error {
	switch {
	case secret == "":
		return errors.New("JWT_SECRET nao definido")
	case secret == "change-me-in-production":
		return errors.New("JWT_SECRET ainda esta com o valor de exemplo change-me-in-production")
	case len(secret) < minJWTSecretLength:
		return fmt.Errorf("JWT_SECRET tem %d caracteres; o minimo e %d", len(secret), minJWTSecretLength)
	}
	return nil
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
