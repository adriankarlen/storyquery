// Package config resolves the storyquery runtime configuration from, in order
// of precedence: command-line flag, environment variable, a project-local file
// (./.storyquery.json), and a global file (<UserConfigDir>/storyquery/config.json).
package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// EnvURL is the environment variable holding the Storybook base URL.
const EnvURL = "SQ_URL"

// ProjectFile is the project-local config filename.
const ProjectFile = ".storyquery.json"

// DefaultTTL is the cache time-to-live used when none is configured.
const DefaultTTL = time.Hour

// ErrNoURL indicates that no base URL could be resolved from any source.
var ErrNoURL = errors.New("no storybook url configured: pass --url, set SQ_URL, or add a config file")

// Config is the resolved runtime configuration.
type Config struct {
	BaseURL  string
	CacheTTL time.Duration
}

// file is the on-disk JSON representation.
type file struct {
	URL      string `json:"url"`
	CacheTTL string `json:"cacheTTL"`
}

// Resolve produces a Config from the flag value (may be empty), the
// environment, and config files. flagURL takes highest precedence.
func Resolve(flagURL string) (*Config, error) {
	cfg := &Config{CacheTTL: DefaultTTL}

	// Lowest precedence first; later assignments win.
	if global, ok := loadFile(globalPath()); ok {
		applyFile(cfg, global)
	}
	if project, ok := loadFile(ProjectFile); ok {
		applyFile(cfg, project)
	}
	if env := strings.TrimSpace(os.Getenv(EnvURL)); env != "" {
		cfg.BaseURL = env
	}
	if f := strings.TrimSpace(flagURL); f != "" {
		cfg.BaseURL = f
	}

	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	if cfg.BaseURL == "" {
		return nil, ErrNoURL
	}
	return cfg, nil
}

// ComponentsURL returns the absolute URL of the components manifest.
func (c *Config) ComponentsURL() string { return c.BaseURL + "/manifests/components.json" }

// DocsURL returns the absolute URL of the docs manifest.
func (c *Config) DocsURL() string { return c.BaseURL + "/manifests/docs.json" }

func applyFile(cfg *Config, f file) {
	if v := strings.TrimSpace(f.URL); v != "" {
		cfg.BaseURL = v
	}
	if v := strings.TrimSpace(f.CacheTTL); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.CacheTTL = d
		}
	}
}

func loadFile(path string) (file, bool) {
	if path == "" {
		return file{}, false
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return file{}, false
	}
	var f file
	if err := json.Unmarshal(data, &f); err != nil {
		return file{}, false
	}
	return f, true
}

func globalPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, "storyquery", "config.json")
}

// CacheDir returns the directory used for the manifest cache.
func CacheDir() (string, error) {
	dir, err := os.UserCacheDir()
	if err != nil {
		return "", fmt.Errorf("resolve user cache dir: %w", err)
	}
	return filepath.Join(dir, "storyquery"), nil
}
