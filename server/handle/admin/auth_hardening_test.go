package admin

import (
	"bytes"
	"context"
	"ecoku-server/config"
	"ecoku-server/model"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func TestLoginRejectsInvalidPasswordBeforeBcryptAfterCaptcha(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const origin = "https://admin.example.test"
	if err := config.ApplyConfig(&config.Config{Admin: config.AdminConfig{AllowedOrigins: []string{origin}}}); err != nil {
		t.Fatal(err)
	}
	config.SetAdminCredentials(&config.AdminCredentials{Username: "owner", PasswordHash: "dummy-hash", TokenKey: strings.Repeat("t", 32)})
	t.Cleanup(func() { config.SetAdminCredentials(nil) })
	database, err := model.OpenSQLiteDatabase(t.TempDir() + "/login.sqlite3")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { sqlDB, _ := database.DB(); _ = sqlDB.Close() })
	if err := model.PrepareDatabaseForStartup(database); err != nil {
		t.Fatal(err)
	}
	previousDB, previousCompare := model.DB, compareLoginPassword
	model.DB = database
	t.Cleanup(func() { model.DB = previousDB; compareLoginPassword = previousCompare })
	comparisons := 0
	compareLoginPassword = func(_, _ []byte) error {
		comparisons++
		return bcrypt.ErrMismatchedHashAndPassword
	}
	router := gin.New()
	router.POST("/login", Login)
	for _, tc := range []struct {
		name     string
		username string
		password string
		cancel   bool
		compares int
	}{
		{"empty", "owner", "", false, 0},
		{"over-72-bytes", "owner", strings.Repeat("a", 73), false, 0},
		{"utf8-over-72-bytes", "owner", strings.Repeat("密", 25), false, 0},
		{"72-bytes", "owner", strings.Repeat("a", 72), false, 1},
		{"utf8-72-bytes", "owner", strings.Repeat("密", 24), false, 1},
		{"unknown-user", "unknown", "valid-format", false, 1},
		{"empty-user", "", "valid-format", false, 1},
		{"canceled-after-captcha", "owner", "valid-format", true, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			captchaReads := 0
			if err := database.Callback().Query().After("gorm:query").Register("test:login-captcha", func(tx *gorm.DB) {
				if tx.Statement.Table == "captcha_settings" && tx.Error == nil {
					captchaReads++
					if tc.cancel {
						cancel()
					}
				}
			}); err != nil {
				t.Fatal(err)
			}
			defer database.Callback().Query().Remove("test:login-captcha")
			body, err := json.Marshal(loginRequest{Username: tc.username, Password: tc.password})
			if err != nil {
				t.Fatal(err)
			}
			req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(body)).WithContext(ctx)
			req.Header.Set("Origin", origin)
			req.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()
			comparisons = 0
			router.ServeHTTP(recorder, req)
			if recorder.Code != http.StatusUnauthorized || !strings.Contains(recorder.Body.String(), "用户名或密码错误") || captchaReads != 1 || comparisons != tc.compares {
				t.Fatalf("status=%d captchaReads=%d bcrypt=%d want=%d", recorder.Code, captchaReads, comparisons, tc.compares)
			}
		})
	}
}
