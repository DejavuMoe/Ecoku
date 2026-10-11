package instancekeys

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestEC06ValidateBeforePersist(t *testing.T) {
	for _, invalid := range []struct{ admin, notification string }{{"", "invalid-key"}, {"short", ""}} {
		t.Run("fresh-"+invalid.admin+invalid.notification, func(t *testing.T) {
			ResetForTests()
			t.Cleanup(ResetForTests)
			path := filepath.Join(t.TempDir(), "secrets.json")
			if _, err := Initialize(path, invalid.admin, invalid.notification); err == nil {
				t.Fatal("invalid keys accepted")
			}
			if _, err := os.Stat(path); !os.IsNotExist(err) {
				t.Errorf("EC-06: invalid initialization persisted a key file: %v", err)
			}
			if _, err := Initialize(path, strings.Repeat("a", 32), "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="); err != nil {
				t.Errorf("EC-06: corrected initialization failed: %v", err)
			}
		})
	}
	for _, notification := range []string{"invalid-key", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="} {
		t.Run("rotation-"+notification, func(t *testing.T) {
			ResetForTests()
			t.Cleanup(ResetForTests)
			path := filepath.Join(t.TempDir(), "secrets.json")
			first, err := Initialize(path, "", "")
			if err != nil {
				t.Fatal(err)
			}
			before, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := Initialize(path, strings.Repeat("r", 32), notification); err == nil {
				t.Fatal("mismatched notification key accepted")
			}
			after, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(before, after) {
				t.Error("EC-06: failed admin rotation changed persistent keys")
			}
			current, err := Current()
			if err != nil || current.AdminTokenKey != first.AdminTokenKey || !bytes.Equal(current.NotificationEncryption, first.NotificationEncryption) {
				t.Fatal("failed rotation changed active keys")
			}
		})
	}
}
