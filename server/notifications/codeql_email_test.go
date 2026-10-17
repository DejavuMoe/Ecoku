package notifications

import (
	"bytes"
	"context"
	"net/mail"
	"strings"
	"testing"
)

func TestSMTPTestEmailRejectsInjectedAddresses(t *testing.T) {
	setupNotificationTest(t)
	previous := sendSMTPMessage
	t.Cleanup(func() { sendSMTPMessage = previous })
	calls := 0
	sendSMTPMessage = func(_ context.Context, _ EmailConfig, recipient string, message emailMessage) error {
		calls++
		if recipient != "owner@example.test" || message.Subject != "Ecoku 测试邮件" {
			t.Fatalf("unexpected test message: recipient=%q subject=%q", recipient, message.Subject)
		}
		return nil
	}
	input := EmailConfig{Host: "smtp.example.test", Port: 465, Encryption: "tls", Password: "fixture-password", FromAddress: "sender@example.test", Recipients: []string{"owner@example.test"}}
	if code := SendTestEmail(context.Background(), input); code != "" || calls != 1 {
		t.Fatalf("valid configuration: code=%q calls=%d", code, calls)
	}
	for _, address := range []string{
		"user@example.test\r\nBcc: injected@example.test",
		"user@example.test\nBcc: injected@example.test",
		"user@example.test\r\n\r\ninjected body",
		"user@example.test\x00",
		"user@example.test, injected@example.test",
	} {
		for _, field := range []string{"from", "recipient"} {
			t.Run(field+"/"+address, func(t *testing.T) {
				candidate := input
				if field == "from" {
					candidate.FromAddress = address
				} else {
					candidate.Recipients = []string{address}
				}
				if code := SendTestEmail(context.Background(), candidate); code != "validation_failed" || calls != 1 {
					t.Fatalf("injected address reached delivery: code=%q calls=%d", code, calls)
				}
			})
		}
	}
}

func TestSMTPPayloadKeepsUntrustedTextInsideItsMIMEParts(t *testing.T) {
	text := "comment\r\nBcc: injected@example.test\r\n\r\n.\r\nMAIL FROM:<injected@example.test>"
	payload, err := buildSMTPPayload("sender@example.test", "owner@example.test", emailMessage{
		Subject: "title\r\nBcc: injected@example.test", SenderName: "name\r\nReply-To: injected@example.test",
		Text: text, HTML: emailTextHTML("<script>alert(1)</script>\n" + text),
	})
	if err != nil {
		t.Fatal(err)
	}
	message, err := mail.ReadMessage(bytes.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	if message.Header.Get("Bcc") != "" || message.Header.Get("Reply-To") != "" {
		t.Fatal("untrusted text created a message header")
	}
	from, err := message.Header.AddressList("From")
	if err != nil || len(from) != 1 || from[0].Address != "sender@example.test" {
		t.Fatalf("From address changed: %v %v", from, err)
	}
	parts := readMultipart(t, message.Header.Get("Content-Type"), message.Body, "multipart/alternative")
	if len(parts) != 2 || string(parts[0].body) != text {
		t.Fatalf("plain text did not stay inside one MIME part: %d parts", len(parts))
	}
	if strings.Contains(string(parts[1].body), "<script>") || !strings.Contains(string(parts[1].body), "&lt;script&gt;") {
		t.Fatal("HTML comment text was not escaped")
	}
}
