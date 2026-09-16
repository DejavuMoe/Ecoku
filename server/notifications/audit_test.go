package notifications

import (
	"bufio"
	"context"
	"ecoku-server/model"
	"errors"
	"io"
	"net"
	"strings"
	"testing"
	"time"
	"unicode/utf16"

	"golang.org/x/net/html"
	"gorm.io/gorm"
)

func TestSMTPStallsAreCancellable(t *testing.T) {
	for _, phase := range []string{"banner", "starttls", "tls"} {
		t.Run(phase, func(t *testing.T) {
			listener, err := net.Listen("tcp", "127.0.0.1:0")
			if err != nil {
				t.Fatal(err)
			}
			defer listener.Close()
			ready := make(chan struct{})
			done := make(chan struct{})
			go func() {
				defer close(done)
				conn, err := listener.Accept()
				if err != nil {
					close(ready)
					return
				}
				defer conn.Close()
				if phase == "starttls" {
					reader := bufio.NewReader(conn)
					io.WriteString(conn, "220 localhost SMTP\r\n")
					reader.ReadString('\n')
					io.WriteString(conn, "250-localhost\r\n250 STARTTLS\r\n")
					reader.ReadString('\n')
				}
				close(ready)
				io.Copy(io.Discard, conn)
			}()
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			result := make(chan error, 1)
			encryption := "none"
			if phase != "banner" {
				encryption = phase
			}
			go func() {
				result <- deliverSMTP(ctx, EmailConfig{Host: "127.0.0.1", Port: listener.Addr().(*net.TCPAddr).Port, Encryption: encryption}, "receiver@example.test", emailMessage{})
			}()
			<-ready
			if phase != "banner" {
				cancel()
			}
			select {
			case err := <-result:
				if err == nil {
					t.Fatal("stalled SMTP succeeded")
				}
			case <-time.After(2 * time.Second):
				t.Fatal("SMTP did not stop")
			}
			<-done
		})
	}
}

func TestTelegramTruncatesTextBeforeEscaping(t *testing.T) {
	database := setupNotificationTest(t)
	parent := model.Comment{SiteID: "site-a", Mark: "/", Username: "parent", Content: strings.Repeat("😀", 1000)}
	if err := database.Create(&parent).Error; err != nil {
		t.Fatal(err)
	}
	comment := model.Comment{ID: 42, ParentID: &parent.ID, SiteID: "site-a", Mark: "/", Username: strings.Repeat("😀", 80), PageTitle: strings.Repeat("😀", 200), Content: strings.Repeat("😀", 2000)}
	message, err := renderTelegram(comment, model.Site{SiteURL: "https://site.example/" + strings.Repeat("a", 3000), Name: strings.Repeat("😀", 120)})
	if err != nil {
		t.Fatal(err)
	}
	tokenizer := html.NewTokenizer(strings.NewReader(message))
	var text strings.Builder
	stack := []string{}
	link := false
	for {
		kind := tokenizer.Next()
		if kind == html.ErrorToken {
			if tokenizer.Err() != io.EOF {
				t.Fatal(tokenizer.Err())
			}
			break
		}
		token := tokenizer.Token()
		switch kind {
		case html.StartTagToken:
			stack = append(stack, token.Data)
			if token.Data == "a" {
				for _, attr := range token.Attr {
					if attr.Key == "href" && strings.HasSuffix(attr.Val, "#ecoku-comment-42") {
						link = true
					}
				}
			}
		case html.EndTagToken:
			if len(stack) == 0 || stack[len(stack)-1] != token.Data {
				t.Fatal("unbalanced markup")
			}
			stack = stack[:len(stack)-1]
		case html.TextToken:
			text.WriteString(token.Data)
		}
	}
	if !link || len(stack) != 0 || len(utf16.Encode([]rune(text.String()))) > 4096 {
		t.Fatal("invalid Telegram budget or link")
	}
}

func TestOutboxRetriesCompletionWithoutRedelivery(t *testing.T) {
	database := setupNotificationTest(t)
	if _, err := SaveEmail(EmailConfig{Enabled: true, Host: "smtp.example.test", Port: 465, Encryption: "tls", Password: "test-password", FromAddress: "sender@example.test", Recipients: []string{"owner@example.test"}, Revision: 1}); err != nil {
		t.Fatal(err)
	}
	comment := model.Comment{SiteID: "site-a", Mark: "/", Username: "guest", Content: "hello"}
	if err := database.Create(&comment).Error; err != nil {
		t.Fatal(err)
	}
	if err := EnqueueNewComment(database, comment); err != nil {
		t.Fatal(err)
	}
	sends, writes := 0, 0
	old := sendSMTPMessage
	sendSMTPMessage = func(context.Context, EmailConfig, string, emailMessage) error { sends++; return nil }
	defer func() { sendSMTPMessage = old }()
	if err := database.Callback().Update().Before("gorm:update").Register("audit_completion_failure", func(tx *gorm.DB) {
		values, ok := tx.Statement.Dest.(map[string]any)
		if ok && values["status"] == "sent" {
			writes++
			if writes == 1 {
				tx.AddError(errors.New("injected write failure"))
			}
		}
	}); err != nil {
		t.Fatal(err)
	}
	defer database.Callback().Update().Remove("audit_completion_failure")
	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
	defer cancel()
	processed, err := ProcessPendingOnce(ctx)
	if err != nil || !processed || sends != 1 || writes != 2 {
		t.Fatalf("processed=%v sends=%d writes=%d err=%v", processed, sends, writes, err)
	}
	var status string
	if err := database.Table("notification_outbox").Select("status").Scan(&status).Error; err != nil {
		t.Fatal(err)
	}
	if status != "sent" {
		t.Fatalf("status=%s", status)
	}
}
