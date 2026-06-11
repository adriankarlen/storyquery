// Package fetch provides an HTTP fetcher for retrieving manifest bytes.
//
// The Fetcher interface is intentionally minimal so that callers can inject
// fakes in tests without touching the network.
package fetch

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ErrHTTPStatus is returned when a fetch receives a non-2xx HTTP response.
type ErrHTTPStatus struct {
	URL    string
	Status int
}

func (e *ErrHTTPStatus) Error() string {
	return fmt.Sprintf("fetch %s: unexpected status %d", e.URL, e.Status)
}

// Fetcher retrieves the raw bytes located at a URL.
type Fetcher interface {
	Fetch(ctx context.Context, url string) ([]byte, error)
}

// httpFetcher is the default Fetcher backed by net/http.
type httpFetcher struct {
	client *http.Client
	// maxBytes caps the response size to avoid unbounded memory use.
	maxBytes int64
}

var _ Fetcher = (*httpFetcher)(nil)

// Option configures the httpFetcher.
type Option func(*httpFetcher)

// WithClient sets a custom *http.Client.
func WithClient(c *http.Client) Option {
	return func(f *httpFetcher) { f.client = c }
}

// WithMaxBytes caps the number of bytes read from a response body.
func WithMaxBytes(n int64) Option {
	return func(f *httpFetcher) { f.maxBytes = n }
}

// New returns the default HTTP-backed Fetcher.
func New(opts ...Option) Fetcher {
	f := &httpFetcher{
		client:   &http.Client{Timeout: 30 * time.Second},
		maxBytes: 64 << 20, // 64 MiB
	}
	for _, opt := range opts {
		opt(f)
	}
	return f
}

// Fetch performs a GET request and returns the response body.
func (f *httpFetcher) Fetch(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build request for %s: %w", url, err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "storyquery")

	resp, err := f.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("get %s: %w", url, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &ErrHTTPStatus{URL: url, Status: resp.StatusCode}
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, f.maxBytes))
	if err != nil {
		return nil, fmt.Errorf("read body from %s: %w", url, err)
	}
	return body, nil
}
