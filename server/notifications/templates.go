package notifications

import (
	"context"
	"ecoku-server/config"
	"ecoku-server/model"
	"ecoku-server/utils"
	"errors"
	"fmt"
	"html"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
)

// Telegram budgets leave room for labels even when every rune takes two
// UTF-16 units. Text is truncated before escaping; markup and href never are.
const (
	telegramSiteBudget         = 100
	telegramTitleBudget        = 200
	telegramAuthorBudget       = 80
	telegramParentAuthorBudget = 40
	telegramBadgeBudget        = 16
	telegramParentBudget       = 400
	telegramContentBudget      = 1000
	subjectTitleBudget         = 60
	preheaderBudget            = 90
)

var smojiMarkerPattern = regexp.MustCompile(`!\[smoji:([^\]\r\n]+)\]\((https?://[^()\s]+)\)`)

func renderBloggerEmail(ctx context.Context, comment model.Comment, site model.Site) (emailMessage, error) {
	parent, err := loadParent(ctx, comment)
	if err != nil {
		return emailMessage{}, err
	}
	name := siteDisplayName(site)
	heading := fmt.Sprintf("您在 %s 上有新评论", name)
	label := "新评论"
	verb := "的评论"
	if comment.ParentID != nil {
		heading = fmt.Sprintf("您在 %s 上有新回复", name)
		label = "新回复"
		verb = "的回复"
	}
	targetURL := commentURL(pageURL(site, comment.Mark), comment.ID)
	title := notificationPageTitle(comment.PageTitle)
	published := displayTime(comment.CreatedAt)

	sections := []string{emailMetaSection([]emailMeta{
		{Label: "文章", Value: html.EscapeString(title)},
		{Label: "发布时间", Value: html.EscapeString(published), Mono: true},
	})}
	var text strings.Builder
	fmt.Fprintf(&text, "%s\n\n文章：%s\n发布时间：%s\n\n", heading, title, published)
	if parent != nil {
		sections = append(sections, emailQuoteSection(emailAuthorHTML(*parent, site)+" 的评论", emailContentHTML(parent.Content, site), false))
		fmt.Fprintf(&text, "%s 的评论：\n%s\n\n", plainAuthor(*parent, site), plainContent(parent.Content))
	}
	sections = append(sections, emailQuoteSection(emailAuthorHTML(comment, site)+" "+verb, emailContentHTML(comment.Content, site), true))
	fmt.Fprintf(&text, "%s %s：\n%s\n\n查看原文：%s\n\n——\n%s", plainAuthor(comment, site), verb, plainContent(comment.Content), targetURL, emailFooter(name))

	return emailMessage{
		Subject:    subjectWithTitle(heading, comment.PageTitle),
		SenderName: name,
		Text:       text.String(),
		HTML: renderEmailDocument(emailDocument{
			Title: heading, Preheader: emailPreheader(comment), SiteName: name,
			Label: fmt.Sprintf("%s · #%d", label, comment.ID), Heading: heading, Sections: sections,
			Action: &emailAction{Label: "查看原文", URL: targetURL}, Footer: emailFooter(name),
		}),
	}, nil
}

func renderReplyEmail(reply, parent model.Comment, site model.Site, targetPageURL string) emailMessage {
	name := siteDisplayName(site)
	heading := fmt.Sprintf("你在 %s 的评论收到了回复", name)
	targetURL := commentURL(targetPageURL, reply.ID)
	title := notificationPageTitle(reply.PageTitle)
	replied := displayTime(reply.CreatedAt)
	sections := []string{
		emailMetaSection([]emailMeta{
			{Label: "文章", Value: html.EscapeString(title)},
			{Label: "回复时间", Value: html.EscapeString(replied), Mono: true},
		}),
		emailQuoteSection("你的评论", emailContentHTML(parent.Content, site), false),
		emailQuoteSection(emailAuthorHTML(reply, site)+" 的回复", emailContentHTML(reply.Content, site), true),
	}
	text := fmt.Sprintf("%s\n\n文章：%s\n回复时间：%s\n\n你的评论：\n%s\n\n%s 的回复：\n%s\n\n查看回复：%s\n\n——\n%s",
		heading, title, replied, plainContent(parent.Content), plainAuthor(reply, site), plainContent(reply.Content), targetURL, emailFooter(name))
	return emailMessage{
		Subject:    subjectWithTitle(heading, reply.PageTitle),
		SenderName: name,
		Text:       text,
		HTML: renderEmailDocument(emailDocument{
			Title: heading, Preheader: emailPreheader(reply), SiteName: name,
			Label: "回复通知", Heading: heading, Sections: sections,
			Action: &emailAction{Label: "查看回复", URL: targetURL}, Footer: emailFooter(name),
		}),
	}
}

func renderTestEmail() emailMessage {
	heading := "Ecoku 测试邮件"
	body := "收到这封邮件，说明当前 SMTP 设置可以正常投递。"
	return emailMessage{
		Subject:    heading,
		SenderName: "Ecoku",
		Text:       heading + "\n\n" + body,
		HTML: renderEmailDocument(emailDocument{
			Title: heading, Preheader: body, Label: "测试邮件", Heading: heading,
			Sections: []string{emailParagraphSection(html.EscapeString(body))},
			Footer:   "此邮件由 Ecoku 发送，请勿直接回复本邮件。",
		}),
	}
}

// renderTelegram quotes the replied-to comment in a blockquote and keeps the
// new content as plain message text.
func renderTelegram(ctx context.Context, comment model.Comment, site model.Site) (string, error) {
	parent, err := loadParent(ctx, comment)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", err
	}
	lines := []string{
		"<b>" + html.EscapeString(telegramHeading(comment, site)) + "</b>",
		"文章：" + html.EscapeString(truncateRunes(notificationPageTitle(comment.PageTitle), telegramTitleBudget)),
		"发布时间：" + html.EscapeString(displayTime(comment.CreatedAt)),
		"",
	}
	verb := "的评论"
	if comment.ParentID != nil {
		verb = "的回复"
	}
	if parent != nil {
		lines = append(lines,
			telegramAuthor(*parent, site, telegramParentAuthorBudget)+" 的评论：",
			"<blockquote>"+html.EscapeString(truncateRunes(plainContent(parent.Content), telegramParentBudget))+"</blockquote>",
		)
	}
	lines = append(lines,
		telegramAuthor(comment, site, telegramAuthorBudget)+" "+verb+"：",
		html.EscapeString(truncateRunes(plainContent(comment.Content), telegramContentBudget)),
		"",
		`<a href="`+html.EscapeString(commentURL(pageURL(site, comment.Mark), comment.ID))+`">查看原文</a>`,
	)
	return strings.Join(lines, "\n"), nil
}

// renderTelegramRetracted replaces a sent message after its comment became a
// tombstone. Only the site and article remain; nickname and body are gone.
func renderTelegramRetracted(comment model.Comment, site model.Site) string {
	return strings.Join([]string{
		"<b>" + html.EscapeString(telegramHeading(comment, site)) + "</b>",
		"文章：" + html.EscapeString(truncateRunes(notificationPageTitle(comment.PageTitle), telegramTitleBudget)),
		"",
		"<i>这条评论已被删除，通知内容已移除。</i>",
	}, "\n")
}

func telegramHeading(comment model.Comment, site model.Site) string {
	name := truncateRunes(siteDisplayName(site), telegramSiteBudget)
	if comment.ParentID != nil {
		return fmt.Sprintf("您在 %s 上有新回复", name)
	}
	return fmt.Sprintf("您在 %s 上有新评论", name)
}

func telegramAuthor(comment model.Comment, site model.Site, budget int) string {
	value := "<b>" + html.EscapeString(truncateRunes(comment.Username, budget)) + "</b>"
	if badge := bloggerBadge(comment, site); badge != "" {
		value += " " + html.EscapeString(truncateRunes(badge, telegramBadgeBudget))
	}
	return value
}

func loadParent(ctx context.Context, comment model.Comment) (*model.Comment, error) {
	if comment.ParentID == nil {
		return nil, nil
	}
	var parent model.Comment
	if err := model.DB.WithContext(ctx).Where("id = ? AND site_id = ? AND mark = ?", *comment.ParentID, comment.SiteID, comment.Mark).First(&parent).Error; err != nil {
		return nil, err
	}
	// A tombstoned parent has no nickname or body left to quote.
	if parent.DeletedAt != nil {
		return nil, nil
	}
	return &parent, nil
}

func siteDisplayName(site model.Site) string {
	if name := strings.TrimSpace(site.Name); name != "" {
		return name
	}
	return site.Domain
}

func notificationPageTitle(value string) string {
	if title := strings.TrimSpace(value); title != "" {
		return title
	}
	return "这篇文章"
}

// subjectWithTitle appends the article title so inboxes keep notifications
// for different articles apart. An empty title adds nothing.
func subjectWithTitle(base, pageTitle string) string {
	title := singleLine(pageTitle)
	if title == "" {
		return base
	}
	return base + "：" + truncateRunes(title, subjectTitleBudget)
}

func emailFooter(siteName string) string {
	return "此邮件由 " + siteName + " 系统发送，请勿直接回复本邮件。"
}

func emailPreheader(comment model.Comment) string {
	return truncateRunes(comment.Username+"："+singleLine(plainContent(comment.Content)), preheaderBudget)
}

func bloggerBadge(comment model.Comment, site model.Site) string {
	if !comment.IsBlogger {
		return ""
	}
	return strings.TrimSpace(site.BloggerBadge)
}

func emailAuthorHTML(comment model.Comment, site model.Site) string {
	value := `<strong class="email-copy" style="color:` + emailInk + `;font-weight:bold;">` + html.EscapeString(comment.Username) + `</strong>`
	if badge := bloggerBadge(comment, site); badge != "" {
		value += ` <span class="email-accent" style="color:` + emailAccent + `;font-size:12px;">` + html.EscapeString(badge) + `</span>`
	}
	return value
}

func plainAuthor(comment model.Comment, site model.Site) string {
	if badge := bloggerBadge(comment, site); badge != "" {
		return comment.Username + " " + badge
	}
	return comment.Username
}

// emailContentHTML renders Smoji markers that still belong to the site's
// trusted image origin as images; any other marker keeps only its label.
func emailContentHTML(content string, site model.Site) string {
	origin := site.SmojiOrigin()
	var b strings.Builder
	cursor := 0
	for _, match := range smojiMarkerPattern.FindAllStringSubmatchIndex(content, -1) {
		b.WriteString(emailTextHTML(content[cursor:match[0]]))
		label := smojiText(content[match[2]:match[3]])
		source, sourceOrigin := normalizedOrigin(content[match[4]:match[5]])
		if origin != "" && sourceOrigin == origin {
			b.WriteString(`<img src="` + html.EscapeString(source) + `" alt="` + html.EscapeString(label) + `" height="28" style="height:28px;width:auto;max-width:72px;border:0;vertical-align:middle;">`)
		} else {
			b.WriteString(html.EscapeString(label))
		}
		cursor = match[1]
	}
	b.WriteString(emailTextHTML(content[cursor:]))
	return b.String()
}

func emailTextHTML(value string) string {
	return strings.ReplaceAll(html.EscapeString(normalizeNewlines(value)), "\n", "<br>")
}

// plainContent is the text form used by the plain email part and Telegram.
func plainContent(content string) string {
	replaced := smojiMarkerPattern.ReplaceAllStringFunc(content, func(marker string) string {
		return smojiText(smojiMarkerPattern.FindStringSubmatch(marker)[1])
	})
	return normalizeNewlines(replaced)
}

func smojiText(label string) string {
	return "[表情：" + strings.TrimSpace(label) + "]"
}

func normalizedOrigin(raw string) (string, string) {
	normalized, err := config.NormalizeSmojiManifestURL(raw)
	if err != nil || normalized == "" {
		return "", ""
	}
	parsed, err := url.Parse(normalized)
	if err != nil {
		return "", ""
	}
	return normalized, strings.ToLower(parsed.Scheme + "://" + parsed.Host)
}

func normalizeNewlines(value string) string {
	return strings.ReplaceAll(strings.ReplaceAll(value, "\r\n", "\n"), "\r", "\n")
}

func singleLine(value string) string {
	return strings.Join(strings.Fields(value), " ")
}

// displayTime uses the same zone as public comment timestamps and names the
// offset, so a reader in another zone is not misled.
func displayTime(value time.Time) string {
	location, err := time.LoadLocation(utils.DisplayTimeZone())
	if err != nil {
		location = time.UTC
	}
	local := value.In(location)
	_, offset := local.Zone()
	return local.Format("2006/01/02 15:04") + " (" + utcOffsetLabel(offset) + ")"
}

func utcOffsetLabel(seconds int) string {
	sign := "+"
	if seconds < 0 {
		sign, seconds = "-", -seconds
	}
	hours, minutes := seconds/3600, seconds%3600/60
	if minutes == 0 {
		return fmt.Sprintf("UTC%s%d", sign, hours)
	}
	return fmt.Sprintf("UTC%s%d:%02d", sign, hours, minutes)
}

func commentURL(page string, commentID uint) string {
	return fmt.Sprintf("%s#ecoku-comment-%d", strings.TrimSuffix(page, "#"), commentID)
}

func pageURL(site model.Site, mark string) string {
	base, err := url.Parse(site.SiteURL + "/")
	if err != nil || base.Host == "" {
		return site.SiteURL
	}
	mark = strings.TrimSpace(mark)
	raw, err := url.Parse(mark)
	if err != nil || raw.IsAbs() || raw.Scheme != "" || raw.Host != "" || raw.User != nil {
		return site.SiteURL
	}
	reference, err := url.Parse(strings.TrimPrefix(mark, "/"))
	if err != nil || reference.IsAbs() || reference.Scheme != "" || reference.Host != "" || reference.User != nil {
		return site.SiteURL
	}
	resolved := base.ResolveReference(reference)
	if !strings.EqualFold(resolved.Scheme, base.Scheme) || !strings.EqualFold(resolved.Host, base.Host) {
		return site.SiteURL
	}
	return resolved.String()
}

func truncateRunes(value string, maximum int) string {
	if utf8.RuneCountInString(value) <= maximum {
		return value
	}
	runes := []rune(value)
	return string(runes[:maximum-1]) + "…"
}
