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
