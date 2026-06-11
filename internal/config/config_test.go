package config_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/adriankarlen/storyquery/internal/config"
)

func TestResolvePrecedence(t *testing.T) {
	// Work in an isolated dir so the project file is controlled.
	dir := t.TempDir()
	chdir(t, dir)

	if err := os.WriteFile(config.ProjectFile, []byte(`{"url":"https://project.example","cacheTTL":"2h"}`), 0o644); err != nil {
		t.Fatal(err)
	}

	t.Run("project file used when no env/flag", func(t *testing.T) {
		t.Setenv(config.EnvURL, "")
		cfg, err := config.Resolve("")
		if err != nil {
			t.Fatal(err)
		}
		if cfg.BaseURL != "https://project.example" {
			t.Errorf("url = %q", cfg.BaseURL)
		}
		if cfg.CacheTTL != 2*time.Hour {
			t.Errorf("ttl = %v", cfg.CacheTTL)
		}
	})

	t.Run("env overrides project", func(t *testing.T) {
		t.Setenv(config.EnvURL, "https://env.example")
		cfg, err := config.Resolve("")
		if err != nil {
			t.Fatal(err)
		}
		if cfg.BaseURL != "https://env.example" {
			t.Errorf("url = %q", cfg.BaseURL)
		}
	})

	t.Run("flag overrides env", func(t *testing.T) {
		t.Setenv(config.EnvURL, "https://env.example")
		cfg, err := config.Resolve("https://flag.example/")
		if err != nil {
			t.Fatal(err)
		}
		if cfg.BaseURL != "https://flag.example" { // trailing slash trimmed
			t.Errorf("url = %q", cfg.BaseURL)
		}
	})
}

func TestResolveNoURL(t *testing.T) {
	chdir(t, t.TempDir())
	t.Setenv(config.EnvURL, "")
	// Point HOME/config dirs at an empty temp dir so no global config leaks in.
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("HOME", t.TempDir())
	_, err := config.Resolve("")
	if !errors.Is(err, config.ErrNoURL) {
		t.Fatalf("expected ErrNoURL, got %v", err)
	}
}

func TestManifestURLs(t *testing.T) {
	cfg := &config.Config{BaseURL: "https://x.example"}
	if got := cfg.ComponentsURL(); got != "https://x.example/manifests/components.json" {
		t.Errorf("components url = %q", got)
	}
	if got := cfg.DocsURL(); got != "https://x.example/manifests/docs.json" {
		t.Errorf("docs url = %q", got)
	}
}

func chdir(t *testing.T, dir string) {
	t.Helper()
	prev, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(prev) })
	// Ensure relative ProjectFile resolves under dir.
	_ = filepath.Join(dir, config.ProjectFile)
}
