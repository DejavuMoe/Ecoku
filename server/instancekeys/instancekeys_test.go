package instancekeys

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInitializeGeneratesAndReusesKeys(t *testing.T) {
	ResetForTests()
	path := filepath.Join(t.TempDir(), "ecoku-secrets.json")
	first, err := Initialize(path, "", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(first.AdminTokenKey) < 32 || len(first.NotificationEncryption) != 32 {
		t.Fatalf("generated keys=%#v", first)
	}
	second, err := Initialize(path, "", "")
	if err != nil {
		t.Fatal(err)
	}
	if first.AdminTokenKey != second.AdminTokenKey || string(first.NotificationEncryption) != string(second.NotificationEncryption) {
		t.Fatal("persistent keys changed on restart")
	}
	if info, err := os.Stat(path); err != nil || info.Mode().Perm()&0o077 != 0 {
		t.Fatalf("unsafe key file mode: %v %v", info, err)
	}
}

func TestLegacyNotificationKeyMismatchFailsClosed(t *testing.T) {
	ResetForTests()
	path := filepath.Join(t.TempDir(), "ecoku-secrets.json")
	legacy := base64.RawStdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef"))
	if _, err := Initialize(path, strings.Repeat("a", 32), legacy); err != nil {
		t.Fatal(err)
	}
	other := base64.RawStdEncoding.EncodeToString([]byte("fedcba9876543210fedcba9876543210"))
	if _, err := Initialize(path, strings.Repeat("a", 32), other); err == nil {
		t.Fatal("notification key mismatch was accepted")
	}
}
