package admin

import (
	"errors"
	"strconv"
	"strings"
	"unicode/utf8"
)

const (
	maximumCommentSearchRunes = 100
	maximumCommentSearchTerms = 8
)

var errCommentSearchTooLong = errors.New("comment search is too long")

// commentSearch is the admin list's q parameter split into words. Every word must
// match; a word matches if any searchable field contains it, or, written as #123,
// if it is the comment's ID.
type commentSearch struct {
	terms []string
}

// parseCommentSearch splits q on any Unicode space, keeps the first eight distinct
// words and rejects input longer than 100 characters or not valid UTF-8.
func parseCommentSearch(raw string) (commentSearch, error) {
	if !utf8.ValidString(raw) {
		return commentSearch{}, strconv.ErrSyntax
	}
	if utf8.RuneCountInString(strings.TrimSpace(raw)) > maximumCommentSearchRunes {
		return commentSearch{}, errCommentSearchTooLong
	}
	seen := make(map[string]bool)
	var terms []string
	for _, word := range strings.Fields(raw) {
		// SQLite LIKE folds ASCII letters only, so duplicates are judged the same way.
		key := asciiLower(word)
		if seen[key] {
			continue
		}
		seen[key] = true
		terms = append(terms, word)
		if len(terms) == maximumCommentSearchTerms {
			break
		}
	}
	return commentSearch{terms: terms}, nil
}

func (search commentSearch) active() bool { return len(search.terms) > 0 }

// clause returns a SQL condition and its arguments. A tombstone has lost its name,
// email, website and text, so deleted comments are matched on page and ID only.
func (search commentSearch) clause(deleted bool) (string, []any) {
	fields := []string{"username", "email", "url", "content", "page_title", "mark"}
	if deleted {
		fields = []string{"page_title", "mark"}
	}
	parts := make([]string, 0, len(search.terms))
	args := make([]any, 0, len(search.terms)*len(fields))
	for _, term := range search.terms {
		if id, ok := commentSearchID(term); ok {
			parts = append(parts, "id = ?")
			args = append(args, id)
			continue
		}
		pattern := "%" + escapeLike(term) + "%"
		matches := make([]string, 0, len(fields))
		for _, field := range fields {
			matches = append(matches, field+` LIKE ? ESCAPE '\'`)
			args = append(args, pattern)
		}
		parts = append(parts, "("+strings.Join(matches, " OR ")+")")
	}
	return "(" + strings.Join(parts, " AND ") + ")", args
}

func commentSearchID(term string) (uint64, bool) {
	digits, ok := strings.CutPrefix(term, "#")
	if !ok || digits == "" || strings.TrimLeft(digits, "0123456789") != "" {
		return 0, false
	}
	id, err := strconv.ParseUint(digits, 10, 63)
	return id, err == nil
}

func escapeLike(value string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(value)
}

func asciiLower(value string) string {
	return strings.Map(func(r rune) rune {
		if r >= 'A' && r <= 'Z' {
			return r + ('a' - 'A')
		}
		return r
	}, value)
}
