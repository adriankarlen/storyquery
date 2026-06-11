package output

import (
	"fmt"
	"io"
	"sort"
	"strings"
)

func sortProps(p []PropDetail) {
	sort.SliceStable(p, func(i, j int) bool { return p[i].Name < p[j].Name })
}

// ew is an error-tracking writer: it records the first write error and turns
// every subsequent Printf into a no-op, so callers can write many lines and
// check err once at the end.
type ew struct {
	w   io.Writer
	err error
}

func (e *ew) printf(format string, args ...any) {
	if e.err != nil {
		return
	}
	_, e.err = fmt.Fprintf(e.w, format, args...)
}

// encodeText renders a human-friendly representation for known view models.
func encodeText(w io.Writer, v any) error {
	e := &ew{w: w}
	switch r := v.(type) {
	case QueryResult:
		writeQuery(e, r)
	case ListResult:
		writeList(e, r)
	case ComponentDetail:
		writeDetail(e, r)
	case DocsResult:
		writeDocs(e, r)
	default:
		// Fall back to JSON for anything without a text renderer.
		return encodeJSON(w, v)
	}
	return e.err
}

func writeWarnings(e *ew, warnings []string) {
	for _, msg := range warnings {
		e.printf("! %s\n", msg)
	}
}

func writeQuery(e *ew, r QueryResult) {
	writeWarnings(e, r.Warnings)
	e.printf("Query: %s\n", r.Term)
	e.printf("\nComponents (%d):\n", len(r.Components))
	for _, c := range r.Components {
		e.printf("  %-28s %s\n", c.Name, c.ID)
		if c.Description != "" {
			e.printf("      %s\n", firstLine(c.Description))
		}
	}
	e.printf("\nDocs (%d):\n", len(r.Docs))
	for _, d := range r.Docs {
		e.printf("  %-28s %s\n", d.Title, d.ID)
	}
}

func writeList(e *ew, r ListResult) {
	writeWarnings(e, r.Warnings)
	for _, c := range r.Components {
		e.printf("%-32s %s\n", c.Name, c.ID)
	}
}

func writeDetail(e *ew, d ComponentDetail) {
	writeWarnings(e, d.Warnings)
	e.printf("%s (%s)\n", d.Name, d.ID)
	if d.Description != "" {
		e.printf("\n%s\n", d.Description)
	}
	if len(d.Tags) > 0 {
		e.printf("\nTags:\n")
		for k, v := range d.Tags {
			e.printf("  @%s %s\n", k, firstLine(v))
		}
	}
	if d.Import != "" {
		e.printf("\nImport:\n  %s\n", d.Import)
	}
	if d.SourceFile != "" {
		e.printf("Source: %s\n", d.SourceFile)
	}
	e.printf("\nProps (%d):\n", len(d.Props))
	for _, p := range d.Props {
		req := ""
		if p.Required {
			req = " (required)"
		}
		def := ""
		if p.Default != "" {
			def = fmt.Sprintf(" = %s", p.Default)
		}
		e.printf("  %s: %s%s%s\n", p.Name, p.Type, def, req)
		if p.Description != "" {
			e.printf("      %s\n", firstLine(p.Description))
		}
	}
	e.printf("\nStories (%d):\n", len(d.Stories))
	for _, s := range d.Stories {
		e.printf("  %s\n", s.Name)
	}
	if d.Guideline != nil {
		e.printf("\nGuideline: %s\n\n%s\n", d.Guideline.Title, d.Guideline.Content)
	}
}

func writeDocs(e *ew, r DocsResult) {
	writeWarnings(e, r.Warnings)
	e.printf("Query: %s\n", r.Term)
	for _, d := range r.Docs {
		e.printf("\n=== %s (%s) ===\n%s\n", d.Title, d.ID, d.Content)
	}
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i]
	}
	return s
}
