package turnstile

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const DefaultSiteverifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

var (
	ErrFailed      = errors.New("turnstile verification failed")
	siteverifyURL  = DefaultSiteverifyURL
	httpClient     = &http.Client{Timeout: 10 * time.Second}
	maxVerifyBytes = int64(1 << 20)
)

func ConfigureSiteverify(rawURL string, client *http.Client) func() {
	previousURL, previousClient := siteverifyURL, httpClient
	if strings.TrimSpace(rawURL) != "" {
		siteverifyURL = rawURL
	}
	if client != nil {
		httpClient = client
	}
	return func() {
		siteverifyURL = previousURL
		httpClient = previousClient
	}
}

type siteverifyResponse struct {
	Success bool `json:"success"`
}

func Verify(ctx context.Context, token string) error {
	row, err := loadSetting()
	if err != nil {
		return err
	}
	if !row.Enabled {
		return nil
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return ErrFailed
	}
	secret, err := decryptSecret(row.SecretCipher)
	if err != nil || secret == "" {
		return ErrFailed
	}
	form := url.Values{}
	form.Set("secret", secret)
	form.Set("response", token)
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, siteverifyURL, strings.NewReader(form.Encode()))
	if err != nil {
		return ErrFailed
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := httpClient.Do(request)
	if err != nil {
		return ErrFailed
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, maxVerifyBytes))
	if err != nil {
		return ErrFailed
	}
	var parsed siteverifyResponse
	if err := json.Unmarshal(body, &parsed); err != nil || !parsed.Success {
		return ErrFailed
	}
	return nil
}
