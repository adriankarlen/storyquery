// Package output renders query results in either machine-readable JSON
// (the default, agent-first contract) or human-friendly text.
package output

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/adriankarlen/storyquery/internal/manifest"
)

// Format selects the rendering style.
type Format string

const (
	// FormatJSON renders stable JSON.
	FormatJSON Format = "json"
	// FormatText renders human-friendly text.
	FormatText Format = "text"
)

// ParseFormat validates and normalizes a format string.
func ParseFormat(s string) (Format, error) {
	switch Format(strings.ToLower(strings.TrimSpace(s))) {
	case FormatJSON:
		return FormatJSON, nil
	case FormatText:
		return FormatText, nil
	default:
		return "", fmt.Errorf("invalid format %q (want json or text)", s)
	}
}

// --- Stable view models (the JSON contract) ---

// QueryResult is the payload for `query`.
type QueryResult struct {
	Term       string             `json:"term"`
	Components []ComponentSummary `json:"components"`
	Docs       []DocSummary       `json:"docs"`
	Warnings   []string           `json:"warnings,omitempty"`
}

// ComponentSummary is a compact component view used by query/list.
type ComponentSummary struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Import      string `json:"import,omitempty"`
	Props       int    `json:"props"`
	Stories     int    `json:"stories"`
	Score       int    `json:"score,omitempty"`
}

// DocSummary is a compact doc view.
type DocSummary struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Score int    `json:"score,omitempty"`
}

// ComponentDetail is the full payload for `show`.
type ComponentDetail struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	Import      string            `json:"import,omitempty"`
	Path        string            `json:"path,omitempty"`
	SourceFile  string            `json:"sourceFile,omitempty"`
	Tags        map[string]string `json:"tags,omitempty"`
	Props       []PropDetail      `json:"props"`
	Stories     []StoryDetail     `json:"stories"`
	Guideline   *DocDetail        `json:"guideline,omitempty"`
	Warnings    []string          `json:"warnings,omitempty"`
}

// PropDetail describes one prop in the detail view.
type PropDetail struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Required    bool   `json:"required"`
	Default     string `json:"default,omitempty"`
	Description string `json:"description,omitempty"`
}

// StoryDetail describes one story in the detail view.
type StoryDetail struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Snippet string `json:"snippet,omitempty"`
}

// DocDetail is the full payload for a documentation page.
type DocDetail struct {
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Content  string   `json:"content"`
	Warnings []string `json:"warnings,omitempty"`
}

// DocsResult is the payload for `docs`.
type DocsResult struct {
	Term     string      `json:"term"`
	Docs     []DocDetail `json:"docs"`
	Warnings []string    `json:"warnings,omitempty"`
}

// ListResult is the payload for `list`.
type ListResult struct {
	Components []ComponentSummary `json:"components"`
	Warnings   []string           `json:"warnings,omitempty"`
}

// --- Builders ---

// SummarizeComponent builds a compact summary (score optional).
func SummarizeComponent(c manifest.Component, score int) ComponentSummary {
	return ComponentSummary{
		ID:          c.ID,
		Name:        c.Name,
		Description: c.Description,
		Import:      c.Import,
		Props:       len(c.ReactDocgenTypeScript.Props),
		Stories:     len(c.Stories),
		Score:       score,
	}
}

// DetailComponent builds the full detail view, attaching a guideline doc if set.
func DetailComponent(c manifest.Component, guideline *manifest.Doc) ComponentDetail {
	tags := mergeTags(c.ReactDocgenTypeScript.Tags)
	d := ComponentDetail{
		ID:          c.ID,
		Name:        c.Name,
		Description: c.Description,
		Import:      c.Import,
		Path:        c.Path,
		SourceFile:  c.ReactDocgenTypeScript.FilePath,
		Tags:        tags,
		Props:       make([]PropDetail, 0, len(c.ReactDocgenTypeScript.Props)),
		Stories:     make([]StoryDetail, 0, len(c.Stories)),
	}
	for _, p := range c.ReactDocgenTypeScript.Props {
		d.Props = append(d.Props, PropDetail{
			Name:        p.Name,
			Type:        p.Type.String(),
			Required:    p.Required,
			Default:     p.DefaultValue.String(),
			Description: p.Description,
		})
	}
	// Stable prop order by name.
	sortProps(d.Props)
	for _, s := range c.Stories {
		d.Stories = append(d.Stories, StoryDetail{ID: s.ID, Name: s.Name, Snippet: s.Snippet})
	}
	if guideline != nil {
		d.Guideline = &DocDetail{ID: guideline.ID, Title: guideline.Title, Content: guideline.Content}
	}
	return d
}

// mergeTags combines tag maps, returning nil when all are empty (so
// omitempty suppresses the field from JSON output).
func mergeTags(sources ...map[string]string) map[string]string {
	merged := make(map[string]string)
	for _, src := range sources {
		for k, v := range src {
			if v != "" {
				merged[k] = v
			}
		}
	}
	if len(merged) == 0 {
		return nil
	}
	return merged
}

// DetailDoc builds a full doc view.
func DetailDoc(d manifest.Doc) DocDetail {
	return DocDetail{ID: d.ID, Title: d.Title, Content: d.Content}
}

// --- Encoders ---

// Encode writes v in the requested format to w.
func Encode(w io.Writer, format Format, v any) error {
	switch format {
	case FormatJSON:
		return encodeJSON(w, v)
	case FormatText:
		return encodeText(w, v)
	default:
		return fmt.Errorf("unsupported format %q", format)
	}
}

func encodeJSON(w io.Writer, v any) error {
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return fmt.Errorf("encode json: %w", err)
	}
	return nil
}
