package model

import (
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
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

func TestBloggerPassphraseRejectsImpossibleCandidates(t *testing.T) {
	for _, candidate := range []string{"Guest", strings.Repeat("中", 11), "long-pass\nphrase"} {
		// An otherwise matching hash must not bypass the public passphrase rules.
		hash, err := bcrypt.GenerateFromPassword([]byte(candidate), bcrypt.MinCost)
		if err != nil {
			t.Fatal(err)
		}
		if (Site{BloggerPassphraseHash: string(hash)}).MatchesBloggerPassphrase(candidate) {
			t.Fatalf("invalid passphrase accepted: %q", candidate)
		}
	}
	for _, candidate := range []string{strings.Repeat("a", 12), strings.Repeat("中", 12)} {
		hash, err := HashBloggerPassphrase(candidate)
		if err != nil {
			t.Fatal(err)
		}
		if !(Site{BloggerPassphraseHash: hash}).MatchesBloggerPassphrase(" " + candidate + " ") {
			t.Fatal("valid minimum-length passphrase no longer matches")
		}
	}
}
