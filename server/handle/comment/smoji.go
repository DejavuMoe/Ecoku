package comment

import (
	"ecoku-server/config"
	"ecoku-server/model"
	"net/url"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

var smojiMarkerPattern = regexp.MustCompile(`!\[smoji:([^\]\r\n]+)\]\((https?://[^()\s]+)\)`)

func validSmojiContent(content string, site model.Site) bool {
	matches := smojiMarkerPattern.FindAllStringSubmatchIndex(content, -1)
	if len(matches) == 0 {
		return !strings.Contains(content, "![smoji:")
	}
	origin := site.SmojiOrigin()
	if origin == "" {
		return false
	}
	previousEnd := 0
	for _, match := range matches {
		if strings.Contains(content[previousEnd:match[0]], "![smoji:") {
			return false
		}
		label := content[match[2]:match[3]]
		if utf8.RuneCountInString(label) > 40 || strings.TrimSpace(label) == "" || strings.IndexFunc(label, unicode.IsControl) >= 0 {
			return false
		}
		source, normalizeErr := config.NormalizeSmojiManifestURL(content[match[4]:match[5]])
		if normalizeErr != nil || source == "" {
			return false
		}
		sourceURL, _ := url.Parse(source)
		if strings.ToLower(sourceURL.Scheme+"://"+sourceURL.Host) != origin {
			return false
		}
		previousEnd = match[1]
	}
	return !strings.Contains(content[previousEnd:], "![smoji:")
}
