package search

import (
	"sort"
	"strings"

	"github.com/adriankarlen/storyquery/internal/manifest"
)

// Score tiers. Higher is a better match.
const (
	scoreExactName  = 1000
	scoreExactID    = 900
	scoreNamePrefix = 700
	scoreIDSubstr   = 500
	scoreNameSubstr = 450
	scoreFuzzy      = 100 // base; fuzzy adds a density bonus on top
	scoreNoMatch    = 0
)

// ComponentMatch pairs a component with its relevance score.
type ComponentMatch struct {
	Component manifest.Component
	Score     int
}

// DocMatch pairs a doc with its relevance score.
type DocMatch struct {
	Doc   manifest.Doc
	Score int
}

// Components ranks all components against term, returning matches with a
// positive score sorted best-first. limit <= 0 returns all matches.
func Components(comps map[string]manifest.Component, term string, limit int) []ComponentMatch {
	q := strings.ToLower(strings.TrimSpace(term))
	out := make([]ComponentMatch, 0, len(comps))
	for _, c := range comps {
		if s := scoreComponent(c, q); s > scoreNoMatch {
			out = append(out, ComponentMatch{Component: c, Score: s})
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Score != out[j].Score {
			return out[i].Score > out[j].Score
		}
		return out[i].Component.Name < out[j].Component.Name
	})
	return capComponents(out, limit)
}

// Docs ranks all docs against term, matching on title, name, id, and content.
func Docs(docs map[string]manifest.Doc, term string, limit int) []DocMatch {
	q := strings.ToLower(strings.TrimSpace(term))
	out := make([]DocMatch, 0, len(docs))
	for _, d := range docs {
		if s := scoreDoc(d, q); s > scoreNoMatch {
			out = append(out, DocMatch{Doc: d, Score: s})
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Score != out[j].Score {
			return out[i].Score > out[j].Score
		}
		return out[i].Doc.Title < out[j].Doc.Title
	})
	return capDocs(out, limit)
}

// BestComponent resolves term to a single best component. It returns the match,
// whether exactly one clear winner exists, and whether multiple top matches tie
// (ambiguous). A direct id or exact name always wins outright.
func BestComponent(comps map[string]manifest.Component, term string) (ComponentMatch, bool, bool) {
	matches := Components(comps, term, 0)
	if len(matches) == 0 {
		return ComponentMatch{}, false, false
	}
	if len(matches) == 1 {
		return matches[0], true, false
	}
	// A unique top score is a clear winner.
	if matches[0].Score > matches[1].Score {
		return matches[0], true, false
	}
	return matches[0], false, true
}

func scoreComponent(c manifest.Component, q string) int {
	if q == "" {
		return scoreNoMatch
	}
	name := strings.ToLower(c.Name)
	id := strings.ToLower(c.ID)

	switch {
	case name == q:
		return scoreExactName
	case id == q:
		return scoreExactID
	case strings.HasPrefix(name, q):
		return scoreNamePrefix
	case strings.Contains(id, q):
		return scoreIDSubstr
	case strings.Contains(name, q):
		return scoreNameSubstr
	}
	if b, ok := fuzzyScore(name, q); ok {
		return scoreFuzzy + b
	}
	if b, ok := fuzzyScore(id, q); ok {
		return scoreFuzzy + b
	}
	return scoreNoMatch
}

func scoreDoc(d manifest.Doc, q string) int {
	if q == "" {
		return scoreNoMatch
	}
	title := strings.ToLower(d.Title)
	name := strings.ToLower(d.Name)
	id := strings.ToLower(d.ID)

	switch {
	case title == q || name == q:
		return scoreExactName
	case id == q:
		return scoreExactID
	case strings.HasPrefix(title, q):
		return scoreNamePrefix
	case strings.Contains(id, q):
		return scoreIDSubstr
	case strings.Contains(title, q) || strings.Contains(name, q):
		return scoreNameSubstr
	}
	if b, ok := fuzzyScore(title, q); ok {
		return scoreFuzzy + b
	}
	// Content match is the weakest signal.
	if strings.Contains(strings.ToLower(d.Content), q) {
		return scoreFuzzy / 2
	}
	return scoreNoMatch
}

// fuzzyScore reports whether q is a subsequence of s and, if so, a density
// bonus that rewards tightly-packed matches over scattered ones.
func fuzzyScore(s, q string) (int, bool) {
	if q == "" {
		return 0, false
	}
	si, qi := 0, 0
	first, last := -1, -1
	sr := []rune(s)
	qr := []rune(q)
	for si < len(sr) && qi < len(qr) {
		if sr[si] == qr[qi] {
			if first < 0 {
				first = si
			}
			last = si
			qi++
		}
		si++
	}
	if qi != len(qr) {
		return 0, false
	}
	span := last - first + 1
	if span <= 0 {
		span = 1
	}
	// Higher bonus when the matched runes are densely packed.
	bonus := (len(qr) * 50) / span
	return bonus, true
}

func capComponents(in []ComponentMatch, limit int) []ComponentMatch {
	if limit > 0 && len(in) > limit {
		return in[:limit]
	}
	return in
}

func capDocs(in []DocMatch, limit int) []DocMatch {
	if limit > 0 && len(in) > limit {
		return in[:limit]
	}
	return in
}
