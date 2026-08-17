package captcha

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

const (
	turnstileSecretAAD = "ecoku-turnstile-secret-v1"
	capSecretAAD       = "ecoku-cap-secret-v1"
)

var ErrEncryptionKeyUnavailable = errors.New("notification encryption key unavailable")

func masterKey() ([]byte, error) {
	name := strings.TrimSpace(config.GetNotificationsConfig().EncryptionKeyEnv)
	if name == "" {
		return nil, ErrEncryptionKeyUnavailable
	}
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return nil, ErrEncryptionKeyUnavailable
	}
	for _, encoding := range []*base64.Encoding{base64.RawStdEncoding, base64.StdEncoding} {
		decoded, err := encoding.DecodeString(raw)
		if err == nil && len(decoded) == 32 {
			return decoded, nil
		}
	}
	return nil, fmt.Errorf("%w: expected a base64-encoded 32-byte key", ErrEncryptionKeyUnavailable)
}

func encryptSecret(plaintext, aad string) ([]byte, error) {
	key, err := masterKey()
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	result := make([]byte, 1, 1+len(nonce)+len(plaintext)+gcm.Overhead())
	result[0] = 1
	result = append(result, nonce...)
	result = gcm.Seal(result, nonce, []byte(plaintext), []byte(aad))
	return result, nil
}

func decryptSecret(ciphertext []byte, aad string) (string, error) {
	if len(ciphertext) == 0 {
		return "", nil
	}
	if ciphertext[0] != 1 {
		return "", errors.New("unsupported CAPTCHA secret format")
	}
	key, err := masterKey()
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(ciphertext) < 1+gcm.NonceSize()+gcm.Overhead() {
		return "", errors.New("invalid CAPTCHA secret ciphertext")
	}
	nonce := ciphertext[1 : 1+gcm.NonceSize()]
	plaintext, err := gcm.Open(nil, nonce, ciphertext[1+gcm.NonceSize():], []byte(aad))
	if err != nil {
		return "", errors.New("CAPTCHA secret cannot be decrypted")
	}
	return string(plaintext), nil
}
