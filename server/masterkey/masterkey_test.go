package masterkey

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"ecoku-server/config"
	"encoding/base64"
	"errors"
	"testing"
)

// Credentials saved by earlier releases must keep decrypting: a version byte,
// the AES-GCM nonce and the sealed secret, bound to its purpose.
func TestDecryptOpensTheStoredFormat(t *testing.T) {
	key := []byte("0123456789abcdef0123456789abcdef")
	t.Setenv(config.EncryptionKeyEnv, base64.StdEncoding.EncodeToString(key))
	block, err := aes.NewCipher(key)
	if err != nil {
		t.Fatal(err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		t.Fatal(err)
	}
	nonce := bytes.Repeat([]byte{7}, gcm.NonceSize())
	stored := gcm.Seal(append([]byte{1}, nonce...), nonce, []byte("smtp-password"), []byte("ecoku-notification-secret-v1"))

	if plaintext, err := Decrypt(stored, "ecoku-notification-secret-v1"); err != nil || plaintext != "smtp-password" {
		t.Fatalf("stored secret = %q, %v", plaintext, err)
	}
	if _, err := Decrypt(stored, "ecoku-cap-secret-v1"); err == nil {
		t.Fatal("a secret opened for another purpose")
	}
	sealed, err := Encrypt("bot-token", "ecoku-notification-secret-v1")
	if err != nil {
		t.Fatal(err)
	}
	if plaintext, err := Decrypt(sealed, "ecoku-notification-secret-v1"); err != nil || plaintext != "bot-token" {
		t.Fatalf("round trip = %q, %v", plaintext, err)
	}
}

func TestMissingOrMalformedKeyIsUnavailable(t *testing.T) {
	for name, value := range map[string]string{"missing": "", "short": base64.StdEncoding.EncodeToString([]byte("short"))} {
		t.Run(name, func(t *testing.T) {
			t.Setenv(config.EncryptionKeyEnv, value)
			if _, err := Encrypt("secret", "purpose"); !errors.Is(err, ErrUnavailable) {
				t.Fatalf("encrypt error = %v", err)
			}
		})
	}
	if plaintext, err := Decrypt(nil, "purpose"); err != nil || plaintext != "" {
		t.Fatalf("empty ciphertext = %q, %v", plaintext, err)
	}
}
