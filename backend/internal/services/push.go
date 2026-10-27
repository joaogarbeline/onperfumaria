package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
)

const (
	vapidPublicKeySetting  = "push_vapid_public_key"
	vapidPrivateKeySetting = "push_vapid_private_key"
)

// PushSubscriptionInput e o objeto que o navegador devolve em
// PushManager.subscribe() (subscription.toJSON()).
type PushSubscriptionInput struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

// vapidKeys devolve o par de chaves que assina as notificacoes. Nasce sozinho
// no primeiro uso e fica salvo em settings: nao precisa configurar nada no
// servidor. Trocar as chaves invalida todos os aparelhos ja inscritos.
func (s *Service) vapidKeys(ctx context.Context) (string, string, error) {
	public, _ := s.GetSetting(ctx, vapidPublicKeySetting)
	private, _ := s.GetSetting(ctx, vapidPrivateKeySetting)
	if public != "" && private != "" {
		return public, private, nil
	}

	newPrivate, newPublic, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		return "", "", err
	}
	// DO NOTHING: se duas requisicoes gerarem ao mesmo tempo, vale a primeira
	// gravada, e as duas releem o que ficou no banco.
	if _, err := s.db.Exec(ctx, `
		INSERT INTO settings (key, value) VALUES ($1, $2), ($3, $4)
		ON CONFLICT (key) DO NOTHING`,
		vapidPublicKeySetting, newPublic, vapidPrivateKeySetting, newPrivate); err != nil {
		return "", "", err
	}
	public, _ = s.GetSetting(ctx, vapidPublicKeySetting)
	private, _ = s.GetSetting(ctx, vapidPrivateKeySetting)
	if public == "" || private == "" {
		return "", "", errors.New("chaves de notificacao indisponiveis")
	}
	return public, private, nil
}

func (s *Service) PushPublicKey(ctx context.Context) (string, error) {
	public, _, err := s.vapidKeys(ctx)
	return public, err
}

func (s *Service) SavePushSubscription(ctx context.Context, customerID, userAgent string, input PushSubscriptionInput) error {
	if !strings.HasPrefix(input.Endpoint, "https://") || input.Keys.P256dh == "" || input.Keys.Auth == "" {
		return errors.New("inscricao de notificacao invalida")
	}
	if len(userAgent) > 300 {
		userAgent = userAgent[:300]
	}
	_, err := s.db.Exec(ctx, `
		INSERT INTO push_subscriptions (customer_id, endpoint, p256dh, auth, user_agent)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (endpoint) DO UPDATE
		SET customer_id = EXCLUDED.customer_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
		    user_agent = EXCLUDED.user_agent`,
		customerID, input.Endpoint, input.Keys.P256dh, input.Keys.Auth, userAgent)
	return err
}

func (s *Service) DeletePushSubscription(ctx context.Context, customerID, endpoint string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM push_subscriptions WHERE endpoint = $1 AND customer_id = $2`, endpoint, customerID)
	return err
}

type pushPayload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url"`
	Tag   string `json:"tag"`
}

// NotifySale avisa todos os aparelhos dos administradores que um pedido foi
// pago. Roda em segundo plano (go s.NotifySale(...)): falha de push nunca
// atrapalha o checkout nem o webhook.
func (s *Service) NotifySale(orderID string) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	payload, err := s.salePushPayload(ctx, orderID)
	if err != nil {
		log.Printf("push: pedido %s: %v", orderID, err)
		return
	}
	s.sendPushToAdmins(ctx, payload)
}

func (s *Service) salePushPayload(ctx context.Context, orderID string) (pushPayload, error) {
	var customerName, firstItem string
	var total float64
	var itemCount int
	err := s.db.QueryRow(ctx, `
		SELECT COALESCE(NULLIF(split_part(c.name, ' ', 1), ''), 'Cliente'), o.total_amount,
			COALESCE((SELECT SUM(quantity) FROM order_items WHERE order_id = o.id), 0),
			COALESCE((SELECT product_name FROM order_items WHERE order_id = o.id ORDER BY line_total DESC LIMIT 1), '')
		FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
		WHERE o.id = $1`, orderID).Scan(&customerName, &total, &itemCount, &firstItem)
	if err != nil {
		return pushPayload{}, err
	}

	body := fmt.Sprintf("%s comprou %s", customerName, formatBRL(total))
	if firstItem != "" {
		body += " · " + firstItem
		if itemCount > 1 {
			body += fmt.Sprintf(" e mais %d", itemCount-1)
		}
	}
	return pushPayload{
		Title: "Nova venda! 💜",
		Body:  body,
		URL:   "/admin?painel=pedidos&pedido=" + orderID,
		Tag:   "venda-" + orderID,
	}, nil
}

// SendTestPush manda uma notificacao de teste para os aparelhos de um admin.
func (s *Service) SendTestPush(ctx context.Context, customerID string) (int, error) {
	return s.sendPush(ctx, pushPayload{
		Title: "Notificações ativadas ✨",
		Body:  "Você vai receber um aviso aqui a cada venda da On Perfumaria.",
		URL:   "/admin?painel=pedidos",
		Tag:   "teste",
	}, `WHERE ps.customer_id = $1`, customerID)
}

func (s *Service) sendPushToAdmins(ctx context.Context, payload pushPayload) {
	if _, err := s.sendPush(ctx, payload, `JOIN customers c ON c.id = ps.customer_id WHERE c.is_admin = true`); err != nil {
		log.Printf("push: %v", err)
	}
}

func (s *Service) sendPush(ctx context.Context, payload pushPayload, filter string, args ...interface{}) (int, error) {
	public, private, err := s.vapidKeys(ctx)
	if err != nil {
		return 0, err
	}
	message, err := json.Marshal(payload)
	if err != nil {
		return 0, err
	}

	rows, err := s.db.Query(ctx, `SELECT ps.endpoint, ps.p256dh, ps.auth FROM push_subscriptions ps `+filter, args...)
	if err != nil {
		return 0, err
	}
	var subscriptions []webpush.Subscription
	for rows.Next() {
		var sub webpush.Subscription
		if err := rows.Scan(&sub.Endpoint, &sub.Keys.P256dh, &sub.Keys.Auth); err != nil {
			rows.Close()
			return 0, err
		}
		subscriptions = append(subscriptions, sub)
	}
	rows.Close()

	sent := 0
	for i := range subscriptions {
		resp, err := webpush.SendNotificationWithContext(ctx, message, &subscriptions[i], &webpush.Options{
			Subscriber:      s.pushSubscriber(),
			VAPIDPublicKey:  public,
			VAPIDPrivateKey: private,
			TTL:             60 * 60 * 24,
			Urgency:         webpush.UrgencyHigh,
		})
		if err != nil {
			log.Printf("push: envio falhou: %v", err)
			continue
		}
		resp.Body.Close()
		// 404/410: o aparelho cancelou a inscricao (app desinstalado,
		// permissao revogada). Nao adianta tentar de novo.
		if resp.StatusCode == http.StatusGone || resp.StatusCode == http.StatusNotFound {
			s.db.Exec(ctx, `DELETE FROM push_subscriptions WHERE endpoint = $1`, subscriptions[i].Endpoint)
			continue
		}
		if resp.StatusCode >= 400 {
			log.Printf("push: servico de push respondeu %d", resp.StatusCode)
			continue
		}
		sent++
	}
	return sent, nil
}

// pushSubscriber e o contato que vai assinado nas notificacoes (exigido pelos
// servicos de push; a Apple recusa valores invalidos). O dominio da loja
// quando ha https, senao um e-mail.
func (s *Service) pushSubscriber() string {
	if strings.HasPrefix(s.cfg.FrontendURL, "https://") {
		return s.cfg.FrontendURL
	}
	if s.cfg.AdminEmail != "" {
		return s.cfg.AdminEmail
	}
	return "contato@onperfumaria.com"
}

func formatBRL(value float64) string {
	cents := int64(value*100 + 0.5)
	reais := cents / 100
	digits := fmt.Sprintf("%d", reais)
	var grouped strings.Builder
	for i, digit := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			grouped.WriteByte('.')
		}
		grouped.WriteRune(digit)
	}
	return fmt.Sprintf("R$ %s,%02d", grouped.String(), cents%100)
}
