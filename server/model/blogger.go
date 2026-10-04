package model

import (
	"fmt"
	"strings"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const (
	MinimumBloggerPassphraseLength = 12
	MaximumBloggerPassphraseLength = 80
)

func HashBloggerPassphrase(passphrase string) (string, error) {
	passphrase = strings.TrimSpace(passphrase)
	if err := ValidateBloggerPassphrase(passphrase); err != nil {
		return "", err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(passphrase), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("博主口令无效")
	}
	return string(hash), nil
}

func ValidateBloggerPassphrase(passphrase string) error {
	length := utf8.RuneCountInString(passphrase)
	if length < MinimumBloggerPassphraseLength || length > MaximumBloggerPassphraseLength {
		return fmt.Errorf("博主口令长度必须为 %d 到 %d 个字符", MinimumBloggerPassphraseLength, MaximumBloggerPassphraseLength)
	}
	if len(passphrase) > 72 {
		return fmt.Errorf("博主口令 UTF-8 编码不能超过 72 字节")
	}
	if strings.ContainsAny(passphrase, "\r\n") {
		return fmt.Errorf("博主口令不能包含换行")
	}
	return nil
}

func (site Site) BloggerProofConfigured() bool {
	return strings.TrimSpace(site.BloggerPassphraseHash) != "" &&
		strings.TrimSpace(site.BloggerNickname) != "" &&
		strings.TrimSpace(site.BloggerEmail) != ""
}

func (site Site) MatchesBloggerPassphrase(candidate string) bool {
	hash := strings.TrimSpace(site.BloggerPassphraseHash)
	if hash == "" {
		return false
	}
	candidate = strings.TrimSpace(candidate)
	if ValidateBloggerPassphrase(candidate) != nil {
		return false
	}
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(candidate))
	return err == nil
}

func BackfillHistoricalBloggerComments(database *gorm.DB, siteID string) error {
	if database == nil {
		return fmt.Errorf("database unavailable")
	}
	query := database.Exec(`
UPDATE comments
SET is_blogger = 1
WHERE deleted_at IS NULL
  AND is_blogger = 0
  AND site_id = ?
  AND EXISTS (
    SELECT 1 FROM sites
    WHERE sites.id = comments.site_id
      AND length(trim(sites.blogger_nickname)) > 0
      AND length(trim(sites.blogger_email)) > 0
      AND comments.username = sites.blogger_nickname
      AND comments.email IS NOT NULL
      AND lower(comments.email) = lower(sites.blogger_email)
  )`, siteID)
	return query.Error
}

func backfillAllHistoricalBloggerComments(database *gorm.DB) error {
	return database.Exec(`
UPDATE comments
SET is_blogger = 1
WHERE deleted_at IS NULL
  AND is_blogger = 0
  AND EXISTS (
    SELECT 1 FROM sites
    WHERE sites.id = comments.site_id
      AND length(trim(sites.blogger_nickname)) > 0
      AND length(trim(sites.blogger_email)) > 0
      AND comments.username = sites.blogger_nickname
      AND comments.email IS NOT NULL
      AND lower(comments.email) = lower(sites.blogger_email)
  )`).Error
}
