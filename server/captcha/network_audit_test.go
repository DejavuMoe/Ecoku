package captcha

import (
	"net"
	"testing"
)

func TestAuditPublicIPBoundaries(t *testing.T) {
	for _, tc := range []struct {
		address string
		public  bool
	}{
		{"fec0::", false},
		{"fec0::1", false},
		{"feff:ffff:ffff:ffff:ffff:ffff:ffff:ffff", false},
		{"fe80::1", false},
		{"fc00::1", false},
		{"fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff", false},
		{"::1", false},
		{"2001:db8::1", false},
		{"10.0.0.1", false},
		{"::ffff:10.0.0.1", false},
		{"100.64.0.1", false},
		{"203.0.113.1", false},
		{"8.8.8.8", true},
		{"::ffff:8.8.8.8", true},
		{"2606:4700:4700::1111", true},
	} {
		t.Run(tc.address, func(t *testing.T) {
			ip := net.ParseIP(tc.address)
			if ip == nil {
				t.Fatal("invalid fixture address")
			}
			if got := isPublicIP(ip); got != tc.public {
				t.Fatalf("isPublicIP(%q) = %v, want %v", tc.address, got, tc.public)
			}
		})
	}
}
