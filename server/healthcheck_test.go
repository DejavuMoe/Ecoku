package main

import (
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"
	"time"
)

func TestHealthcheck(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("HTTP_PROXY", "http://127.0.0.1:1")
	t.Setenv("ALL_PROXY", "http://127.0.0.1:1")
	for _, status := range []int{200, 302, 503} {
		t.Run(strconv.Itoa(status), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != "GET" || r.URL.Path != "/api/health" {
					t.Errorf("unexpected request: %s %s", r.Method, r.URL)
				}
				w.Header().Set("Location", "/should-not-follow")
				w.WriteHeader(status)
			}))
			defer server.Close()
			port := server.Listener.Addr().(*net.TCPAddr).Port
			err := runHealthcheck([]string{"--port=" + strconv.Itoa(port)})
			if (err == nil) != (status == 200) {
				t.Fatalf("status %d: %v", status, err)
			}
			server.Close()
			if err := runHealthcheck([]string{"--port=" + strconv.Itoa(port)}); err == nil {
				t.Fatal("stopped server passed the probe")
			}
		})
	}
	for _, arguments := range [][]string{{"--port=0"}, {"--port=65536"}, {"--port=bad"}, {"--unknown"}, {"extra"}} {
		if err := runHealthcheck(arguments); err == nil {
			t.Fatalf("accepted invalid arguments: %v", arguments)
		}
	}
	entries, err := os.ReadDir(".")
	if err != nil || len(entries) != 0 {
		t.Fatalf("probe created state: %v, %v", entries, err)
	}
}

func TestHealthcheckTimeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	defer server.Close()
	started := time.Now()
	port := server.Listener.Addr().(*net.TCPAddr).Port
	if err := runHealthcheck([]string{"--port=" + strconv.Itoa(port)}); err == nil {
		t.Fatal("unresponsive server passed the probe")
	}
	if elapsed := time.Since(started); elapsed > 4*time.Second {
		t.Fatalf("probe exceeded its timeout: %v", elapsed)
	}
}
