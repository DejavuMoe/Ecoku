package model

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

var (
	ErrSiteNotFound = errors.New("site not found")
	ErrSiteConflict = errors.New("site changed concurrently")
)

// Site is the runtime source of truth for a hosted website. Sites are created
// in the admin console; the blogger passphrase is stored only as a hash.
type Site struct {
	ID                    string    `gorm:"column:id;primaryKey"`
	SiteURL               string    `gorm:"column:site_url"`
	Domain                string    `gorm:"column:domain"`
	Name                  string    `gorm:"column:name"`
	DefaultSort           string    `gorm:"column:default_sort"`
	EmailRequired         bool      `gorm:"column:email_required"`
	WebsiteRequired       bool      `gorm:"column:website_required"`
	Placeholder           string    `gorm:"column:placeholder"`
	CommentLimit          int       `gorm:"column:comment_limit"`
	EmptyMessage          string    `gorm:"column:empty_message"`
	SmojiEnabled          bool      `gorm:"column:smoji_enabled"`
	SmojiManifestURL      string    `gorm:"column:smoji_manifest_url"`
	BloggerNickname       string    `gorm:"column:blogger_nickname"`
	BloggerEmail          string    `gorm:"column:blogger_email"`
	BloggerBadge          string    `gorm:"column:blogger_badge"`
	BloggerPassphraseHash string    `gorm:"column:blogger_passphrase_hash"`
	Revision              uint      `gorm:"column:revision"`
	CreatedAt             time.Time `gorm:"column:created_at"`
	UpdatedAt             time.Time `gorm:"column:updated_at"`
	AllowedOrigins        []string  `gorm:"-"`
}

type SiteWrite struct {
	ID                    string
	SiteURL               string
	Domain                string
	Name                  string
	DefaultSort           string
	EmailRequired         bool
	WebsiteRequired       bool
	Placeholder           string
	CommentLimit          int
	EmptyMessage          string
	SmojiEnabled          bool
	SmojiManifestURL      string
	BloggerNickname       string
	BloggerEmail          string
	BloggerBadge          string
	BloggerPassphraseHash string
	UpdatePassphrase      bool
	AllowedOrigins        []string
	Revision              uint
}

func ListSites() ([]Site, error) {
	if DB == nil {
		return nil, fmt.Errorf("database unavailable")
	}
	var sites []Site
	if err := DB.Order("id ASC").Find(&sites).Error; err != nil {
		return nil, err
	}
	if err := attachSiteOrigins(DB, sites); err != nil {
		return nil, err
	}
	return sites, nil
}

func GetSite(siteID string) (Site, error) {
	return GetSiteWithContext(context.Background(), siteID)
}

func GetSiteWithContext(ctx context.Context, siteID string) (Site, error) {
	if DB == nil {
		return Site{}, fmt.Errorf("database unavailable")
	}
	return getSite(DB.WithContext(ctx), siteID)
}

func getSite(database *gorm.DB, siteID string) (Site, error) {
	var site Site
	if err := database.Where("id = ?", strings.TrimSpace(siteID)).First(&site).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return Site{}, ErrSiteNotFound
		}
		return Site{}, err
	}
	var origins []string
	if err := database.Table("site_origins").Where("site_id = ?", site.ID).Order("origin ASC").Pluck("origin", &origins).Error; err != nil {
		return Site{}, err
	}
	site.AllowedOrigins = origins
	return site, nil
}

func SiteExists(siteID string) (bool, error) {
	if DB == nil {
		return false, fmt.Errorf("database unavailable")
	}
	var count int64
	if err := DB.Table("sites").Where("id = ?", strings.TrimSpace(siteID)).Count(&count).Error; err != nil {
		return false, err
	}
	return count == 1, nil
}

func CreateSite(input SiteWrite, now time.Time) (Site, error) {
	if DB == nil {
		return Site{}, fmt.Errorf("database unavailable")
	}
	var created Site
	err := DB.Transaction(func(tx *gorm.DB) error {
		created = Site{
			ID: input.ID, SiteURL: input.SiteURL, Domain: input.Domain,
			Name: input.Name, DefaultSort: input.DefaultSort,
			EmailRequired: input.EmailRequired, WebsiteRequired: input.WebsiteRequired,
			Placeholder: input.Placeholder, CommentLimit: input.CommentLimit,
			EmptyMessage: input.EmptyMessage, BloggerNickname: input.BloggerNickname,
			SmojiEnabled: input.SmojiEnabled, SmojiManifestURL: input.SmojiManifestURL,
			BloggerEmail: input.BloggerEmail, BloggerBadge: input.BloggerBadge,
			BloggerPassphraseHash: input.BloggerPassphraseHash,
			Revision:              1, CreatedAt: now, UpdatedAt: now,
		}
		if err := tx.Create(&created).Error; err != nil {
			return err
		}
		return replaceSiteOrigins(tx, created.ID, input.AllowedOrigins)
	})
	if err != nil {
		return Site{}, err
	}
	return getSite(DB, created.ID)
}

func UpdateSite(siteID string, input SiteWrite, now time.Time) (Site, error) {
	if DB == nil {
		return Site{}, fmt.Errorf("database unavailable")
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		updates := map[string]any{
			"site_url": input.SiteURL, "domain": input.Domain,
			"name":               input.Name,
			"default_sort":       input.DefaultSort,
			"email_required":     input.EmailRequired,
			"website_required":   input.WebsiteRequired,
			"placeholder":        input.Placeholder,
			"comment_limit":      input.CommentLimit,
			"empty_message":      input.EmptyMessage,
			"smoji_enabled":      input.SmojiEnabled,
			"smoji_manifest_url": input.SmojiManifestURL,
			"blogger_nickname":   input.BloggerNickname,
			"blogger_email":      input.BloggerEmail,
			"blogger_badge":      input.BloggerBadge,
			"revision":           gorm.Expr("revision + 1"), "updated_at": now,
		}
		if input.UpdatePassphrase {
			updates["blogger_passphrase_hash"] = input.BloggerPassphraseHash
		}
		result := tx.Model(&Site{}).
			Where("id = ? AND revision = ?", siteID, input.Revision).
			Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			var count int64
			if err := tx.Table("sites").Where("id = ?", siteID).Count(&count).Error; err != nil {
				return err
			}
			if count == 0 {
				return ErrSiteNotFound
			}
			return ErrSiteConflict
		}
		if err := replaceSiteOrigins(tx, siteID, input.AllowedOrigins); err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return Site{}, err
	}
	return getSite(DB, siteID)
}

func (site Site) IsBloggerComment(username string, email *string) bool {
	// Historical nick+email equality is only used to backfill comments.is_blogger.
	// Public lists and notification enqueue read the stored flag.
	nickname := strings.TrimSpace(site.BloggerNickname)
	configuredEmail := strings.TrimSpace(site.BloggerEmail)
	if nickname == "" || configuredEmail == "" || email == nil {
		return false
	}
	return strings.TrimSpace(username) == nickname &&
		strings.EqualFold(strings.TrimSpace(*email), configuredEmail)
}

func IsPublicOriginAllowedWithContext(ctx context.Context, origin string) (bool, error) {
	if DB == nil {
		return false, fmt.Errorf("database unavailable")
	}
	var row struct{ Origin string }
	err := DB.WithContext(ctx).Table("site_origins").Select("origin").Where("origin = ?", origin).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	return err == nil, err
}

func IsSiteOriginAllowedWithContext(ctx context.Context, siteID, normalizedOrigin string) (bool, error) {
	if DB == nil {
		return false, fmt.Errorf("database unavailable")
	}
	if strings.TrimSpace(normalizedOrigin) == "" {
		return true, nil
	}
	var count int64
	if err := DB.WithContext(ctx).Table("site_origins").Where("site_id = ? AND origin = ?", siteID, normalizedOrigin).Count(&count).Error; err != nil {
		return false, err
	}
	return count == 1, nil
}

func replaceSiteOrigins(tx *gorm.DB, siteID string, origins []string) error {
	if err := tx.Exec("DELETE FROM site_origins WHERE site_id = ?", siteID).Error; err != nil {
		return err
	}
	unique := make(map[string]struct{}, len(origins))
	for _, origin := range origins {
		origin = strings.TrimSpace(origin)
		if _, exists := unique[origin]; exists {
			continue
		}
		unique[origin] = struct{}{}
	}
	ordered := make([]string, 0, len(unique))
	for origin := range unique {
		ordered = append(ordered, origin)
	}
	sort.Strings(ordered)
	for _, origin := range ordered {
		if err := tx.Exec("INSERT INTO site_origins (site_id, origin) VALUES (?, ?)", siteID, origin).Error; err != nil {
			return err
		}
	}
	return nil
}

func attachSiteOrigins(database *gorm.DB, sites []Site) error {
	if len(sites) == 0 {
		return nil
	}
	ids := make([]string, 0, len(sites))
	for _, site := range sites {
		ids = append(ids, site.ID)
	}
	type originRow struct {
		SiteID string `gorm:"column:site_id"`
		Origin string `gorm:"column:origin"`
	}
	var rows []originRow
	if err := database.Table("site_origins").Where("site_id IN ?", ids).Order("site_id ASC, origin ASC").Find(&rows).Error; err != nil {
		return err
	}
	byID := make(map[string][]string, len(sites))
	for _, row := range rows {
		byID[row.SiteID] = append(byID[row.SiteID], row.Origin)
	}
	for index := range sites {
		sites[index].AllowedOrigins = append([]string(nil), byID[sites[index].ID]...)
	}
	return nil
}
