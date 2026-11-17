package main

import (
	"flag"
	"fmt"
	"io"
	"net/http"
	"time"
)

// The probe must not load configuration, open SQLite, or initialize secrets.
func runHealthcheck(arguments []string) error {
	flags := flag.NewFlagSet("healthcheck", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	port := flags.Int("port", 12123, "容器内监听端口")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	if flags.NArg() != 0 || *port < 1 || *port > 65535 {
		return fmt.Errorf("用法: healthcheck [--port=1..65535]")
	}
	transport := &http.Transport{Proxy: nil}
	defer transport.CloseIdleConnections()
	client := &http.Client{
		Timeout:   2 * time.Second,
		Transport: transport,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	response, err := client.Get(fmt.Sprintf("http://127.0.0.1:%d/api/health", *port))
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d", response.StatusCode)
	}
	return nil
}
