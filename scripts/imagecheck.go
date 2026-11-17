// This test-only binary is mounted into a container, never included in the image.
package main

import (
	"bytes"
	"crypto/x509"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"strings"
	"syscall"
	"time"
)

const base = "http://127.0.0.1:12123"
const password = "image-check-fixture-password"

func must(err error) {
	if err != nil {
		panic(err)
	}
}
func check(ok bool, message string) {
	if !ok {
		panic(message)
	}
}

func main() {
	distroless := flag.Bool("distroless", false, "check production filesystem")
	seed := flag.Bool("seed", false, "create migration fixtures")
	count := flag.Int("comments", 0, "expected persisted comments")
	add := flag.Bool("add", false, "write another comment")
	flag.Parse()
	check(os.Getuid() == 10001 && os.Getgid() == 10001, "runtime uid/gid changed")
	addresses, err := net.LookupIP("localhost")
	must(err)
	check(len(addresses) > 0 && addresses[0].IsLoopback(), "localhost resolution failed")
	for _, path := range []string{"/data/ecoku.sqlite3", "/data/ecoku-secrets.json", "/etc/ssl/certs/ca-certificates.crt", "/usr/share/zoneinfo/Asia/Shanghai"} {
		data, err := os.ReadFile(path)
		must(err)
		check(len(data) > 0, "empty file: "+path)
		if path == "/etc/ssl/certs/ca-certificates.crt" {
			check(x509.NewCertPool().AppendCertsFromPEM(data), "invalid CA bundle")
		}
	}
	info, err := os.Stat("/data/ecoku-secrets.json")
	must(err)
	check(info.Mode().Perm() == 0600, "secret file mode changed")
	check(info.Sys().(*syscall.Stat_t).Uid == 10001, "secret file owner changed")
	location, err := time.LoadLocation("Asia/Shanghai")
	must(err)
	_, offset := time.Unix(0, 0).In(location).Zone()
	check(offset == 8*60*60, "timezone data unavailable")
	check(errors.Is(os.WriteFile("/app/readonly-probe", []byte("probe"), 0600), syscall.EROFS), "root filesystem is not read-only")
	must(os.WriteFile("/tmp/write-probe", []byte("probe"), 0600))
	must(os.Remove("/tmp/write-probe"))
	if *distroless {
		for _, path := range []string{"/bin/sh", "/bin/busybox", "/bin/wget", "/usr/bin/wget", "/sbin/apk", "/usr/bin/apt"} {
			_, err := os.Stat(path)
			check(os.IsNotExist(err), "unexpected runtime tool: "+path)
		}
	}
	jar, err := cookiejar.New(nil)
	must(err)
	client := &http.Client{Jar: jar, Timeout: 3 * time.Second, Transport: &http.Transport{Proxy: nil}}
	tlsServer := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }))
	tlsServer.Config.ErrorLog = log.New(io.Discard, "", 0)
	tlsServer.StartTLS()
	defer tlsServer.Close()
	response, err := client.Get(tlsServer.URL)
	if response != nil {
		response.Body.Close()
	}
	var unknownAuthority x509.UnknownAuthorityError
	check(errors.As(err, &unknownAuthority), "TLS accepted an untrusted certificate")
	response, err = tlsServer.Client().Get(tlsServer.URL)
	must(err)
	response.Body.Close()
	check(response.StatusCode == 200, "TLS handshake with trusted fixture failed")
	request := func(method, path, origin string, payload any, status int) []byte {
		body, err := json.Marshal(payload)
		must(err)
		req, err := http.NewRequest(method, base+path, bytes.NewReader(body))
		must(err)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", origin)
		response, err := client.Do(req)
		must(err)
		defer response.Body.Close()
		data, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
		must(err)
		check(response.StatusCode == status, fmt.Sprintf("%s %s: HTTP %d", method, path, response.StatusCode))
		check(len(data) > 0, "empty response: "+path)
		return data
	}
	for _, path := range []string{"/api/health", "/admin/", "/client/ecoku.umd.js", "/client/ecoku-loader.js", "/client/ecoku.css", "/client/ecoku.unstyled.css"} {
		if strings.HasPrefix(path, "/client/") {
			asset, err := os.ReadFile("/app" + path)
			must(err)
			check(len(asset) > 0, "empty static asset: "+path)
		}
		request("GET", path, "", nil, 200)
	}
	request("POST", "/api/admin/login", base, map[string]string{"username": "imagecheck", "password": password}, 200)
	if *seed {
		request("PUT", "/api/admin/notifications/telegram", base, map[string]any{"enabled": false, "token": "fixture-token-never-sent", "targets": []string{"123456"}}, 200)
	}
	if *seed || *count > 0 {
		data := request("GET", "/api/admin/notifications", base, nil, 200)
		check(bytes.Contains(data, []byte(`"token_set":true`)), "encrypted notification credential lost")
	}
	submit := func(content string, parent int) {
		request("POST", "/api/comment/submit", "https://imagecheck.example", map[string]any{
			"siteId": "imagecheck", "mark": "/migration", "pageTitle": "Migration fixture", "username": "Fixture",
			"email": "fixture@example.test", "content": content, "parent": parent,
		}, 201)
	}
	if *seed {
		submit("before migration", 0)
		submit("existing reply", 1)
		*count = 2
	}
	if *add {
		submit("after migration", 0)
		(*count)++
	}
	data := request("GET", "/api/comment/list?siteId=imagecheck&key=%2Fmigration&page=1&pageSize=20", "https://imagecheck.example", nil, 200)
	var result struct {
		Data struct {
			CommentTotal int `json:"commentTotal"`
			Data         []struct {
				ID      int    `json:"id"`
				Parent  int    `json:"parent"`
				Content string `json:"content"`
			} `json:"data"`
		} `json:"data"`
	}
	must(json.Unmarshal(data, &result))
	check(result.Data.CommentTotal == *count && len(result.Data.Data) == *count, "comment count changed")
	for _, comment := range result.Data.Data {
		check(comment.ID >= 1 && comment.ID <= 3, "unexpected comment ID")
		check(comment.Content == []string{"before migration", "existing reply", "after migration"}[comment.ID-1], "comment content changed")
		if comment.ID == 2 {
			check(comment.Parent == 1, "reply parent changed")
		}
	}
	fmt.Printf("Image checks passed: uid/gid, read-only root, CA, timezone, assets, login, secrets, comments=%d\n", *count)
}
