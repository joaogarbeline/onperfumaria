package config

import (
	"errors"
	"os"
	"os/exec"
	"strings"
	"testing"
)

const strongTestSecret = "0123456789abcdef0123456789abcdef"

func TestValidateJWTSecret(t *testing.T) {
	cases := []struct {
		name    string
		secret  string
		wantErr bool
	}{
		{name: "vazio", secret: "", wantErr: true},
		{name: "antigo valor padrao", secret: "change-me-in-production", wantErr: true},
		{name: "31 caracteres", secret: strongTestSecret[:31], wantErr: true},
		{name: "32 caracteres", secret: strongTestSecret, wantErr: false},
		{name: "padrao do docker-compose.dev.yml", secret: "onperfumaria-local-development-secret", wantErr: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateJWTSecret(tc.secret)
			if (err != nil) != tc.wantErr {
				t.Fatalf("validateJWTSecret(%q) = %v, esperado erro: %v", tc.secret, err, tc.wantErr)
			}
		})
	}
}

func TestLoadKeepsStrongJWTSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", strongTestSecret)
	if cfg := Load(); cfg.JWTSecret != strongTestSecret {
		t.Fatalf("JWTSecret = %q, esperado o valor do ambiente", cfg.JWTSecret)
	}
}

// Load encerra o processo com log.Fatal, entao cada caso roda o proprio
// binario de teste num subprocesso e confere que ele saiu com erro.
func TestLoadExitsOnWeakJWTSecret(t *testing.T) {
	if os.Getenv("CONFIG_TEST_RUN_LOAD") == "1" {
		Load()
		return
	}

	for _, secret := range []string{"", "change-me-in-production", "curto-demais"} {
		cmd := exec.Command(os.Args[0], "-test.run=^TestLoadExitsOnWeakJWTSecret$")
		cmd.Env = append(os.Environ(), "CONFIG_TEST_RUN_LOAD=1", "JWT_SECRET="+secret)
		out, err := cmd.CombinedOutput()

		var exitErr *exec.ExitError
		if !errors.As(err, &exitErr) {
			t.Fatalf("JWT_SECRET=%q: servidor subiria (err=%v, saida=%s)", secret, err, out)
		}
		if !strings.Contains(string(out), "JWT_SECRET") {
			t.Fatalf("JWT_SECRET=%q: mensagem nao cita a variavel: %s", secret, out)
		}
	}
}
