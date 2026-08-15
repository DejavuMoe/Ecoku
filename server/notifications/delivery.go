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
	"mime/multipart"
	"mime/quotedprintable"
	"net"
	"net/http"
	"net/smtp"
	"net/textproto"
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
	payload, err := buildSMTPPayload(config.FromAddress, recipient, message)
	if err != nil {
		_ = writer.Close()
		return err
	}
	if _, err := writer.Write(payload); err != nil {
		_ = writer.Close()
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	return client.Quit()
}

func buildSMTPPayload(from, recipient string, message emailMessage) ([]byte, error) {
	var parts bytes.Buffer
	multipartWriter := multipart.NewWriter(&parts)
	if err := writeQuotedPart(multipartWriter, "text/plain; charset=UTF-8", message.Text); err != nil {
		return nil, err
	}
	if err := writeQuotedPart(multipartWriter, "text/html; charset=UTF-8", message.HTML); err != nil {
		return nil, err
	}
	if err := multipartWriter.Close(); err != nil {
		return nil, err
	}
	var payload bytes.Buffer
	fmt.Fprintf(&payload, "From: %s\r\n", from)
	fmt.Fprintf(&payload, "To: %s\r\n", recipient)
	fmt.Fprintf(&payload, "Subject: %s\r\n", mime.QEncoding.Encode("UTF-8", message.Subject))
	payload.WriteString("MIME-Version: 1.0\r\n")
	fmt.Fprintf(&payload, "Content-Type: multipart/alternative; boundary=%s\r\n\r\n", multipartWriter.Boundary())
	payload.Write(parts.Bytes())
	return payload.Bytes(), nil
}

func writeQuotedPart(writer *multipart.Writer, contentType, body string) error {
	header := make(textproto.MIMEHeader)
	header.Set("Content-Type", contentType)
	header.Set("Content-Transfer-Encoding", "quoted-printable")
	part, err := writer.CreatePart(header)
	if err != nil {
		return err
	}
	encoder := quotedprintable.NewWriter(part)
	if _, err := encoder.Write([]byte(body)); err != nil {
		_ = encoder.Close()
		return err
	}
	return encoder.Close()
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
