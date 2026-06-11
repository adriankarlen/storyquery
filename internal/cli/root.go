// Package cli wires the storyquery cobra command tree and maps domain errors to
// process exit codes.
package cli

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"time"

	"github.com/spf13/cobra"

	"github.com/adriankarlen/storyquery/internal/cache"
	"github.com/adriankarlen/storyquery/internal/config"
	"github.com/adriankarlen/storyquery/internal/fetch"
	"github.com/adriankarlen/storyquery/internal/manifest"
	"github.com/adriankarlen/storyquery/internal/output"
	"github.com/adriankarlen/storyquery/internal/version"
)

// Exit codes returned by the CLI.
const (
	ExitOK      = 0
	ExitNoMatch = 1
	ExitUsage   = 2
	ExitNetwork = 3
	ExitError   = 1
)

// globalFlags holds flags shared by all subcommands.
type globalFlags struct {
	url     string
	refresh bool
	noCache bool
	format  string
}

// Execute builds and runs the root command, returning a process exit code.
func Execute(ctx context.Context) int {
	gf := &globalFlags{}
	root := &cobra.Command{
		Use:           "storyquery",
		Short:         "Query a Storybook design-system manifest",
		Long:          "storyquery fetches a Storybook instance's manifest files and answers agent-friendly queries about components and documentation.",
		SilenceUsage:  true,
		SilenceErrors: true,
		Version:       version.Version,
	}

	pf := root.PersistentFlags()
	pf.StringVar(&gf.url, "url", "", "Storybook base URL (overrides SQ_URL and config files)")
	pf.BoolVar(&gf.refresh, "refresh", false, "force a fresh fetch, ignoring cached manifests")
	pf.BoolVar(&gf.noCache, "no-cache", false, "bypass the cache entirely")
	pf.StringVar(&gf.format, "format", "json", "output format: json or text")

	root.AddCommand(
		newQueryCmd(gf),
		newShowCmd(gf),
		newListCmd(gf),
		newDocsCmd(gf),
	)

	if err := root.ExecuteContext(ctx); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return exitCode(err)
	}
	return ExitOK
}

// exitCode maps an error to a process exit code.
func exitCode(err error) int {
	switch {
	case err == nil:
		return ExitOK
	case errors.Is(err, manifest.ErrNotFound):
		return ExitNoMatch
	case errors.Is(err, config.ErrNoURL):
		return ExitUsage
	case isNetwork(err):
		return ExitNetwork
	default:
		return ExitError
	}
}

func isNetwork(err error) bool {
	var httpErr *fetch.ErrHTTPStatus
	if errors.As(err, &httpErr) {
		return true
	}
	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		return true
	}
	var netErr net.Error
	return errors.As(err, &netErr)
}

// resolveFormat parses the --format flag.
func resolveFormat(gf *globalFlags) (output.Format, error) {
	f, err := output.ParseFormat(gf.format)
	if err != nil {
		return "", err
	}
	return f, nil
}

// loadBundle resolves config, builds the manifest service, and loads both
// manifests. It is shared by every subcommand.
func loadBundle(ctx context.Context, gf *globalFlags) (*manifest.Bundle, error) {
	cfg, err := config.Resolve(gf.url)
	if err != nil {
		return nil, err
	}

	opts := []manifest.Option{
		manifest.WithFetcher(fetch.New()),
		manifest.WithURLs(cfg.ComponentsURL(), cfg.DocsURL()),
		manifest.WithTTL(cfg.CacheTTL),
		manifest.WithRefresh(gf.refresh),
	}

	if !gf.noCache {
		dir, err := config.CacheDir()
		if err != nil {
			return nil, err
		}
		store, err := cache.New(dir)
		if err != nil {
			return nil, err
		}
		opts = append(opts, manifest.WithCache(store))
	}

	svc := manifest.NewService(opts...)

	// Bound the overall load so a hung server cannot block forever.
	loadCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	return svc.Load(loadCtx)
}
