package buildinfo

import "testing"

func TestVersion(t *testing.T) {
	original := version
	t.Cleanup(func() { version = original })
	for _, tc := range []struct{ stamped, want string }{
		{"", "dev"},
		{"development", "dev"},
		{"0.6.2", "dev"},
		{"v0.6.2", "v0.6.2"},
		{"v1.0.0-rc.1", "v1.0.0-rc.1"},
		{"v0.6.2\n", "dev"},
	} {
		version = tc.stamped
		if got := Version(); got != tc.want {
			t.Errorf("Version() with %q = %q, want %q", tc.stamped, got, tc.want)
		}
	}
}
