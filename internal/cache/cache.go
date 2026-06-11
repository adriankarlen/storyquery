// Package cache provides a small TTL-based disk cache for manifest bytes.
//
// Entries are keyed by an opaque string (typically derived from the source
// URL). Each entry stores the raw payload plus a sidecar metadata file holding
// the fetch timestamp, enabling both TTL checks and stale-fallback reads.
package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// Store loads and saves cached payloads.
type Store interface {
	// Load returns the cached payload for key. The fresh return value reports
	// whether the entry is within ttl. A missing entry returns ok=false.
	Load(ctx context.Context, key string, ttl time.Duration) (data []byte, fresh, ok bool, err error)
	// Save writes data for key, stamping it with the current time.
	Save(ctx context.Context, key string, data []byte) error
}

// Cache is a filesystem-backed Store rooted at a directory.
type Cache struct {
	dir string
	now func() time.Time
}

var _ Store = (*Cache)(nil)

// Option configures a Cache.
type Option func(*Cache)

// WithClock overrides the time source (used in tests).
func WithClock(now func() time.Time) Option {
	return func(c *Cache) { c.now = now }
}

// New returns a Cache rooted at dir, creating the directory if needed.
func New(dir string, opts ...Option) (*Cache, error) {
	c := &Cache{dir: dir, now: time.Now}
	for _, opt := range opts {
		opt(c)
	}
	if err := os.MkdirAll(c.dir, 0o755); err != nil {
		return nil, fmt.Errorf("create cache dir %s: %w", dir, err)
	}
	return c, nil
}

// Key derives a stable, filesystem-safe cache key from arbitrary parts.
func Key(parts ...string) string {
	h := sha256.New()
	for _, p := range parts {
		_, _ = h.Write([]byte(p))
		_, _ = h.Write([]byte{0})
	}
	return hex.EncodeToString(h.Sum(nil))[:32]
}

type meta struct {
	FetchedAt time.Time `json:"fetched_at"`
}

func (c *Cache) dataPath(key string) string { return filepath.Join(c.dir, key+".data") }
func (c *Cache) metaPath(key string) string { return filepath.Join(c.dir, key+".meta.json") }

// Load implements Store.
func (c *Cache) Load(ctx context.Context, key string, ttl time.Duration) ([]byte, bool, bool, error) {
	if err := ctx.Err(); err != nil {
		return nil, false, false, err
	}

	data, err := os.ReadFile(c.dataPath(key))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, false, false, nil
		}
		return nil, false, false, fmt.Errorf("read cache data: %w", err)
	}

	fresh := false
	if mb, err := os.ReadFile(c.metaPath(key)); err == nil {
		var m meta
		if json.Unmarshal(mb, &m) == nil {
			fresh = c.now().Sub(m.FetchedAt) < ttl
		}
	}
	return data, fresh, true, nil
}

// Save implements Store.
func (c *Cache) Save(ctx context.Context, key string, data []byte) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := os.WriteFile(c.dataPath(key), data, 0o644); err != nil {
		return fmt.Errorf("write cache data: %w", err)
	}
	mb, err := json.Marshal(meta{FetchedAt: c.now()})
	if err != nil {
		return fmt.Errorf("marshal cache meta: %w", err)
	}
	if err := os.WriteFile(c.metaPath(key), mb, 0o644); err != nil {
		return fmt.Errorf("write cache meta: %w", err)
	}
	return nil
}
