package cache_test

import (
	"context"
	"testing"
	"time"

	"github.com/adriankarlen/storyquery/internal/cache"
)

func TestSaveLoadFresh(t *testing.T) {
	c, err := cache.New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	key := cache.Key("http://x/components.json")

	if err := c.Save(ctx, key, []byte("payload")); err != nil {
		t.Fatal(err)
	}
	data, fresh, ok, err := c.Load(ctx, key, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if !ok || !fresh {
		t.Fatalf("ok=%v fresh=%v, want both true", ok, fresh)
	}
	if string(data) != "payload" {
		t.Errorf("data = %q", data)
	}
}

func TestLoadMissing(t *testing.T) {
	c, err := cache.New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	_, _, ok, err := c.Load(context.Background(), cache.Key("missing"), time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Error("expected ok=false for missing entry")
	}
}

func TestLoadStale(t *testing.T) {
	now := time.Now()
	clock := func() time.Time { return now }
	c, err := cache.New(t.TempDir(), cache.WithClock(clock))
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	key := cache.Key("k")
	if err := c.Save(ctx, key, []byte("v")); err != nil {
		t.Fatal(err)
	}
	// Advance the clock beyond the TTL.
	now = now.Add(2 * time.Hour)
	data, fresh, ok, err := c.Load(ctx, key, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("expected entry to still exist (stale)")
	}
	if fresh {
		t.Error("expected entry to be stale")
	}
	if string(data) != "v" {
		t.Errorf("data = %q", data)
	}
}

func TestKeyStable(t *testing.T) {
	a := cache.Key("http://x", "components")
	b := cache.Key("http://x", "components")
	if a != b {
		t.Error("keys should be deterministic")
	}
	if a == cache.Key("http://x", "docs") {
		t.Error("different inputs should produce different keys")
	}
}
