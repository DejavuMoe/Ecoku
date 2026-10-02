// Package testsite inserts sites for tests. Ecoku creates sites only in the
// admin console, so tests that need one write it straight into SQLite.
package testsite

import (
	"net/url"
	"strings"
	"testing"
	"time"

	"ecoku-server/config"

	"gorm.io/gorm"
)

// Site lists the fields a test can set. Empty fields take the admin console's
// defaults; EmailRequired defaults to true.
type Site struct {
	ID              string
	SiteURL         string
	Name            string
	AllowedOrigins  []string
	EmailRequired   *bool
	WebsiteRequired bool
	Placeholder     string
	DefaultSort     string
	LengthLimit     int
	EmptyMessage    string
}

// Create inserts the sites using only the schema v1 columns, so it also works
// on a database that later migrations have not reached yet.
func Create(t testing.TB, database *gorm.DB, sites ...Site) {
	t.Helper()
	now := time.Now().UTC()
	for _, site := range sites {
		siteURL, err := config.NormalizeSiteURL(site.SiteURL)
		if err != nil {
			t.Fatalf("site %q: %v", site.ID, err)
		}
		parsed, _ := url.Parse(siteURL)
		emailRequired := site.EmailRequired == nil || *site.EmailRequired
		placeholder := defaultString(site.Placeholder, config.DefaultCommentPlaceholder)
		sortMode := defaultString(site.DefaultSort, config.DefaultCommentSort)
		emptyMessage := defaultString(site.EmptyMessage, config.DefaultEmptyMessage)
		lengthLimit := site.LengthLimit
		if lengthLimit == 0 {
			lengthLimit = config.DefaultCommentLimit
		}
		if err := database.Exec(`INSERT INTO sites (
  id, site_url, domain, name, default_sort, email_required, website_required,
  placeholder, comment_limit, empty_message, revision, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
			site.ID, siteURL, strings.ToLower(parsed.Hostname()), site.Name, sortMode,
			emailRequired, site.WebsiteRequired, placeholder, lengthLimit, emptyMessage, now, now,
		).Error; err != nil {
			t.Fatalf("create site %q: %v", site.ID, err)
		}
		for _, raw := range site.AllowedOrigins {
			origin, err := config.NormalizeOrigin(raw)
			if err != nil {
				t.Fatalf("site %q origin %q: %v", site.ID, raw, err)
			}
			if err := database.Exec("INSERT INTO site_origins (site_id, origin) VALUES (?, ?)", site.ID, origin).Error; err != nil {
				t.Fatalf("create site %q origin: %v", site.ID, err)
			}
		}
	}
}

func defaultString(value, fallback string) string {
	if value = strings.TrimSpace(value); value != "" {
		return value
	}
	return fallback
}
