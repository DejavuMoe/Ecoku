package utils

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSendResponseUsesRealHTTPStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name   string
		status int
	}{
		{name: "success", status: http.StatusOK},
		{name: "parameter error", status: http.StatusBadRequest},
		{name: "unauthenticated", status: http.StatusUnauthorized},
		{name: "forbidden", status: http.StatusForbidden},
		{name: "not found", status: http.StatusNotFound},
		{name: "conflict", status: http.StatusConflict},
		{name: "rate limited", status: http.StatusTooManyRequests},
		{name: "internal error", status: http.StatusInternalServerError},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(recorder)
			SendResponse(context, test.status, test.name, nil)

			if recorder.Code != test.status {
				t.Fatalf("HTTP status = %d, want %d", recorder.Code, test.status)
			}
			var body Response
			if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if body.Code != test.status || body.Message != test.name {
				t.Fatalf("response = %#v", body)
			}
		})
	}
}
