package notifications

import (
	"ecoku-server/model"
	"fmt"
	"html"
	"net/url"
	"strings"
	"unicode/utf8"
)

func renderBloggerEmail(comment model.Comment, site model.Site) (emailMessage, error) {
	name := siteDisplayName(site)
	targetURL := fmt.Sprintf("%s#ecoku-comment-%d", strings.TrimSuffix(pageURL(site, comment.Mark), "#"), comment.ID)
	pageTitle := notificationPageTitle(comment.PageTitle)
	title := fmt.Sprintf("您在 %s 上有新评论", name)
	label := "新评论"
	detail := `<dl style="margin:0 0 24px;display:grid;grid-template-columns:72px 1fr;gap:10px 16px;font-size:14px;line-height:1.6">` +
		`<dt style="color:rgb(91,86,78)">评论人</dt><dd style="margin:0;font-weight:600">` + html.EscapeString(comment.Username) + `</dd>` +
		`<dt style="color:rgb(91,86,78)">文章标题</dt><dd style="margin:0">` + html.EscapeString(pageTitle) + `</dd>` +
		`<dt style="color:rgb(91,86,78)">提交时间</dt><dd style="margin:0">` + comment.CreatedAt.UTC().Format("2006/01/02 15:04") + `</dd></dl>` +
		emailQuote(comment.Content, false)
	text := fmt.Sprintf("%s\n\n评论人：%s\n文章标题：%s\n提交时间：%s\n\n%s\n\n查看原文：%s", title, comment.Username, pageTitle, comment.CreatedAt.UTC().Format("2006/01/02 15:04"), comment.Content, targetURL)

	if comment.ParentID != nil {
		var parent model.Comment
		if err := model.DB.Where("id = ? AND site_id = ? AND mark = ?", *comment.ParentID, comment.SiteID, comment.Mark).First(&parent).Error; err != nil {
			return emailMessage{}, err
		}
		title = fmt.Sprintf("您在 %s 上有新回复", name)
		label = "新回复"
		detail = `<p style="margin:0 0 8px;color:rgb(91,86,78);font-size:13px">` + html.EscapeString(parent.Username) + ` 的评论</p>` +
			emailQuote(parent.Content, true) +
			`<p style="margin:22px 0 8px;color:rgb(91,86,78);font-size:13px">` + html.EscapeString(comment.Username) + ` 的回复</p>` +
			emailQuote(comment.Content, false)
		text = fmt.Sprintf("%s\n\n文章标题：%s\n\n%s 的评论：\n%s\n\n%s 的回复：\n%s\n\n查看原文：%s", title, pageTitle, parent.Username, parent.Content, comment.Username, comment.Content, targetURL)
	}

	body := `<p style="margin:0 0 8px;color:rgb(43,91,113);font-size:12px;font-weight:700;letter-spacing:.06em">` + label + ` · #` + fmt.Sprint(comment.ID) + `</p>` +
		`<h1 style="margin:0 0 26px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.25">` + html.EscapeString(title) + `</h1>` +
		detail + emailButton("查看原文", targetURL)
	return emailMessage{Subject: title, Text: text, HTML: notificationEmailShell(name, title, body)}, nil
}

func renderReplyEmail(reply, parent model.Comment, site model.Site, targetPageURL string) emailMessage {
	name := siteDisplayName(site)
	title := fmt.Sprintf("你在 %s 的评论收到了回复", name)
	targetURL := fmt.Sprintf("%s#ecoku-comment-%d", strings.TrimSuffix(targetPageURL, "#"), reply.ID)
	body := `<p style="margin:0 0 8px;color:rgb(42,111,77);font-size:12px;font-weight:700;letter-spacing:.06em">回复通知</p>` +
		`<h1 style="margin:0 0 26px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.25">` + html.EscapeString(title) + `</h1>` +
		`<p style="margin:0 0 8px;color:rgb(91,86,78);font-size:13px">你的评论</p>` + emailQuote(parent.Content, true) +
		`<p style="margin:22px 0 8px;color:rgb(91,86,78);font-size:13px">` + html.EscapeString(reply.Username) + ` 的回复</p>` + emailQuote(reply.Content, false) +
		emailButton("查看回复", targetURL)
	text := fmt.Sprintf("%s\n\n你的评论：\n%s\n\n%s 的回复：\n%s\n\n查看回复：%s", title, parent.Content, reply.Username, reply.Content, targetURL)
	return emailMessage{Subject: title, Text: text, HTML: notificationEmailShell(name, title, body)}
}

func renderTelegram(comment model.Comment, site model.Site) (string, error) {
	name := siteDisplayName(site)
	title := fmt.Sprintf("您在 %s 上有新评论", name)
	label := "评论人"
	if comment.ParentID != nil {
		title = fmt.Sprintf("您在 %s 上有新回复", name)
		label = "回复人"
	}
	pageTitle := notificationPageTitle(comment.PageTitle)
	targetURL := fmt.Sprintf("%s#ecoku-comment-%d", strings.TrimSuffix(pageURL(site, comment.Mark), "#"), comment.ID)
	parentContext := ""
	if comment.ParentID != nil {
		var parent model.Comment
		if err := model.DB.Where("id = ? AND site_id = ? AND mark = ?", *comment.ParentID, comment.SiteID, comment.Mark).First(&parent).Error; err == nil {
			parentContext = fmt.Sprintf("\n<b>原评论：</b>%s\n", html.EscapeString(truncateRunes(parent.Content, 400)))
		}
	}
	message := fmt.Sprintf("<b>%s</b>\n\n<b>%s：</b>%s\n<b>文章标题：</b>%s%s\n%s\n\n<a href=\"%s\">查看原文</a>",
		html.EscapeString(title), label, html.EscapeString(comment.Username), html.EscapeString(pageTitle), parentContext, html.EscapeString(truncateRunes(comment.Content, 2800)), html.EscapeString(targetURL))
	return truncateRunes(message, 3900), nil
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

func emailQuote(value string, muted bool) string {
	background := "rgb(250,249,245)"
	border := "1px solid rgba(20,20,19,.14)"
	if muted {
		background = "rgb(243,239,231)"
		border = "0"
	}
	return `<div style="margin:0;padding:16px 18px;border:` + border + `;border-radius:10px;background:` + background + `;font-size:15px;line-height:1.7;white-space:pre-wrap;word-break:break-word">` + html.EscapeString(value) + `</div>`
}

func emailButton(label, target string) string {
	return `<p style="margin:28px 0 0"><a href="` + html.EscapeString(target) + `" style="display:inline-block;padding:12px 20px;border-radius:999px;background:rgb(43,91,113);color:rgb(255,255,255);text-decoration:none;font-weight:700">` + html.EscapeString(label) + `</a></p>`
}

func notificationEmailShell(siteName, title, content string) string {
	footer := "此邮件由 " + siteName + " 系统发送，请勿直接回复本邮件。"
	return `<!doctype html><html><body style="margin:0;background:rgb(243,239,231);color:rgb(20,20,19);font-family:Arial,Helvetica,sans-serif"><div style="max-width:600px;margin:0 auto;padding:32px 12px"><div style="border:1px solid rgba(20,20,19,.14);border-radius:14px;background:rgb(250,249,245);overflow:hidden"><div style="padding:24px 36px;border-bottom:1px solid rgba(20,20,19,.14);font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:bold">Ecoku <span style="float:right;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;color:rgb(91,86,78)">` + html.EscapeString(siteName) + `</span></div><div aria-label="` + html.EscapeString(title) + `" style="padding:34px 36px 36px">` + content + `</div><div style="padding:20px 36px;border-top:1px solid rgba(20,20,19,.14);color:rgb(91,86,78);font-size:12px;line-height:1.6">` + html.EscapeString(footer) + `</div></div></div></body></html>`
}

func emailShell(title, content string) string {
	return `<!doctype html><html><body style="margin:0;background:rgb(243,239,231);color:rgb(20,20,19);font-family:Arial,Helvetica,sans-serif"><div style="max-width:600px;margin:0 auto;padding:32px 12px"><div style="border:1px solid rgba(20,20,19,.14);border-radius:14px;background:rgb(250,249,245);overflow:hidden"><div style="padding:28px 36px 24px;border-bottom:1px solid rgba(20,20,19,.14);font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:bold">Ecoku</div><div aria-label="` + html.EscapeString(title) + `" style="padding:34px 36px 36px"><h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:30px">` + html.EscapeString(title) + `</h1>` + content + `</div></div></div></body></html>`
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
