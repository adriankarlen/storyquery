package search_test

import (
	"testing"

	"github.com/adriankarlen/storyquery/internal/manifest"
	"github.com/adriankarlen/storyquery/internal/search"
)

func sampleComponents() map[string]manifest.Component {
	return map[string]manifest.Component{
		"components-buttons-mainbutton": {
			ID: "components-buttons-mainbutton", Name: "MainButton",
		},
		"components-buttons-navigationbutton": {
			ID: "components-buttons-navigationbutton", Name: "NavigationButton",
		},
		"components-alert": {ID: "components-alert", Name: "Alert"},
	}
}

func TestComponentsRanking(t *testing.T) {
	comps := sampleComponents()
	tests := []struct {
		name   string
		term   string
		wantID string // expected top match id, "" = no match
	}{
		{"exact name", "MainButton", "components-buttons-mainbutton"},
		{"exact name lowercase", "mainbutton", "components-buttons-mainbutton"},
		{"exact id", "components-alert", "components-alert"},
		{"name prefix", "Main", "components-buttons-mainbutton"},
		{"id substring", "buttons", "components-buttons-mainbutton"},
		{"fuzzy", "navbtn", "components-buttons-navigationbutton"},
		{"no match", "zzzzz", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := search.Components(comps, tt.term, 0)
			if tt.wantID == "" {
				if len(got) != 0 {
					t.Fatalf("expected no matches, got %d", len(got))
				}
				return
			}
			if len(got) == 0 {
				t.Fatalf("expected a match for %q", tt.term)
			}
			if got[0].Component.ID != tt.wantID {
				t.Errorf("top match = %q, want %q", got[0].Component.ID, tt.wantID)
			}
		})
	}
}

func TestComponentsLimit(t *testing.T) {
	comps := sampleComponents()
	got := search.Components(comps, "button", 1)
	if len(got) != 1 {
		t.Errorf("limit 1: got %d", len(got))
	}
}

func TestBestComponent(t *testing.T) {
	comps := sampleComponents()

	m, ok, ambiguous := search.BestComponent(comps, "MainButton")
	if !ok || ambiguous {
		t.Fatalf("exact name: ok=%v ambiguous=%v", ok, ambiguous)
	}
	if m.Component.ID != "components-buttons-mainbutton" {
		t.Errorf("got %q", m.Component.ID)
	}

	if _, ok, _ := search.BestComponent(comps, "zzzz"); ok {
		t.Error("expected no match")
	}
}

func TestDocsRanking(t *testing.T) {
	docs := map[string]manifest.Doc{
		"developers-getting-started--docs":        {ID: "developers-getting-started--docs", Title: "Developers/Getting started", Name: "Docs"},
		"components-alert-guidelines-usage--docs": {ID: "components-alert-guidelines-usage--docs", Title: "Components/Alert/Guidelines/Usage", Content: "use alerts sparingly"},
	}
	got := search.Docs(docs, "alert", 0)
	if len(got) == 0 || got[0].Doc.ID != "components-alert-guidelines-usage--docs" {
		t.Fatalf("expected alert guideline top match, got %+v", got)
	}

	// Content-only match.
	got = search.Docs(docs, "sparingly", 0)
	if len(got) != 1 {
		t.Errorf("expected 1 content match, got %d", len(got))
	}
}

func FuzzComponentsQuery(f *testing.F) {
	comps := sampleComponents()
	for _, seed := range []string{"MainButton", "", "btn", "components-alert", "界"} {
		f.Add(seed)
	}
	f.Fuzz(func(t *testing.T, term string) {
		// Must never panic and must return a sorted, non-increasing score list.
		got := search.Components(comps, term, 0)
		for i := 1; i < len(got); i++ {
			if got[i-1].Score < got[i].Score {
				t.Fatalf("scores not sorted descending: %d < %d", got[i-1].Score, got[i].Score)
			}
		}
	})
}
