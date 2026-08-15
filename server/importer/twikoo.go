package importer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/net/html"
	"gorm.io/gorm"

	"ecoku-server/model"
)

var errDryRun = errors.New("twikoo import dry run")

// TwikooImportOptions defines the deliberately narrow first-deployment import.
// The destination site must already exist and contain no comments.
type TwikooImportOptions struct {
	SiteID string
	DryRun bool
}

type TwikooImportResult struct {
	Imported      int
	Roots         int
	Replies       int
	Orphaned      int
	Emails        int
	Websites      int
	SanitizedHTML int
	DistinctPages int
}

type twikooComment struct {
	ObjectID string `json:"_id"`
	ID       string `json:"id"`
	ParentID string `json:"pid"`
	RootID   string `json:"rid"`
	PageKey  string `json:"url"`
	Nickname string `json:"nick"`
	Email    string `json:"mail"`
	Website  string `json:"link"`
	Content  string `json:"comment"`
	Created  int64  `json:"created"`
	Updated  int64  `json:"updated"`
}

type preparedTwikooComment struct {
	sourceID  string
	parentKey string
	rootKey   string
	comment   model.Comment
}

// ImportTwikoo imports the fields Ecoku retains from a Twikoo JSON export.
// It never queues notifications and emits no comment or identity data.
func ImportTwikoo(ctx context.Context, database *gorm.DB, reader io.Reader, options TwikooImportOptions) (TwikooImportResult, error) {
	var result TwikooImportResult
	if database == nil {
		return result, fmt.Errorf("database is required")
	}
	siteID := strings.TrimSpace(options.SiteID)
	if siteID == "" {
		return result, fmt.Errorf("site ID is required")
	}

	decoder := json.NewDecoder(io.LimitReader(reader, 64<<20))
	var source []twikooComment
	if err := decoder.Decode(&source); err != nil {
		return result, fmt.Errorf("decode Twikoo export: %w", err)
	}
	if len(source) == 0 {
		return result, fmt.Errorf("Twikoo export contains no comments")
	}

	prepared, result, err := prepareTwikooComments(siteID, source)
	if err != nil {
		return TwikooImportResult{}, err
	}

	err = database.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var siteCount int64
		if err := tx.Table("sites").Where("id = ?", siteID).Count(&siteCount).Error; err != nil {
			return fmt.Errorf("check destination site: %w", err)
		}
		if siteCount != 1 {
			return fmt.Errorf("destination site %q does not exist", siteID)
		}
		var commentCount int64
		if err := tx.Table("comments").Where("site_id = ?", siteID).Count(&commentCount).Error; err != nil {
			return fmt.Errorf("check destination comments: %w", err)
		}
		if commentCount != 0 {
			return fmt.Errorf("destination site %q already contains comments", siteID)
		}

		inserted := make(map[string]model.Comment, len(prepared))
		remaining := append([]preparedTwikooComment(nil), prepared...)
		for len(remaining) > 0 {
			next := make([]preparedTwikooComment, 0, len(remaining))
			progress := false
			for _, item := range remaining {
				parentKey := item.parentKey
				if parentKey != "" {
					parent, found := inserted[parentKey]
					if !found && item.rootKey != "" {
						parent, found = inserted[item.rootKey]
					}
					if !found {
						next = append(next, item)
						continue
					}
					if parent.Mark != item.comment.Mark {
						item.parentKey = ""
						item.rootKey = ""
						result.Orphaned++
					} else {
						parentID := parent.ID
						item.comment.ParentID = &parentID
					}
				}
				if err := tx.Create(&item.comment).Error; err != nil {
					return fmt.Errorf("insert Twikoo comment: %w", err)
				}
				inserted[item.sourceID] = item.comment
				progress = true
			}
			if len(next) == 0 {
				break
			}
			if progress {
				remaining = next
				continue
			}
			// Broken exports can reference a deleted parent or contain a cycle. Keep
			// the historical comment as a root instead of dropping personal data.
			for _, item := range next {
				item.comment.ParentID = nil
				if err := tx.Create(&item.comment).Error; err != nil {
					return fmt.Errorf("insert orphaned Twikoo comment: %w", err)
				}
				inserted[item.sourceID] = item.comment
				result.Orphaned++
			}
			break
		}
		if err := model.BackfillHistoricalBloggerComments(tx, siteID); err != nil {
			return fmt.Errorf("backfill imported blogger comments: %w", err)
		}
		if options.DryRun {
			return errDryRun
		}
		return nil
	})
	if options.DryRun && errors.Is(err, errDryRun) {
		return result, nil
	}
	if err != nil {
		return TwikooImportResult{}, err
	}
	return result, nil
}

func prepareTwikooComments(siteID string, source []twikooComment) ([]preparedTwikooComment, TwikooImportResult, error) {
	result := TwikooImportResult{Imported: len(source)}
	prepared := make([]preparedTwikooComment, 0, len(source))
	known := make(map[string]struct{}, len(source))
	pages := make(map[string]struct{})
	for index, row := range source {
		sourceID := strings.TrimSpace(row.ObjectID)
		if sourceID == "" {
			sourceID = strings.TrimSpace(row.ID)
		}
		if sourceID == "" {
			sourceID = fmt.Sprintf("row-%d", index+1)
		}
		if _, duplicate := known[sourceID]; duplicate {
			return nil, TwikooImportResult{}, fmt.Errorf("duplicate Twikoo comment identifier")
		}
		known[sourceID] = struct{}{}

		mark, err := normalizePageKey(row.PageKey)
		if err != nil {
			return nil, TwikooImportResult{}, fmt.Errorf("row %d: %w", index+1, err)
		}
		pages[mark] = struct{}{}
		content, sanitized, err := htmlToPlainText(row.Content)
		if err != nil {
			return nil, TwikooImportResult{}, fmt.Errorf("row %d: convert comment text: %w", index+1, err)
		}
		if sanitized {
			result.SanitizedHTML++
		}
		if content == "" {
			content = "[图片]"
		}
		if utf8.RuneCountInString(content) > 10000 {
			return nil, TwikooImportResult{}, fmt.Errorf("row %d: comment exceeds 10000 characters", index+1)
		}

		nickname := strings.TrimSpace(row.Nickname)
		if nickname == "" {
			nickname = "访客"
		}
		if utf8.RuneCountInString(nickname) > 80 {
			return nil, TwikooImportResult{}, fmt.Errorf("row %d: nickname exceeds 80 characters", index+1)
		}
		email := optionalString(row.Email, 254)
		website := normalizeWebsite(row.Website)
		if email != nil {
			result.Emails++
		}
		if website != nil {
			result.Websites++
		}
		createdAt := twikooTime(row.Created)
		updatedAt := twikooTime(row.Updated)
		if updatedAt.IsZero() || updatedAt.Before(createdAt) {
			updatedAt = createdAt
		}
		parentKey := strings.TrimSpace(row.ParentID)
		if parentKey == "" {
			result.Roots++
		} else {
			result.Replies++
		}
		prepared = append(prepared, preparedTwikooComment{
			sourceID:  sourceID,
			parentKey: parentKey,
			rootKey:   strings.TrimSpace(row.RootID),
			comment: model.Comment{
				SiteID: siteID, Mark: mark, PageTitle: "", Username: nickname,
				Email: email, URL: website, Content: content,
				CreatedAt: createdAt, UpdatedAt: updatedAt,
			},
		})
	}
	result.DistinctPages = len(pages)
	return prepared, result, nil
}

func normalizePageKey(raw string) (string, error) {
	value := strings.TrimSpace(raw)
	if parsed, err := url.Parse(value); err == nil {
		if parsed.EscapedPath() != "" || parsed.IsAbs() {
			value = parsed.EscapedPath()
		} else if idx := strings.IndexAny(value, "?#"); idx >= 0 {
			value = value[:idx]
		}
	}
	if value == "" {
		return "", fmt.Errorf("page key is empty")
	}
	if !strings.HasPrefix(value, "/") {
		value = "/" + value
	}
	if utf8.RuneCountInString(value) > 512 {
		return "", fmt.Errorf("page key exceeds 512 characters")
	}
	if strings.ContainsAny(value, "?#") {
		return "", fmt.Errorf("page key must not contain a query or fragment")
	}
	return value, nil
}

func optionalString(raw string, maximum int) *string {
	value := strings.TrimSpace(raw)
	if value == "" || utf8.RuneCountInString(value) > maximum {
		return nil
	}
	return &value
}

func normalizeWebsite(raw string) *string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil
	}
	for _, candidate := range []string{value, "https://" + value} {
		parsed, err := url.Parse(candidate)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || parsed.User != nil {
			continue
		}
		if utf8.RuneCountInString(parsed.String()) <= 2048 {
			normalized := parsed.String()
			return &normalized
		}
	}
	return nil
}

func twikooTime(value int64) time.Time {
	if value <= 0 {
		return time.Unix(0, 0).UTC()
	}
	if value > 100_000_000_000 {
		return time.UnixMilli(value).UTC()
	}
	return time.Unix(value, 0).UTC()
}

func htmlToPlainText(raw string) (string, bool, error) {
	if strings.TrimSpace(raw) == "" {
		return "", false, nil
	}
	document, err := html.Parse(strings.NewReader(raw))
	if err != nil {
		return "", false, err
	}
	var builder strings.Builder
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node.Type == html.ElementNode && (node.Data == "script" || node.Data == "style") {
			return
		}
		if node.Type == html.TextNode {
			builder.WriteString(node.Data)
			return
		}
		if node.Type == html.ElementNode {
			switch node.Data {
			case "br":
				builder.WriteByte('\n')
			case "img":
				alt := ""
				for _, attribute := range node.Attr {
					if attribute.Key == "alt" {
						alt = strings.TrimSpace(attribute.Val)
						break
					}
				}
				if alt == "" {
					alt = "[图片]"
				}
				builder.WriteString(alt)
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
		if node.Type == html.ElementNode {
			switch node.Data {
			case "p", "div", "blockquote", "li", "pre", "h1", "h2", "h3", "h4", "h5", "h6":
				builder.WriteByte('\n')
			}
		}
	}
	walk(document)
	text := strings.ReplaceAll(builder.String(), "\u00a0", " ")
	lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	cleaned := make([]string, 0, len(lines))
	blank := false
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			if len(cleaned) > 0 && !blank {
				cleaned = append(cleaned, "")
			}
			blank = true
			continue
		}
		cleaned = append(cleaned, line)
		blank = false
	}
	return strings.TrimSpace(strings.Join(cleaned, "\n")), strings.Contains(raw, "<"), nil
}
