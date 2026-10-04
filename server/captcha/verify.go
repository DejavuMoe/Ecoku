package captcha

import (
	"bytes"
	"context"
	"ecoku-server/masterkey"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const DefaultTurnstileSiteverifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

var (
	ErrFailed       = errors.New("CAPTCHA verification failed")
	ErrUnavailable  = errors.New("CAPTCHA verification unavailable")
	turnstileURL    = DefaultTurnstileSiteverifyURL
	turnstileClient = &http.Client{
		Timeout: 10 * time.Second,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	capClient      = newCapHTTPClient()
	maxVerifyBytes = int64(1 << 20)
)

type Tokens struct {
	Captcha   string
	Turnstile string
}

type siteverifyResponse struct {
	Success bool `json:"success"`
}

func ConfigureTurnstileSiteverify(rawURL string, client *http.Client) func() {
	previousURL, previousClient := turnstileURL, turnstileClient
	if strings.TrimSpace(rawURL) != "" {
		turnstileURL = rawURL
	}
	if client != nil {
		turnstileClient = client
	}
	return func() {
		turnstileURL = previousURL
		turnstileClient = previousClient
	}
}

func ConfigureCapSiteverify(client *http.Client) func() {
	previous := capClient
	if client != nil {
		capClient = client
	}
	return func() { capClient = previous }
}

func Verify(ctx context.Context, tokens Tokens) error {
	row, err := loadSettingWithContext(ctx)
	if err != nil {
		return err
	}
	if !row.Enabled {
		return nil
	}
	tokens.Captcha = strings.TrimSpace(tokens.Captcha)
	tokens.Turnstile = strings.TrimSpace(tokens.Turnstile)
	switch row.Provider {
	case ProviderTurnstile:
		token, err := turnstileToken(tokens)
		if err != nil {
			return err
		}
		secret, err := masterkey.Decrypt(row.SecretCipher, turnstileSecretAAD)
		if err != nil || secret == "" {
			return ErrUnavailable
		}
		return verifyTurnstile(ctx, token, secret)
	case ProviderCap:
		if tokens.Captcha == "" || tokens.Turnstile != "" {
			return ErrFailed
		}
		secret, err := masterkey.Decrypt(row.CapSecretCipher, capSecretAAD)
		if err != nil || secret == "" {
			return ErrUnavailable
		}
		return verifyCap(ctx, tokens.Captcha, secret, row.CapInstanceURL, row.CapSitekey)
	default:
		return ErrUnavailable
	}
}

func turnstileToken(tokens Tokens) (string, error) {
	if tokens.Captcha != "" && tokens.Turnstile != "" && tokens.Captcha != tokens.Turnstile {
		return "", ErrFailed
	}
	if tokens.Captcha != "" {
		return tokens.Captcha, nil
	}
	if tokens.Turnstile != "" {
		return tokens.Turnstile, nil
	}
	return "", ErrFailed
}

func verifyTurnstile(ctx context.Context, token, secret string) error {
	form := url.Values{}
	form.Set("secret", secret)
	form.Set("response", token)
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, turnstileURL, strings.NewReader(form.Encode()))
	if err != nil {
		return ErrUnavailable
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	return executeSiteverify(request, turnstileClient)
}

func verifyCap(ctx context.Context, token, secret, instanceURL, sitekey string) error {
	if strings.TrimSpace(instanceURL) == "" || strings.TrimSpace(sitekey) == "" {
		return ErrUnavailable
	}
	endpoint := strings.TrimRight(instanceURL, "/") + "/" + url.PathEscape(sitekey) + "/siteverify"
	body, err := json.Marshal(map[string]string{"secret": secret, "response": token})
	if err != nil {
		return ErrUnavailable
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return ErrUnavailable
	}
	request.Header.Set("Content-Type", "application/json")
	return executeSiteverify(request, capClient)
}

func executeSiteverify(request *http.Request, client *http.Client) error {
	response, err := client.Do(request)
	if err != nil {
		return ErrUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return ErrUnavailable
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxVerifyBytes+1))
	if err != nil || int64(len(body)) > maxVerifyBytes {
		return ErrUnavailable
	}
	var parsed siteverifyResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return ErrUnavailable
	}
	if !parsed.Success {
		return ErrFailed
	}
	return nil
}

func Describe() (string, error) {
	settings, err := GetSettings()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("provider=%s turnstile_secret_set=%t cap_secret_set=%t",
		settings.Provider, settings.Turnstile.SecretSet, settings.Cap.SecretSet), nil
}
