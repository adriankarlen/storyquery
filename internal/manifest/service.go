package manifest

import (
	"context"
	"errors"
	"fmt"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/adriankarlen/storyquery/internal/cache"
	"github.com/adriankarlen/storyquery/internal/fetch"
)

// Sentinel errors returned by the Service and consumers.
var (
	// ErrNotFound indicates a query matched no component or doc.
	ErrNotFound = errors.New("no match found")
	// ErrAmbiguous indicates a lookup expecting a single result matched many.
	ErrAmbiguous = errors.New("ambiguous match")
)

// Bundle holds both parsed manifests together with version warnings.
type Bundle struct {
	Components *Components
	Docs       *Docs
	// Warnings holds non-fatal messages (e.g. schema version mismatch, stale cache).
	Warnings []string
}

// Service fetches, caches, and parses the manifest bundle.
type Service struct {
	fetcher  fetch.Fetcher
	store    cache.Store
	ttl      time.Duration
	refresh  bool
	useCache bool
	compURL  string
	docsURL  string
}

// Option configures a Service.
type Option func(*Service)

// WithFetcher sets the Fetcher used to retrieve manifests.
func WithFetcher(f fetch.Fetcher) Option { return func(s *Service) { s.fetcher = f } }

// WithCache sets the cache Store and enables caching.
func WithCache(c cache.Store) Option {
	return func(s *Service) {
		s.store = c
		s.useCache = true
	}
}

// WithTTL sets the cache freshness window.
func WithTTL(d time.Duration) Option { return func(s *Service) { s.ttl = d } }

// WithRefresh forces a network refetch, ignoring fresh cache entries.
func WithRefresh(refresh bool) Option { return func(s *Service) { s.refresh = refresh } }

// WithURLs sets the components and docs manifest URLs.
func WithURLs(componentsURL, docsURL string) Option {
	return func(s *Service) {
		s.compURL = componentsURL
		s.docsURL = docsURL
	}
}

// NewService builds a Service. A Fetcher and URLs are required; a cache is
// optional (omit WithCache to always fetch fresh).
func NewService(opts ...Option) *Service {
	s := &Service{
		fetcher: fetch.New(),
		ttl:     time.Hour,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Load fetches and parses both manifests, fetching them concurrently.
func (s *Service) Load(ctx context.Context) (*Bundle, error) {
	var (
		compData []byte
		docsData []byte
		compWarn []string
		docsWarn []string
	)

	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		data, warn, err := s.loadOne(gctx, "components", s.compURL)
		if err != nil {
			return err
		}
		compData = data
		compWarn = warn
		return nil
	})
	g.Go(func() error {
		data, warn, err := s.loadOne(gctx, "docs", s.docsURL)
		if err != nil {
			return err
		}
		docsData = data
		docsWarn = warn
		return nil
	})
	if err := g.Wait(); err != nil {
		return nil, err
	}

	// Combine warnings only after both goroutines have completed.
	warnings := make([]string, 0, len(compWarn)+len(docsWarn))
	warnings = append(warnings, compWarn...)
	warnings = append(warnings, docsWarn...)

	comps, err := ParseComponents(compData)
	if err != nil {
		return nil, err
	}
	docs, err := ParseDocs(docsData)
	if err != nil {
		return nil, err
	}
	if comps.VersionMismatch() {
		warnings = append(warnings, fmt.Sprintf("components manifest schema v%d differs from supported v%d", comps.V, SchemaVersion))
	}
	if docs.VersionMismatch() {
		warnings = append(warnings, fmt.Sprintf("docs manifest schema v%d differs from supported v%d", docs.V, SchemaVersion))
	}

	return &Bundle{Components: comps, Docs: docs, Warnings: warnings}, nil
}

// loadOne resolves a single manifest, using the cache when enabled and falling
// back to a stale cache entry if the network fetch fails.
func (s *Service) loadOne(ctx context.Context, label, url string) ([]byte, []string, error) {
	if url == "" {
		return nil, nil, fmt.Errorf("%s manifest url not configured", label)
	}

	var warnings []string
	var cacheKey string
	if s.useCache && s.store != nil {
		cacheKey = cache.Key(url)
		data, fresh, ok, err := s.store.Load(ctx, cacheKey, s.ttl)
		if err == nil && ok && fresh && !s.refresh {
			return data, warnings, nil
		}

		// Need to fetch; keep any stale copy for fallback.
		fetched, ferr := s.fetcher.Fetch(ctx, url)
		if ferr != nil {
			if ok {
				warnings = append(warnings, fmt.Sprintf("using stale cached %s manifest: %v", label, ferr))
				return data, warnings, nil
			}
			return nil, nil, fmt.Errorf("fetch %s manifest: %w", label, ferr)
		}
		if serr := s.store.Save(ctx, cacheKey, fetched); serr != nil {
			warnings = append(warnings, fmt.Sprintf("failed to cache %s manifest: %v", label, serr))
		}
		return fetched, warnings, nil
	}

	fetched, err := s.fetcher.Fetch(ctx, url)
	if err != nil {
		return nil, nil, fmt.Errorf("fetch %s manifest: %w", label, err)
	}
	return fetched, warnings, nil
}
