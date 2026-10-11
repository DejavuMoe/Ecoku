package config

import "testing"

func TestEC12NormalizeOriginPorts(t *testing.T) {
	for _, tc := range []struct{ input, want string }{
		{"https://Example.test:443", "https://example.test"},
		{"https://example.test:00443/", "https://example.test"},
		{"http://example.test:00080", "http://example.test"},
		{"https://example.test:08443", "https://example.test:8443"},
		{"https://[::1]:00443", "https://[::1]"},
		{"http://[::1]:00080", "http://[::1]"},
		{"https://[::1]:08443", "https://[::1]:8443"},
		{"https://[::1]", "https://[::1]"},
	} {
		got, err := NormalizeOrigin(tc.input)
		if err != nil || got != tc.want {
			t.Errorf("EC-12: NormalizeOrigin(%q) = %q, %v; want %q", tc.input, got, err, tc.want)
		}
	}
}

func TestEC12ReviewIPv6CanonicalOrigins(t *testing.T) {
	for _, tc := range []struct{ input, want string }{
		{"https://[0:0:0:0:0:0:0:1]:08443", "https://[::1]:8443"},
		{"https://[0:0:0:0:0:0:0:1]", "https://[::1]"},
		{"https://[2001:0DB8:0000:0000:0000:0000:0000:0001]:00443", "https://[2001:db8::1]"},
		{"https://[0:0:0:0:0:ffff:c000:201]:08443", "https://[::ffff:c000:201]:8443"},
		{"https://[::ffff:192.0.2.1]", "https://[::ffff:c000:201]"},
		{"https://192.0.2.1:8443", "https://192.0.2.1:8443"},
	} {
		got, err := NormalizeOrigin(tc.input)
		if err != nil || got != tc.want {
			t.Errorf("EC-12 review: NormalizeOrigin(%q)=%q, %v; want %q", tc.input, got, err, tc.want)
		}
	}
}
