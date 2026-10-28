package services

import (
	"context"
	"errors"
)

// RecordProductEvent guarda visualizacao/clique de item so como sinal de
// analytics. product_id e TEXT (nao tem chave estrangeira), entao vale tanto
// para os ids do Organizador quanto para o que ja foi gravado antes dele.
func (s *Service) RecordProductEvent(ctx context.Context, customerID, sessionID, productID, eventType string) error {
	if sessionID == "" {
		return errors.New("sessao e obrigatoria")
	}
	if productID == "" {
		return errors.New("produto e obrigatorio")
	}
	if eventType != "view" && eventType != "click" {
		return errors.New("tipo de evento invalido")
	}

	var custID *string
	if customerID != "" {
		custID = &customerID
	}

	_, err := s.db.Exec(ctx,
		`INSERT INTO product_events (customer_id, session_id, product_id, event_type) VALUES ($1, $2, $3, $4)`,
		custID, sessionID, productID, eventType,
	)
	return err
}

// PopularProducts e o ranking "Mais procurados" da home: o que os clientes
// mais olharam, clicaram e compraram (site + balcao) nos ultimos 30 dias.
// Compra pesa mais que clique, que pesa mais que visualizacao.
func (s *Service) PopularProducts(ctx context.Context, limit int) ([]string, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	rows, err := s.db.Query(ctx, `
		WITH scores AS (
			SELECT product_id AS id, CASE WHEN event_type = 'click' THEN 2 ELSE 1 END AS score
			FROM product_events
			WHERE created_at > NOW() - INTERVAL '30 days'
			UNION ALL
			SELECT oi.organizer_item_id, 5 * oi.quantity
			FROM order_items oi JOIN orders o ON o.id = oi.order_id
			WHERE oi.organizer_item_id IS NOT NULL
			  AND o.order_status IN ('pago', 'enviado', 'entregue')
			  AND o.created_at > NOW() - INTERVAL '30 days'
			UNION ALL
			SELECT pi.organizer_item_id, 5 * pi.quantity
			FROM pos_sale_items pi JOIN pos_sales ps ON ps.id = pi.pos_sale_id
			WHERE pi.organizer_item_id <> '' AND ps.status <> 'cancelada'
			  AND ps.created_at > NOW() - INTERVAL '30 days'
		)
		SELECT id FROM scores GROUP BY id ORDER BY SUM(score) DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
