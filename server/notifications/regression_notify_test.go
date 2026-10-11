package notifications

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"ecoku-server/model"
	"errors"
	"io"
	"net"
	"net/http/httptest"
	"net/textproto"
	"os"
	"os/exec"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestEC10SMTPAcceptance(t *testing.T) {
	// Certificate roots are process-global; keep fixture trust in this child only.
	if os.Getenv("ECOKU_SMTP_FIXTURE") != "1" {
		binary, err := os.Executable()
		if err != nil {
			t.Fatal(err)
		}
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		cmd := exec.CommandContext(ctx, binary, "-test.run=^TestEC10SMTPAcceptance$", "-test.v")
		cmd.Env = append(os.Environ(), "ECOKU_SMTP_FIXTURE=1", "GODEBUG=x509usefallbackroots=1")
		output, err := cmd.CombinedOutput()
		t.Logf("%s", output)
		if err != nil {
			t.Fatalf("SMTP fixture subprocess: %v", err)
		}
		return
	}
	// Reuse the standard library's local TLS fixture without disabling verification.
	fixture := httptest.NewTLSServer(nil)
	defer fixture.Close()
	roots := x509.NewCertPool()
	roots.AddCert(fixture.Certificate())
	x509.SetFallbackRoots(roots)
	for _, phase := range []string{"quit_eof", "before_data", "final_data_451", "final_data_550", "final_data_eof"} {
		t.Run(phase, func(t *testing.T) {
			database := setupNotificationTest(t)
			listener, err := tls.Listen("tcp", "127.0.0.1:0", fixture.TLS)
			if err != nil {
				t.Fatal(err)
			}
			var accepted, quits atomic.Int32
			done := make(chan struct{})
			go func() {
				defer close(done)
				for {
					conn, err := listener.Accept()
					if err != nil {
						return
					}
					func() {
						defer conn.Close()
						if err := conn.SetDeadline(time.Now().Add(5 * time.Second)); err != nil {
							t.Error(err)
							return
						}
						wire := textproto.NewConn(conn)
						if err := wire.PrintfLine("220 localhost SMTP"); err != nil {
							t.Error(err)
							return
						}
						for {
							line, err := wire.ReadLine()
							if errors.Is(err, io.EOF) {
								return
							}
							if err != nil {
								t.Error(err)
								return
							}
							reply := "250 OK"
							switch {
							case strings.HasPrefix(line, "EHLO "), strings.HasPrefix(line, "MAIL FROM:"), strings.HasPrefix(line, "RCPT TO:"):
							case line == "DATA":
								if phase == "before_data" {
									reply = "451 DATA unavailable"
									break
								}
								if err := wire.PrintfLine("354 Send message"); err != nil {
									t.Error(err)
									return
								}
								if _, err := wire.ReadDotBytes(); err != nil {
									t.Error(err)
									return
								}
								switch phase {
								case "final_data_eof":
									return
								case "final_data_451":
									reply = "451 Message deferred"
								case "final_data_550":
									reply = "550 Message rejected"
								default:
									accepted.Add(1)
								}
							case line == "QUIT":
								quits.Add(1)
								return
							default:
								t.Errorf("unexpected SMTP command: %q", line)
								return
							}
							if err := wire.PrintfLine("%s", reply); err != nil {
								t.Error(err)
								return
							}
						}
					}()
				}
			}()
			t.Cleanup(func() { listener.Close(); <-done })
			if _, err := SaveEmail(EmailConfig{Enabled: true, Host: "127.0.0.1", Port: listener.Addr().(*net.TCPAddr).Port, Encryption: "tls", Password: "dummy-password", FromAddress: "sender@example.test", Recipients: []string{"owner@example.test"}, Revision: 1}); err != nil {
				t.Fatal(err)
			}
			comment := model.Comment{SiteID: "site-a", Mark: "/", Username: "guest", Content: "hello"}
			if err := database.Create(&comment).Error; err != nil {
				t.Fatal(err)
			}
			if err := EnqueueNewComment(database, comment); err != nil {
				t.Fatal(err)
			}
			old := sendSMTPMessage
			var deliveryErr error
			sendSMTPMessage = func(ctx context.Context, settings EmailConfig, target string, message emailMessage) error {
				deliveryErr = deliverSMTP(ctx, settings, target, message)
				return deliveryErr
			}
			t.Cleanup(func() { sendSMTPMessage = old })
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if processed, err := ProcessPendingOnce(ctx); err != nil || !processed {
				t.Fatalf("processed=%v err=%v", processed, err)
			}
			var row outboxRow
			if err := database.Table("notification_outbox").First(&row).Error; err != nil {
				t.Fatal(err)
			}
			if phase != "quit_eof" {
				wantStatus := "failed"
				if phase == "final_data_550" {
					wantStatus = "exhausted"
				}
				if deliveryErr == nil || row.Status != wantStatus || row.SentAt != nil || row.LastErrorCode == nil || accepted.Load() != 0 || quits.Load() != 0 {
					t.Fatalf("EC-10: unaccepted DATA: err=%v row=%+v accepted=%d quits=%d", deliveryErr, row, accepted.Load(), quits.Load())
				}
				return
			}
			if accepted.Load() != 1 || quits.Load() != 1 {
				t.Fatalf("fixture did not reach DATA 250 then QUIT EOF: accepted=%d quits=%d err=%v", accepted.Load(), quits.Load(), deliveryErr)
			}
			if deliveryErr != nil || row.Status != "sent" || row.SentAt == nil || row.LastErrorCode != nil {
				t.Errorf("EC-10: accepted DATA must succeed despite QUIT EOF: err=%v status=%s sent_at=%v", deliveryErr, row.Status, row.SentAt)
			}
			if err := database.Table("notification_outbox").Where("id = ?", row.ID).Update("available_at", time.Now().UTC().Add(-time.Minute)).Error; err != nil {
				t.Fatal(err)
			}
			if processed, err := ProcessPendingOnce(ctx); err != nil || processed || accepted.Load() != 1 {
				t.Errorf("EC-10: accepted email resubmitted: processed=%v accepted=%d err=%v", processed, accepted.Load(), err)
			}
		})
	}
}

func TestEC11SMTPPasswordPreserved(t *testing.T) {
	for _, password := range []string{" dummy-password ", "  "} {
		t.Run(password, func(t *testing.T) {
			database := setupNotificationTest(t)
			input := EmailConfig{Enabled: true, Host: " smtp.example.test ", Port: 465, Encryption: " TLS ", Username: " mailer ", Password: password, FromAddress: " sender@example.test ", Recipients: []string{" owner@example.test "}, Revision: 1}
			resolved, err := resolveEmailForTest(input)
			if err != nil || resolved.Password != password {
				t.Errorf("EC-11: test password=%q want=%q err=%v", resolved.Password, password, err)
			}
			saved, err := SaveEmail(input)
			if err != nil {
				t.Fatalf("EC-11: saving explicit password failed: %v", err)
			}
			if saved.Password != "" || !saved.PasswordSet || saved.Host != "smtp.example.test" || saved.Username != "mailer" || saved.Encryption != "tls" || saved.FromAddress != "sender@example.test" || len(saved.Recipients) != 1 || saved.Recipients[0] != "owner@example.test" {
				t.Fatalf("redaction or non-secret normalization changed: %+v", saved)
			}
			for _, stage := range []string{"explicit", "empty retains"} {
				row, err := loadSetting(database, ChannelEmail)
				if err != nil {
					t.Fatal(err)
				}
				loaded, err := emailFromRow(row, true)
				if err != nil || loaded.Password != password {
					t.Errorf("EC-11: %s saved password=%q want=%q err=%v", stage, loaded.Password, password, err)
				}
				input.Password = ""
				resolved, err := resolveEmailForTest(input)
				if err != nil || resolved.Password != password {
					t.Errorf("EC-11: %s empty test password=%q want=%q err=%v", stage, resolved.Password, password, err)
				}
				if stage == "explicit" {
					input.Revision = saved.Revision
					if _, err := SaveEmail(input); err != nil {
						t.Fatal(err)
					}
				}
			}
		})
	}
}
