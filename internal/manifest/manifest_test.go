package manifest_test

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/adriankarlen/storyquery/internal/cache"
	"github.com/adriankarlen/storyquery/internal/manifest"
)

func readFixture(t *testing.T, name string) []byte {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("..", "..", "testdata", name))
	if err != nil {
		t.Fatalf("read fixture %s: %v", name, err)
	}
	return data
}

func TestParseComponents(t *testing.T) {
	c, err := manifest.ParseComponents(readFixture(t, "components.json"))
	if err != nil {
		t.Fatalf("ParseComponents: %v", err)
	}
	mb, ok := c.Components["components-buttons-mainbutton"]
	if !ok {
		t.Fatal("expected MainButton component")
	}
	if mb.Name != "MainButton" {
		t.Errorf("name = %q, want MainButton", mb.Name)
	}
	if len(mb.ReactDocgenTypeScript.Props) == 0 {
		t.Error("expected props to be parsed")
	}
	if mb.Import == "" {
		t.Error("expected import statement")
	}
}

func TestParseDocs(t *testing.T) {
	d, err := manifest.ParseDocs(readFixture(t, "docs.json"))
	if err != nil {
		t.Fatalf("ParseDocs: %v", err)
	}
	if _, ok := d.Docs["developers-getting-started--docs"]; !ok {
		t.Error("expected getting-started doc")
	}
}

func TestParseComponentsInvalid(t *testing.T) {
	if _, err := manifest.ParseComponents([]byte("{not json")); err == nil {
		t.Fatal("expected error for invalid json")
	}
}

func TestVersionMismatch(t *testing.T) {
	c, err := manifest.ParseComponents([]byte(`{"v":99,"components":{}}`))
	if err != nil {
		t.Fatal(err)
	}
	if !c.VersionMismatch() {
		t.Error("expected version mismatch for v99")
	}
}

func TestGuidelineFor(t *testing.T) {
	comps, _ := manifest.ParseComponents(readFixture(t, "components.json"))
	docs, _ := manifest.ParseDocs(readFixture(t, "docs.json"))

	alert := comps.Components["components-alert"]
	g, ok := manifest.GuidelineFor(docs, alert)
	if !ok {
		t.Fatal("expected guideline for Alert")
	}
	if g.ID != "components-alert-guidelines-usage--docs" {
		t.Errorf("guideline id = %q", g.ID)
	}

	mb := comps.Components["components-buttons-mainbutton"]
	if _, ok := manifest.GuidelineFor(docs, mb); ok {
		t.Error("did not expect a guideline for MainButton in fixture")
	}
}

// fakeFetcher serves canned bytes per URL and counts calls. It is safe for
// concurrent use because Load fetches manifests in parallel.
type fakeFetcher struct {
	data    map[string][]byte
	err     error
	callCnt atomic.Int64
}

func (f *fakeFetcher) Fetch(_ context.Context, url string) ([]byte, error) {
	f.callCnt.Add(1)
	if f.err != nil {
		return nil, f.err
	}
	d, ok := f.data[url]
	if !ok {
		return nil, errors.New("not found: " + url)
	}
	return d, nil
}

func (f *fakeFetcher) calls() int64 { return f.callCnt.Load() }

func newTestService(t *testing.T, f *fakeFetcher, refresh bool) (*manifest.Service, *cache.Cache) {
	t.Helper()
	c, err := cache.New(t.TempDir())
	if err != nil {
		t.Fatalf("cache.New: %v", err)
	}
	svc := manifest.NewService(
		manifest.WithFetcher(f),
		manifest.WithCache(c),
		manifest.WithTTL(time.Hour),
		manifest.WithRefresh(refresh),
		manifest.WithURLs("http://x/components.json", "http://x/docs.json"),
	)
	return svc, c
}

func TestServiceLoadAndCache(t *testing.T) {
	f := &fakeFetcher{data: map[string][]byte{
		"http://x/components.json": readFixture(t, "components.json"),
		"http://x/docs.json":       readFixture(t, "docs.json"),
	}}
	svc, _ := newTestService(t, f, false)

	b, err := svc.Load(context.Background())
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if _, ok := b.Components.Components["components-buttons-mainbutton"]; !ok {
		t.Error("expected MainButton after load")
	}
	if f.calls() != 2 {
		t.Errorf("expected 2 fetches, got %d", f.calls())
	}

	// Second load should be served from cache (no new fetches).
	if _, err := svc.Load(context.Background()); err != nil {
		t.Fatalf("second Load: %v", err)
	}
	if f.calls() != 2 {
		t.Errorf("expected cache hit (still 2 fetches), got %d", f.calls())
	}
}

func TestServiceStaleFallback(t *testing.T) {
	good := map[string][]byte{
		"http://x/components.json": readFixture(t, "components.json"),
		"http://x/docs.json":       readFixture(t, "docs.json"),
	}
	f := &fakeFetcher{data: good}
	// Prime the cache with refresh so entries exist.
	svc, c := newTestService(t, f, true)
	if _, err := svc.Load(context.Background()); err != nil {
		t.Fatalf("prime Load: %v", err)
	}

	// New service with a failing fetcher but forced refresh -> must fall back to stale cache.
	failing := &fakeFetcher{err: errors.New("network down")}
	staleSvc := manifest.NewService(
		manifest.WithFetcher(failing),
		manifest.WithCache(c),
		manifest.WithTTL(time.Hour),
		manifest.WithRefresh(true),
		manifest.WithURLs("http://x/components.json", "http://x/docs.json"),
	)
	b, err := staleSvc.Load(context.Background())
	if err != nil {
		t.Fatalf("expected stale fallback, got error: %v", err)
	}
	if len(b.Warnings) == 0 {
		t.Error("expected stale-cache warning")
	}
}

func TestServiceFetchErrorNoCache(t *testing.T) {
	failing := &fakeFetcher{err: errors.New("boom")}
	svc := manifest.NewService(
		manifest.WithFetcher(failing),
		manifest.WithURLs("http://x/components.json", "http://x/docs.json"),
	)
	if _, err := svc.Load(context.Background()); err == nil {
		t.Fatal("expected error when fetch fails and no cache")
	}
}
