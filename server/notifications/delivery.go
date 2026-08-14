package notifications

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/smtp"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var (
	sendSMTPMessage     = deliverSMTP
	sendTelegramMessage = deliverTelegram
	telegramAPIBaseURL  = "https://api.telegram.org"
)

type emailMessage struct {
	Subject string
	Text    string
	HTML    string
}

func deliverSMTP(ctx context.Context, config EmailConfig, recipient string, message emailMessage) error {
	address := net.JoinHostPort(config.Host, strconv.Itoa(config.Port))
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	var connection net.Conn
	var client *smtp.Client
	var err error
	if config.Encryption == "tls" {
		connection, err = tls.DialWithDialer(dialer, "tcp", address, &tls.Config{MinVersion: tls.VersionTLS12, ServerName: config.Host})
		if err == nil {
			client, err = smtp.NewClient(connection, config.Host)
		}
	} else {
		connection, err = dialer.DialContext(ctx, "tcp", address)
		if err == nil {
			client, err = smtp.NewClient(connection, config.Host)
		}
		if err == nil && config.Encryption == "starttls" {
			err = client.StartTLS(&tls.Config{MinVersion: tls.VersionTLS12, ServerName: config.Host})
		}
	}
	if err != nil {
		if connection != nil {
			_ = connection.Close()
		}
		return err
	}
	defer client.Close()
	_ = connection.SetDeadline(time.Now().Add(20 * time.Second))
	if config.Username != "" {
		if err := client.Auth(smtp.PlainAuth("", config.Username, config.Password, config.Host)); err != nil {
			return err
		}
	}
	if err := client.Mail(config.FromAddress); err != nil {
		return err
	}
	if err := client.Rcpt(recipient); err != nil {
		return err
	}
	writer, err := client.Data()
	if err != nil {
		return err
	}
	boundary := "ecoku-boundary-7f53"
	payload := strings.Join([]string{
		"From: " + config.FromAddress,
		"To: " + recipient,
		"Subject: " + mime.QEncoding.Encode("UTF-8", message.Subject),
		"MIME-Version: 1.0",
		"Content-Type: multipart/alternative; boundary=\"" + boundary + "\"",
		"",
		"--" + boundary,
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
		"",
		message.Text,
		"--" + boundary,
		"Content-Type: text/html; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
		"",
		message.HTML,
		"--" + boundary + "--",
		"",
	}, "\r\n")
	if _, err := io.WriteString(writer, payload); err != nil {
		_ = writer.Close()
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	return client.Quit()
}

func deliverTelegram(ctx context.Context, token, target, message string) error {
	body, err := json.Marshal(map[string]any{
		"chat_id": target, "text": message, "parse_mode": "HTML",
		"disable_web_page_preview": true,
	})
	if err != nil {
		return err
	}
	endpoint := strings.TrimRight(telegramAPIBaseURL, "/") + "/bot" + url.PathEscape(token) + "/sendMessage"
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 15 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 64*1024))
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("telegram returned status %d", response.StatusCode)
	}
	return nil
}

func deliveryErrorCode(err error) string {
	if err == nil {
		return ""
	}
	var netErr net.Error
	switch {
	case errors.As(err, &netErr) && netErr.Timeout():
		return "timeout"
	case strings.Contains(strings.ToLower(err.Error()), "auth") || strings.Contains(err.Error(), "535"):
		return "authentication_failed"
	case strings.Contains(strings.ToLower(err.Error()), "certificate") || strings.Contains(strings.ToLower(err.Error()), "tls"):
		return "tls_failed"
	default:
		return "delivery_failed"
	}
}
