package fetch_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/adriankarlen/storyquery/internal/fetch"
)

func TestFetchSuccess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()

	got, err := fetch.New().Fetch(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if string(got) != `{"ok":true}` {
		t.Errorf("body = %q", got)
	}
}

func TestFetchHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	_, err := fetch.New().Fetch(context.Background(), srv.URL)
	var statusErr *fetch.ErrHTTPStatus
	if !errors.As(err, &statusErr) {
		t.Fatalf("expected ErrHTTPStatus, got %v", err)
	}
	if statusErr.Status != http.StatusNotFound {
		t.Errorf("status = %d", statusErr.Status)
	}
}

func TestFetchContextCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := fetch.New().Fetch(ctx, "http://example.invalid")
	if err == nil {
		t.Fatal("expected error for cancelled context")
	}
}

func TestFetchMaxBytes(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("0123456789"))
	}))
	defer srv.Close()

	got, err := fetch.New(fetch.WithMaxBytes(4)).Fetch(context.Background(), srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "0123" {
		t.Errorf("expected truncated body, got %q", got)
	}
}
