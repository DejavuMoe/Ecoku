package comment

import (
	"ecoku-server/model"
	"testing"
)

func TestValidSmojiContent(t *testing.T) {
	site := model.Site{SmojiEnabled: true, SmojiManifestURL: "https://static.example.test/smoji.json"}
	tests := []struct {
		name    string
		content string
		valid   bool
	}{
		{name: "plain text", content: "hello", valid: true},
		{name: "same origin marker", content: "hello ![smoji:wave](https://static.example.test/packs/wave.webp)", valid: true},
		{name: "other origin", content: "![smoji:wave](https://tracker.example/image.webp)", valid: false},
		{name: "malformed marker", content: "![smoji:wave]javascript:alert(1)", valid: false},
		{name: "empty label", content: "![smoji:](https://static.example.test/wave.webp)", valid: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if actual := validSmojiContent(test.content, site); actual != test.valid {
				t.Fatalf("validSmojiContent() = %v, want %v", actual, test.valid)
			}
		})
	}
	if validSmojiContent("![smoji:wave](https://static.example.test/wave.webp)", model.Site{}) {
		t.Fatal("disabled site accepted a smoji marker")
	}
}

func TestSmojiExplicitImageOrigin(t *testing.T) {
	site := model.Site{SmojiEnabled: true, SmojiManifestURL: "https://blog.example/smoji.json", SmojiImageOrigin: "https://cdn.example:443"}
	marker := "![smoji:挠脸](https://cdn.example/aodamiao/face.webp)"
	if !validSmojiContent(marker, site) {
		t.Fatal("explicitly trusted CDN rejected")
	}
	for _, raw := range []string{"https://blog.example/face.webp", "https://tracker.example/face.webp", "https://cdn.example:444/face.webp", "https://cdn.example/face.webp?", "https://cdn.example/face.webp#"} {
		if validSmojiContent("![smoji:脸]("+raw+")", site) {
			t.Fatalf("untrusted image accepted: %s", raw)
		}
	}
	site.SmojiImageOrigin = ""
	if validSmojiContent(marker, site) {
		t.Fatal("empty override must retain the manifest origin")
	}
	site.SmojiImageOrigin = "https://cdn.example/path"
	if validSmojiContent(marker, site) {
		t.Fatal("invalid override must fail closed")
	}
	site.SmojiImageOrigin = "https://cdn.example"
	site.SmojiEnabled = false
	if validSmojiContent(marker, site) {
		t.Fatal("disabled site accepted a sticker")
	}
}

func TestSmojiURLRoundTrip(t *testing.T) {
	site := model.Site{SmojiEnabled: true, SmojiManifestURL: "https://static.example.test:443/smoji.json"}
	for _, source := range []string{"https://static.example.test/face%281%29.png", "https://static.example.test:443/face.png", "https://static.example.test:0443/face.png"} {
		if !validSmojiContent("![smoji:笑]("+source+")", site) {
			t.Fatalf("same origin rejected: %s", source)
		}
	}
	if validSmojiContent("![smoji:笑](https://static.example.test:444/face.png)", site) {
		t.Fatal("different port accepted")
	}
}

func TestSmojiNonDefaultPortCanonicalization(t *testing.T) {
	site := model.Site{SmojiEnabled: true, SmojiManifestURL: "https://static.example.test:08443/smoji.json"}
	if !validSmojiContent("![smoji:笑](https://static.example.test:8443/face.png)", site) {
		t.Fatal("numeric same port rejected")
	}
}
