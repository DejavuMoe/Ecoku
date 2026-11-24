// Package buildinfo carries values stamped into the binary at build time.
package buildinfo

import "regexp"

// version is set by the image build with
// -ldflags "-X ecoku-server/buildinfo.version=v<VERSION>".
var version = ""

var releaseTag = regexp.MustCompile(`^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$`)

// Version returns the release tag the binary was built from, such as "v0.6.2",
// or "dev" for a build without a release tag.
func Version() string {
	if releaseTag.MatchString(version) {
		return version
	}
	return "dev"
}
