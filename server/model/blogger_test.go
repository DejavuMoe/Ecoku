package model

import (
	"strings"
	"testing"
)

func TestBloggerPassphraseByteBoundary(t *testing.T) {
	for _, passphrase := range []string{strings.Repeat("a", 72), strings.Repeat("中", 24), strings.Repeat("😀", 18)} {
		hash, err := HashBloggerPassphrase(passphrase)
		if err != nil {
			t.Fatal(err)
		}
		site := Site{BloggerPassphraseHash: hash}
		if !site.MatchesBloggerPassphrase(passphrase) {
			t.Fatal("existing bcrypt verification changed")
		}
		if site.MatchesBloggerPassphrase(passphrase + "x") {
			t.Fatal("overlong candidate accepted")
		}
	}
	for _, passphrase := range []string{strings.Repeat("a", 73), strings.Repeat("中", 25), strings.Repeat("😀", 19)} {
		if ValidateBloggerPassphrase(passphrase) == nil {
			t.Fatal("overlong passphrase accepted")
		}
	}
}
