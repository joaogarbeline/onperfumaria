package payments

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

type OAuthTokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
	Scope        string `json:"scope"`
	UserID       int64  `json:"user_id"`
	RefreshToken string `json:"refresh_token"`
	PublicKey    string `json:"public_key"`
}

func BuildMPAuthorizationURL(clientID, redirectURI, state string) string {
	q := url.Values{}
	q.Set("client_id", clientID)
	q.Set("response_type", "code")
	q.Set("platform_id", "mp")
	q.Set("redirect_uri", redirectURI)
	q.Set("state", state)
	return "https://auth.mercadopago.com/authorization?" + q.Encode()
}

func ExchangeMPCode(clientID, clientSecret, code, redirectURI string) (*OAuthTokenResponse, error) {
	return postMPOAuth(map[string]string{
		"client_id":     clientID,
		"client_secret": clientSecret,
		"grant_type":    "authorization_code",
		"code":          code,
		"redirect_uri":  redirectURI,
	})
}

func RefreshMPToken(clientID, clientSecret, refreshToken string) (*OAuthTokenResponse, error) {
	return postMPOAuth(map[string]string{
		"client_id":     clientID,
		"client_secret": clientSecret,
		"grant_type":    "refresh_token",
		"refresh_token": refreshToken,
	})
}

func postMPOAuth(fields map[string]string) (*OAuthTokenResponse, error) {
	body, _ := json.Marshal(fields)
	req, err := http.NewRequest("POST", "https://api.mercadopago.com/oauth/token", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("mercado pago oauth: %s", string(respBody))
	}

	var result OAuthTokenResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
