// Package version exposes build-time version metadata for the storyquery CLI.
//
// The string variables are intended to be overridden at build time via the Go
// linker, e.g.:
//
//	go build -ldflags "-X github.com/adriankarlen/storyquery/internal/version.Version=1.0.0"
package version

import "runtime"

var (
	// Version is the semantic version of the build. Defaults to "dev".
	Version = "dev"
	// GitCommit is the git commit the binary was built from.
	GitCommit = "none"
	// BuildTime is the UTC timestamp of the build.
	BuildTime = "unknown"
)

// Info returns the build metadata as an ordered set of key/value fields.
func Info() map[string]string {
	return map[string]string{
		"version":    Version,
		"git_commit": GitCommit,
		"build_time": BuildTime,
		"go_version": runtime.Version(),
		"os":         runtime.GOOS,
		"arch":       runtime.GOARCH,
	}
}
