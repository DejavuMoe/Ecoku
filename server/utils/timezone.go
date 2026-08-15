package utils

import (
	"os"
	"strings"
	"time"

	_ "time/tzdata"
)

const DefaultDisplayTimeZone = "Asia/Shanghai"

// DisplayTimeZone returns the container TZ for public comment timestamps.
func DisplayTimeZone() string {
	if tz := strings.TrimSpace(os.Getenv("TZ")); tz != "" {
		if _, err := time.LoadLocation(tz); err == nil {
			return tz
		}
	}
	name := time.Local.String()
	if name != "" && name != "Local" {
		if _, err := time.LoadLocation(name); err == nil {
			return name
		}
	}
	return DefaultDisplayTimeZone
}
