package utils

import "testing"

func TestDisplayTimeZoneUsesContainerTZ(t *testing.T) {
	t.Setenv("TZ", "Asia/Singapore")
	if got := DisplayTimeZone(); got != "Asia/Singapore" {
		t.Fatalf("got %q", got)
	}
}

func TestDisplayTimeZoneFallsBackForInvalidTZ(t *testing.T) {
	t.Setenv("TZ", "Not/AZone")
	if got := DisplayTimeZone(); got == "" {
		t.Fatal("expected a timezone name")
	}
}
