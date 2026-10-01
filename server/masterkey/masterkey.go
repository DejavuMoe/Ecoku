// Package masterkey encrypts the credentials stored in SQLite (SMTP password,
// Telegram bot token and CAPTCHA secret keys) with the instance master key.
package masterkey

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"ecoku-server/config"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

// ErrUnavailable reports a missing or malformed master key.
var ErrUnavailable = errors.New("notification encryption key unavailable")

// A ciphertext is this version byte, the AES-GCM nonce and the sealed secret.
const formatVersion = 1

func aead() (cipher.AEAD, error) {
	raw := strings.TrimSpace(os.Getenv(config.EncryptionKeyEnv))
	if raw == "" {
		return nil, ErrUnavailable
	}
	var key []byte
	for _, encoding := range []*base64.Encoding{base64.RawStdEncoding, base64.StdEncoding} {
		if decoded, err := encoding.DecodeString(raw); err == nil && len(decoded) == 32 {
			key = decoded
			break
		}
	}
	if key == nil {
		return nil, fmt.Errorf("%w: expected a base64-encoded 32-byte key", ErrUnavailable)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

// Encrypt seals a secret. The additional data names the secret's purpose, so a
// ciphertext copied into another column fails to decrypt.
func Encrypt(plaintext, additionalData string) ([]byte, error) {
	gcm, err := aead()
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	result := make([]byte, 1, 1+len(nonce)+len(plaintext)+gcm.Overhead())
	result[0] = formatVersion
	result = append(result, nonce...)
	return gcm.Seal(result, nonce, []byte(plaintext), []byte(additionalData)), nil
}

// Decrypt opens a ciphertext produced by Encrypt. An empty ciphertext means
// that no secret is stored and yields an empty string.
func Decrypt(ciphertext []byte, additionalData string) (string, error) {
	if len(ciphertext) == 0 {
		return "", nil
	}
	if ciphertext[0] != formatVersion {
		return "", errors.New("unsupported secret format")
	}
	gcm, err := aead()
	if err != nil {
		return "", err
	}
	if len(ciphertext) < 1+gcm.NonceSize()+gcm.Overhead() {
		return "", errors.New("invalid secret ciphertext")
	}
	nonce := ciphertext[1 : 1+gcm.NonceSize()]
	plaintext, err := gcm.Open(nil, nonce, ciphertext[1+gcm.NonceSize():], []byte(additionalData))
	if err != nil {
		return "", errors.New("secret cannot be decrypted")
	}
	return string(plaintext), nil
}
