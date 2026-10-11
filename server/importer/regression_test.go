package importer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"
	"testing/iotest"

	"ecoku-server/model"
)

func TestEC07BrokenAncestorsPreserveDescendants(t *testing.T) {
	for _, tc := range []struct {
		name    string
		parents []string
		roots   int
	}{
		{"orphan", []string{"missing", "a"}, 1},
		{"orphan-grandchild", []string{"missing", "a", "b"}, 1},
		{"cycle-descendant", []string{"b", "a", "b", "c"}, 2},
		{"self-cycle-descendant", []string{"a", "a", "b"}, 1},
	} {
		for _, reverse := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/reverse=%t", tc.name, reverse), func(t *testing.T) {
				twikooTestDatabase(t)
				rows := make([]twikooComment, len(tc.parents))
				for i, parent := range tc.parents {
					id := string(rune('a' + i))
					index := i
					if reverse {
						index = len(rows) - 1 - i
					}
					rows[index] = twikooComment{ObjectID: id, ParentID: parent, RootID: "missing", PageKey: "/post", Nickname: id, Content: id}
				}
				data, err := json.Marshal(rows)
				if err != nil {
					t.Fatal(err)
				}
				result, err := ImportTwikoo(context.Background(), model.DB, strings.NewReader(string(data)), TwikooImportOptions{SiteID: "blog"})
				if err != nil {
					t.Fatal(err)
				}
				if result.Imported != len(rows) || result.Roots != tc.roots || result.Replies != len(rows)-tc.roots || result.Orphaned != tc.roots {
					t.Errorf("EC-07 hierarchy counts: got %+v; want imported=%d roots=%d replies=%d orphaned=%d", result, len(rows), tc.roots, len(rows)-tc.roots, tc.roots)
				}
				var comments []model.Comment
				if err := model.DB.Order("username").Find(&comments).Error; err != nil {
					t.Fatal(err)
				}
				if len(comments) != len(rows) {
					t.Fatalf("stored %d comments, want %d", len(comments), len(rows))
				}
				for i, comment := range comments {
					if i < tc.roots {
						if comment.ParentID != nil {
							t.Errorf("EC-07 %s must remain a root", comment.Username)
						}
					} else {
						parent := comments[int(tc.parents[i][0]-'a')]
						if comment.ParentID == nil || *comment.ParentID != parent.ID {
							t.Errorf("EC-07 %s lost direct parent %s", comment.Username, parent.Username)
						}
					}
				}
			})
		}
	}
}

func TestEC07ParentFallbackAndPageBoundary(t *testing.T) {
	for _, tc := range []struct {
		name, fixture string
		parents       map[string]string
		orphaned      int
	}{
		{
			"rid-fallback",
			`[{"_id":"a","url":"/"},{"_id":"b","pid":"missing","rid":"a","url":"/"},{"_id":"c","pid":"b","rid":"a","url":"/"}]`,
			map[string]string{"a": "", "b": "a", "c": "b"}, 0,
		},
		{
			"direct-orphan-before-rid",
			`[{"_id":"a","pid":"missing","url":"/"},{"_id":"b","url":"/"},{"_id":"c","pid":"a","rid":"b","url":"/"}]`,
			map[string]string{"a": "", "b": "", "c": "a"}, 1,
		},
		{
			"cross-page-direct-parent",
			`[{"_id":"a","url":"/other"},{"_id":"b","pid":"a","url":"/"},{"_id":"c","pid":"b","url":"/"}]`,
			map[string]string{"a": "", "b": "", "c": "b"}, 1,
		},
		{
			"cross-page-rid",
			`[{"_id":"a","url":"/other"},{"_id":"b","pid":"missing","rid":"a","url":"/"},{"_id":"c","pid":"b","url":"/"}]`,
			map[string]string{"a": "", "b": "", "c": "b"}, 1,
		},
		{
			"cycle-through-rid",
			`[{"_id":"a","pid":"missing","rid":"b","url":"/"},{"_id":"b","pid":"a","url":"/"},{"_id":"c","pid":"b","url":"/"}]`,
			map[string]string{"a": "", "b": "", "c": "b"}, 2,
		},
	} {
		for _, reverse := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/reverse=%t", tc.name, reverse), func(t *testing.T) {
				twikooTestDatabase(t)
				var rows []twikooComment
				if err := json.Unmarshal([]byte(tc.fixture), &rows); err != nil {
					t.Fatal(err)
				}
				for i := range rows {
					rows[i].Nickname = rows[i].ObjectID
					rows[i].Content = rows[i].ObjectID
				}
				if reverse {
					rows[0], rows[2] = rows[2], rows[0]
				}
				data, err := json.Marshal(rows)
				if err != nil {
					t.Fatal(err)
				}
				result, err := ImportTwikoo(context.Background(), model.DB, strings.NewReader(string(data)), TwikooImportOptions{SiteID: "blog"})
				if err != nil {
					t.Fatal(err)
				}
				var comments []model.Comment
				if err := model.DB.Find(&comments).Error; err != nil {
					t.Fatal(err)
				}
				byID := make(map[uint]string)
				for _, comment := range comments {
					byID[comment.ID] = comment.Username
				}
				roots := 0
				for _, comment := range comments {
					parent := ""
					if comment.ParentID != nil {
						parent = byID[*comment.ParentID]
					} else {
						roots++
					}
					if parent != tc.parents[comment.Username] {
						t.Errorf("EC-07 %s parent=%q, want %q", comment.Username, parent, tc.parents[comment.Username])
					}
				}
				if len(comments) != len(rows) || result.Imported != len(rows) || result.Orphaned != tc.orphaned || result.Roots != roots || result.Replies != len(rows)-roots {
					t.Errorf("EC-07 result=%+v rows=%d roots=%d want orphaned=%d", result, len(comments), roots, tc.orphaned)
				}
			})
		}
	}
}

type ec08Spaces struct{}

func (ec08Spaces) Read(p []byte) (int, error) {
	for i := range p {
		p[i] = ' '
	}
	return len(p), nil
}

func TestEC08CompleteBoundedJSON(t *testing.T) {
	const document = `[{"_id":"a","url":"/","comment":"first"}]`
	const capBytes = 64 << 20
	for _, dryRun := range []bool{false, true} {
		for _, tc := range []struct {
			name   string
			suffix func() io.Reader
			valid  bool
		}{
			{"single-array", func() io.Reader { return strings.NewReader("") }, true},
			{"whitespace", func() io.Reader { return strings.NewReader(" \r\n\t ") }, true},
			{"exact-cap", func() io.Reader { return io.LimitReader(ec08Spaces{}, capBytes-int64(len(document))) }, true},
			{"second-array", func() io.Reader { return strings.NewReader(`[{"_id":"b","url":"/","comment":"second"}]`) }, false},
			{"object", func() io.Reader { return strings.NewReader(`{}`) }, false},
			{"null", func() io.Reader { return strings.NewReader(`null`) }, false},
			{"garbage", func() io.Reader { return strings.NewReader(` trailing-garbage`) }, false},
			{"cap-plus-one", func() io.Reader { return io.LimitReader(ec08Spaces{}, capBytes-int64(len(document))+1) }, false},
			{"over-cap", func() io.Reader { return io.LimitReader(ec08Spaces{}, capBytes) }, false},
			{"read-error", func() io.Reader { return iotest.ErrReader(errors.New("fixture read error")) }, false},
		} {
			t.Run(fmt.Sprintf("%s/dry-run=%t", tc.name, dryRun), func(t *testing.T) {
				twikooTestDatabase(t)
				reader := io.MultiReader(strings.NewReader(document), tc.suffix())
				result, err := ImportTwikoo(context.Background(), model.DB, reader, TwikooImportOptions{SiteID: "blog", DryRun: dryRun})
				if tc.valid {
					if err != nil || result.Imported != 1 {
						t.Errorf("EC-08 valid document rejected: result=%+v err=%v", result, err)
					}
				} else if err == nil || result != (TwikooImportResult{}) {
					t.Errorf("EC-08 invalid complete input accepted: result=%+v err=%v", result, err)
				}
				for _, table := range []string{"comments", "notification_outbox"} {
					var count int64
					if err := model.DB.Table(table).Count(&count).Error; err != nil {
						t.Fatal(err)
					}
					want := int64(0)
					if tc.valid && !dryRun && table == "comments" {
						want = 1
					}
					if count != want {
						t.Errorf("EC-08 %s rows=%d, want %d", table, count, want)
					}
				}
			})
		}
	}
}

func TestEC08StopsAtCapPlusOne(t *testing.T) {
	twikooTestDatabase(t)
	const capBytes = 64 << 20
	const document = `[{"_id":"a","url":"/","comment":"first"}]`
	reader := &io.LimitedReader{R: io.MultiReader(strings.NewReader(document), ec08Spaces{}), N: 2 * capBytes}
	if _, err := ImportTwikoo(context.Background(), model.DB, reader, TwikooImportOptions{SiteID: "blog"}); err == nil || !strings.Contains(err.Error(), "exceeds 64 MiB") {
		t.Fatalf("EC-08 expected size error, got %v", err)
	}
	if read := 2*capBytes - reader.N; read != capBytes+1 {
		t.Errorf("EC-08 read %d bytes, want exactly cap+1=%d", read, capBytes+1)
	}
}

func TestEC09WhitespaceOnlyPreUsesPlaceholder(t *testing.T) {
	for _, tc := range []struct {
		name, raw string
	}{
		{"spaces", "<pre>   </pre>"},
		{"tabs-and-newlines", "<pre>\n\t\n</pre>"},
		{"nbsp", "<pre>&nbsp; &#x2003;</pre>"},
		{"nested-and-sanitized", "<pre><code> \t </code><script>bad()</script></pre>"},
		{"multiple-empty-blocks", "<pre>   </pre><p> </p><pre>\t</pre>"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			twikooTestDatabase(t)
			data, err := json.Marshal([]twikooComment{{ObjectID: "a", PageKey: "/post", Content: tc.raw}})
			if err != nil {
				t.Fatal(err)
			}
			result, err := ImportTwikoo(context.Background(), model.DB, strings.NewReader(string(data)), TwikooImportOptions{SiteID: "blog"})
			if err != nil || result.Imported != 1 {
				t.Fatalf("EC-09 whitespace-only pre must import placeholder: result=%+v err=%v", result, err)
			}
			var comment model.Comment
			if err := model.DB.First(&comment).Error; err != nil {
				t.Fatal(err)
			}
			if comment.Content != "[图片]" {
				t.Errorf("EC-09 whitespace-only pre stored %q, want placeholder %q", comment.Content, "[图片]")
			}
		})
	}
}

func TestEC09PreformattedWhitespace(t *testing.T) {
	for _, tc := range []struct {
		name, raw, want string
	}{
		{"reported", "<pre><code>if ready:\n    run()\n</code></pre>", "if ready:\n    run()"},
		{"first-line-tabs-blank-lines", "<pre>    first\n\tsecond\n\n\n    third  \n</pre>", "    first\n\tsecond\n\n\n    third  "},
		{"adjacent-text", "  before  <pre><code>if ready:\n    if ok:\n\t\trun()\n</code></pre>  after  ", "before\nif ready:\n    if ok:\n\t\trun()\nafter"},
		{"safe-nested-markup", "<pre><code>&lt;x&gt;\n    <b>run()</b><script>bad()</script><style>bad{}</style>\n\t<img alt='ok' src='bad'>\n</code></pre>", "<x>\n    run()\n\tok"},
		{"multiple-blocks", "<pre>  a\n</pre><p>  between  </p><pre>\tb\n</pre>", "  a\nbetween\n\tb"},
		{"boundary-blank-lines", "<pre>\n\n  a\n\n\n</pre>", "\n  a\n\n"},
		{"crlf-nbsp", "<pre>  a\r\n\tb&nbsp; \r\n</pre>", "  a\n\tb\u00a0 "},
		{"empty-unsafe-pre", "<p>before</p><pre><script>bad()</script><style>bad{}</style></pre><p>after</p>", "before\nafter"},
		{"ordinary-cleanup", "<p>  hello&nbsp;<b>world</b> </p><br><br><br><div> next<br> line<img src='x'></div><script>bad()</script><style>bad{}</style>", "hello world\n\nnext\nline[图片]"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			text, sanitized, err := htmlToPlainText(tc.raw)
			if err != nil || !sanitized || text != tc.want {
				t.Errorf("EC-09 converted text=%q, want %q; sanitized=%t err=%v", text, tc.want, sanitized, err)
			}
			twikooTestDatabase(t)
			data, err := json.Marshal([]twikooComment{{ObjectID: "a", PageKey: "/post", Content: tc.raw}})
			if err != nil {
				t.Fatal(err)
			}
			if _, err := ImportTwikoo(context.Background(), model.DB, strings.NewReader(string(data)), TwikooImportOptions{SiteID: "blog"}); err != nil {
				t.Fatal(err)
			}
			var comment model.Comment
			if err := model.DB.First(&comment).Error; err != nil {
				t.Fatal(err)
			}
			if comment.Content != tc.want {
				t.Errorf("EC-09 stored text=%q, want %q", comment.Content, tc.want)
			}
		})
	}
}
