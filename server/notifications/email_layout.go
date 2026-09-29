package notifications

import (
	"html"
	"strings"
)

// Email layout follows designs/admin-moderation/notifications-v6.js. Colors
// are the comment area v17 / admin v13 paper-and-ink tokens resolved to hex,
// because mail clients support neither CSS variables nor color-mix.
const (
	emailPaper    = "#f7f4ee"
	emailSurface  = "#fbf9f5"
	emailInk      = "#1e1c19"
	emailInkSoft  = "#35312b"
	emailMuted    = "#6b655b"
	emailLine     = "#cbc3b5"
	emailLineSoft = "rgba(30,28,25,0.12)"
	emailWash     = "#efebe3"
	emailAccent   = "#9a4733"

	emailFontSans     = "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei UI','Microsoft YaHei','Noto Sans CJK SC','Source Han Sans SC','Noto Sans SC','Helvetica Neue',Arial,sans-serif"
	emailFontMono     = "ui-monospace,'SF Mono','Cascadia Mono',Menlo,Consolas,monospace"
	emailFontWordmark = "Georgia,'Times New Roman',serif"

	emailDarkRules = ".email-body,.email-outer{background-color:#1a1816!important}" +
		".email-shell{background-color:#211f1c!important;border-color:rgba(238,232,221,0.12)!important}" +
		".email-copy{color:#eee8dd!important}" +
		".email-soft{color:#d3ccbf!important}" +
		".email-muted{color:#a29a8c!important}" +
		".email-accent{color:#d57c64!important}" +
		".email-rule{border-color:rgba(238,232,221,0.12)!important}" +
		".email-wash{background-color:#26231f!important}" +
		".email-frame{border-color:#4b453d!important}" +
		".email-mark{border-color:#eee8dd!important;color:#eee8dd!important}" +
		".email-button{background-color:#eee8dd!important}" +
		".email-button-link{color:#1a1816!important}"
	emailNarrowRules = ".email-pad{padding-right:22px!important;padding-left:22px!important}" +
		".email-title{font-size:22px!important;line-height:30px!important}" +
		".email-meta-label{width:64px!important}"
)

type emailAction struct {
	Label string
	URL   string
}

type emailDocument struct {
	Title     string
	Preheader string
	SiteName  string
	Label     string
	Heading   string
	Sections  []string
	Action    *emailAction
	Footer    string
}

type emailMeta struct {
	Label string
	Value string // already escaped HTML
	Mono  bool
}

func emailMetaSection(rows []emailMeta) string {
	var body strings.Builder
	for _, row := range rows {
		font := "font-size:14px;"
		if row.Mono {
			font = "font-family:" + emailFontMono + ";font-size:13px;"
		}
		body.WriteString(`<tr><td class="email-muted email-meta-label" width="72" valign="top" style="width:72px;padding:4px 0;color:` + emailMuted + `;font-size:13px;line-height:20px;">` + html.EscapeString(row.Label) + `</td>` +
			`<td class="email-copy" valign="top" style="padding:4px 0;color:` + emailInk + `;` + font + `line-height:20px;word-break:break-word;overflow-wrap:anywhere;">` + row.Value + `</td></tr>`)
	}
	return `<tr><td class="email-pad" style="padding:20px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">` + body.String() + `</table></td></tr>`
}

// emailQuoteSection shows earlier context on a wash background and the new
// content inside a hairline frame, so the two never read as one block.
func emailQuoteSection(caption, content string, primary bool) string {
	box := `class="email-wash" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:6px;border-collapse:separate;background-color:` + emailWash + `;"`
	text := `class="email-soft" style="padding:14px 18px;color:` + emailInkSoft + `;font-size:14px;line-height:24px;word-break:break-word;overflow-wrap:anywhere;"`
	if primary {
		box = `class="email-frame" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid ` + emailLine + `;border-radius:6px;border-collapse:separate;"`
		text = `class="email-copy" style="padding:16px 18px;color:` + emailInk + `;font-size:15px;line-height:26px;word-break:break-word;overflow-wrap:anywhere;"`
	}
	return `<tr><td class="email-pad" style="padding:22px 36px 0;">` +
		`<p class="email-muted" style="margin:0 0 8px;color:` + emailMuted + `;font-size:13px;line-height:20px;word-break:break-word;overflow-wrap:anywhere;">` + caption + `</p>` +
		`<table ` + box + `><tr><td ` + text + `>` + content + `</td></tr></table></td></tr>`
}

func emailParagraphSection(content string) string {
	return `<tr><td class="email-pad email-soft" style="padding:20px 36px 0;color:` + emailInkSoft + `;font-size:15px;line-height:26px;">` + content + `</td></tr>`
}

func renderEmailDocument(doc emailDocument) string {
	var b strings.Builder
	b.WriteString(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">`)
	b.WriteString(`<meta name="viewport" content="width=device-width, initial-scale=1">`)
	b.WriteString(`<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">`)
	b.WriteString(`<title>` + html.EscapeString(doc.Title) + `</title>`)
	b.WriteString(`<style>@media only screen and (max-width:620px){` + emailNarrowRules + `}@media (prefers-color-scheme:dark){` + emailDarkRules + `}</style></head>`)
	b.WriteString(`<body class="email-body" style="margin:0;padding:0;background-color:` + emailPaper + `;color:` + emailInk + `;font-family:` + emailFontSans + `;-webkit-text-size-adjust:100%;">`)
	b.WriteString(`<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">` + html.EscapeString(doc.Preheader) + `</div>`)
	b.WriteString(`<table class="email-outer" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:` + emailPaper + `;"><tr><td align="center" style="padding:32px 12px;">`)
	b.WriteString(`<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->`)
	b.WriteString(`<table class="email-shell" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border:1px solid ` + emailLineSoft + `;border-radius:6px;border-collapse:separate;background-color:` + emailSurface + `;font-family:` + emailFontSans + `;">`)

	b.WriteString(`<tr><td class="email-pad email-rule" style="padding:22px 36px;border-bottom:1px solid ` + emailLineSoft + `;">`)
	b.WriteString(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr>`)
	b.WriteString(`<td width="36" valign="middle" style="width:36px;"><table role="presentation" width="26" cellpadding="0" cellspacing="0" border="0" style="width:26px;border-collapse:separate;"><tr>`)
	b.WriteString(`<td class="email-mark" align="center" height="24" style="height:24px;border:1px solid ` + emailInk + `;border-radius:13px;color:` + emailInk + `;font-family:` + emailFontWordmark + `;font-size:14px;font-weight:bold;line-height:24px;mso-line-height-rule:exactly;">E</td></tr></table></td>`)
	b.WriteString(`<td class="email-copy" valign="middle" style="color:` + emailInk + `;font-family:` + emailFontWordmark + `;font-size:17px;font-weight:bold;line-height:24px;letter-spacing:0.01em;">Ecoku</td>`)
	b.WriteString(`<td class="email-muted" align="right" valign="middle" style="color:` + emailMuted + `;font-size:12px;line-height:18px;word-break:break-word;">` + html.EscapeString(doc.SiteName) + `</td>`)
	b.WriteString(`</tr></table></td></tr>`)

	b.WriteString(`<tr><td class="email-pad" style="padding:32px 36px 4px;">`)
	b.WriteString(`<p class="email-accent" style="margin:0 0 10px;color:` + emailAccent + `;font-size:12px;font-weight:bold;letter-spacing:0.08em;line-height:18px;">` + html.EscapeString(doc.Label) + `</p>`)
	b.WriteString(`<h1 class="email-title email-copy" style="margin:0;color:` + emailInk + `;font-family:` + emailFontSans + `;font-size:24px;font-weight:bold;line-height:32px;word-break:break-word;">` + html.EscapeString(doc.Heading) + `</h1></td></tr>`)

	for _, section := range doc.Sections {
		b.WriteString(section)
	}

	if doc.Action != nil {
		b.WriteString(`<tr><td class="email-pad" style="padding:28px 36px 36px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr>`)
		b.WriteString(`<td class="email-button" align="center" bgcolor="` + emailInk + `" style="border-radius:6px;background-color:` + emailInk + `;">`)
		b.WriteString(`<a class="email-button-link" href="` + html.EscapeString(doc.Action.URL) + `" style="display:inline-block;padding:11px 22px;border-radius:6px;color:` + emailSurface + `;font-family:` + emailFontSans + `;font-size:14px;font-weight:bold;line-height:20px;text-decoration:none;">` + html.EscapeString(doc.Action.Label) + `</a>`)
		b.WriteString(`</td></tr></table></td></tr>`)
	} else {
		b.WriteString(`<tr><td style="padding:0 0 36px;"></td></tr>`)
	}

	b.WriteString(`<tr><td class="email-pad email-muted email-rule" style="padding:18px 36px 22px;border-top:1px solid ` + emailLineSoft + `;color:` + emailMuted + `;font-size:12px;line-height:19px;word-break:break-word;">` + html.EscapeString(doc.Footer) + `</td></tr>`)
	b.WriteString(`</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`)
	return b.String()
}
