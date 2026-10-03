package notifications

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net"
	"net/http"
	"net/mail"
	"net/smtp"
	"net/textproto"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode"
)

var (
	sendSMTPMessage     = deliverSMTP
	sendTelegramMessage = deliverTelegram
	editTelegramMessage = editTelegram
	telegramAPIBaseURL  = "https://api.telegram.org"
)

type emailMessage struct {
	Subject    string
	SenderName string
	Text       string
	HTML       string
}

// deliveryFailure carries the outbox error code and whether a retry can help.
// Its text never includes the remote response body.
type deliveryFailure struct {
	code       string
	permanent  bool
	retryAfter time.Duration
	cause      error
}

func (failure *deliveryFailure) Error() string { return failure.code }

func (failure *deliveryFailure) Unwrap() error { return failure.cause }

func deliverSMTP(ctx context.Context, config EmailConfig, recipient string, message emailMessage) error {
	address := net.JoinHostPort(config.Host, strconv.Itoa(config.Port))
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	connection, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return err
	}
	defer connection.Close()
	stop := context.AfterFunc(ctx, func() { _ = connection.Close() })
	defer stop()
	deadline, _ := ctx.Deadline()
	if err := connection.SetDeadline(deadline); err != nil {
		return err
	}
	var smtpConnection net.Conn = connection
	tlsConfig := &tls.Config{MinVersion: tls.VersionTLS12, ServerName: config.Host}
	if config.Encryption == "tls" {
		secure := tls.Client(connection, tlsConfig)
		if err := secure.HandshakeContext(ctx); err != nil {
			return err
		}
		smtpConnection = secure
	}
	client, err := smtp.NewClient(smtpConnection, config.Host)
	if err != nil {
		return err
	}
	defer client.Close()
	if config.Encryption == "starttls" {
		if err := client.StartTLS(tlsConfig); err != nil {
			return err
		}
	}
	if config.Username != "" {
		if err := client.Auth(smtp.PlainAuth("", config.Username, config.Password, config.Host)); err != nil {
			return err
		}
	}
	if err := client.Mail(config.FromAddress); err != nil {
		return err
	}
	if err := client.Rcpt(recipient); err != nil {
		return smtpRejection(err, "recipient_rejected")
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
		return smtpRejection(err, "message_rejected")
	}
	return client.Quit()
}

// smtpRejection marks 55x replies as permanent: the mailbox or the message was
// refused, and sending the same message again will not change that. Other
// replies, including authentication failures, stay retryable so a corrected
// setting can still deliver queued notifications.
func smtpRejection(err error, code string) error {
	var reply *textproto.Error
	if errors.As(err, &reply) && reply.Code >= 550 && reply.Code <= 559 {
		return &deliveryFailure{code: code, permanent: true, cause: err}
	}
	return err
}

func buildSMTPPayload(from, recipient string, message emailMessage) ([]byte, error) {
	var parts bytes.Buffer
	multipartWriter := multipart.NewWriter(&parts)
	if err := writeQuotedPart(multipartWriter, "text/plain; charset=UTF-8", message.Text); err != nil {
		return nil, err
	}
	if err := writeHTMLPart(multipartWriter, message.HTML); err != nil {
		return nil, err
	}
	if err := multipartWriter.Close(); err != nil {
		return nil, err
	}
	messageID, err := newMessageID(from)
	if err != nil {
		return nil, err
	}
	var payload bytes.Buffer
	fmt.Fprintf(&payload, "From: %s\r\n", (&mail.Address{Name: headerText(message.SenderName), Address: from}).String())
	fmt.Fprintf(&payload, "To: %s\r\n", (&mail.Address{Address: recipient}).String())
	fmt.Fprintf(&payload, "Subject: %s\r\n", mime.QEncoding.Encode("UTF-8", headerText(message.Subject)))
	fmt.Fprintf(&payload, "Date: %s\r\n", time.Now().Format(time.RFC1123Z))
	fmt.Fprintf(&payload, "Message-ID: %s\r\n", messageID)
	payload.WriteString("MIME-Version: 1.0\r\n")
	payload.WriteString("Auto-Submitted: auto-generated\r\n")
	payload.WriteString("X-Auto-Response-Suppress: All\r\n")
	fmt.Fprintf(&payload, "Content-Type: multipart/alternative; boundary=%s\r\n\r\n", multipartWriter.Boundary())
	payload.Write(parts.Bytes())
	return payload.Bytes(), nil
}

// headerText keeps a header value on one line.
func headerText(value string) string {
	return strings.Join(strings.FieldsFunc(value, func(r rune) bool { return unicode.IsSpace(r) || unicode.IsControl(r) }), " ")
}

func newMessageID(from string) (string, error) {
	random := make([]byte, 16)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	domain := "ecoku.invalid"
	if at := strings.LastIndex(from, "@"); at >= 0 && at < len(from)-1 {
		domain = from[at+1:]
	}
	return "<" + hex.EncodeToString(random) + "@" + domain + ">", nil
}

// writeHTMLPart sends HTML that shows the seal together with the image, as one
// multipart/related part, so mail clients render the seal in place instead of
// listing it as an attachment. Other HTML goes out as a plain text/html part.
func writeHTMLPart(writer *multipart.Writer, body string) error {
	if !strings.Contains(body, "cid:"+emailMarkCID) {
		return writeQuotedPart(writer, "text/html; charset=UTF-8", body)
	}
	var related bytes.Buffer
	relatedWriter := multipart.NewWriter(&related)
	if err := writeQuotedPart(relatedWriter, "text/html; charset=UTF-8", body); err != nil {
		return err
	}
	if err := writeInlineMark(relatedWriter); err != nil {
		return err
	}
	if err := relatedWriter.Close(); err != nil {
		return err
	}
	header := make(textproto.MIMEHeader)
	header.Set("Content-Type", mime.FormatMediaType("multipart/related", map[string]string{"boundary": relatedWriter.Boundary(), "type": "text/html"}))
	part, err := writer.CreatePart(header)
	if err != nil {
		return err
	}
	_, err = part.Write(related.Bytes())
	return err
}

func writeInlineMark(writer *multipart.Writer) error {
	header := textproto.MIMEHeader{
		"Content-Type":              {"image/png"},
		"Content-Transfer-Encoding": {"base64"},
		"Content-ID":                {"<" + emailMarkCID + ">"},
		"Content-Disposition":       {`inline; filename="` + emailMarkFilename + `"`},
	}
	part, err := writer.CreatePart(header)
	if err != nil {
		return err
	}
	// RFC 2045 limits base64 lines to 76 characters.
	encoded := base64.StdEncoding.EncodeToString(emailMarkPNG)
	for len(encoded) > 0 {
		line := encoded[:min(76, len(encoded))]
		encoded = encoded[len(line):]
		if _, err := io.WriteString(part, line+"\r\n"); err != nil {
			return err
		}
	}
	return nil
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

type telegramResponse struct {
	OK          bool            `json:"ok"`
	Description string          `json:"description"`
	Result      json.RawMessage `json:"result"`
	Parameters  struct {
		RetryAfter int `json:"retry_after"`
	} `json:"parameters"`
}

// deliverTelegram returns the sent message_id so a later deletion can
// retract the message. A missing id does not fail an accepted message.
func deliverTelegram(ctx context.Context, token, target, message string) (string, error) {
	response, err := callTelegram(ctx, token, "sendMessage", map[string]any{
		"chat_id": target, "text": message, "parse_mode": "HTML",
		"link_preview_options": map[string]any{"is_disabled": true},
	})
	if err != nil {
		return "", err
	}
	var sent struct {
		MessageID int64 `json:"message_id"`
	}
	if json.Unmarshal(response.Result, &sent) != nil || sent.MessageID == 0 {
		return "", nil
	}
	return strconv.FormatInt(sent.MessageID, 10), nil
}

func editTelegram(ctx context.Context, token, target, messageID, message string) error {
	id, err := strconv.ParseInt(messageID, 10, 64)
	if err != nil {
		return &deliveryFailure{code: "telegram_rejected", permanent: true, cause: err}
	}
	response, err := callTelegram(ctx, token, "editMessageText", map[string]any{
		"chat_id": target, "message_id": id, "text": message, "parse_mode": "HTML",
		"link_preview_options": map[string]any{"is_disabled": true},
	})
	if err != nil && strings.Contains(strings.ToLower(response.Description), "message is not modified") {
		return nil
	}
	return err
}

func callTelegram(ctx context.Context, token, method string, payload map[string]any) (telegramResponse, error) {
	var response telegramResponse
	body, err := json.Marshal(payload)
	if err != nil {
		return response, err
	}
	endpoint := strings.TrimRight(telegramAPIBaseURL, "/") + "/bot" + url.PathEscape(token) + "/" + method
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return response, err
	}
	request.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 15 * time.Second}
	result, err := client.Do(request)
	if err != nil {
		return response, err
	}
	defer result.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(result.Body, 64*1024))
	_ = json.Unmarshal(raw, &response)
	switch status := result.StatusCode; {
	case status >= 200 && status < 300 && response.OK:
		return response, nil
	case status == http.StatusTooManyRequests:
		return response, &deliveryFailure{code: "rate_limited", retryAfter: time.Duration(response.Parameters.RetryAfter) * time.Second}
	case status == http.StatusUnauthorized || status == http.StatusNotFound:
		// An invalid token can be fixed in settings; keep the event retryable.
		return response, &deliveryFailure{code: "authentication_failed"}
	case status == http.StatusBadRequest || status == http.StatusForbidden:
		// Unknown chat, bot removed or blocked, or a message Telegram refuses.
		return response, &deliveryFailure{code: "telegram_rejected", permanent: true}
	default:
		return response, fmt.Errorf("telegram returned status %d", status)
	}
}

// deliveryErrorCode maps an error to the fixed codes shown by test delivery.
func deliveryErrorCode(err error) string {
	if err == nil {
		return ""
	}
	var failure *deliveryFailure
	if errors.As(err, &failure) && failure.code == "authentication_failed" {
		return failure.code
	}
	var netErr net.Error
	switch {
	case errors.As(err, &netErr) && netErr.Timeout():
		return "timeout"
	case failure != nil:
		return "delivery_failed"
	case strings.Contains(strings.ToLower(err.Error()), "auth") || strings.Contains(err.Error(), "535"):
		return "authentication_failed"
	case strings.Contains(strings.ToLower(err.Error()), "certificate") || strings.Contains(strings.ToLower(err.Error()), "tls"):
		return "tls_failed"
	default:
		return "delivery_failed"
	}
}

// outboxErrorCode keeps the finer classification for the outbox and logs.
func outboxErrorCode(err error) string {
	var failure *deliveryFailure
	if errors.As(err, &failure) {
		return failure.code
	}
	return deliveryErrorCode(err)
}
