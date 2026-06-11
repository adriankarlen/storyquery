package manifest

import (
	"encoding/json"
	"fmt"
)

// SchemaVersion is the manifest schema version this package was written against.
// Manifests reporting a different version are still parsed (best effort) but the
// mismatch is surfaced to callers via Components.VersionMismatch / Docs.VersionMismatch.
const SchemaVersion = 0

// Components is the parsed representation of components.json.
type Components struct {
	V          int                  `json:"v"`
	Components map[string]Component `json:"components"`
}

// Docs is the parsed representation of docs.json.
type Docs struct {
	V    int            `json:"v"`
	Docs map[string]Doc `json:"docs"`
}

// Component describes a single design-system component.
type Component struct {
	ID                    string          `json:"id"`
	Name                  string          `json:"name"`
	Path                  string          `json:"path"`
	Import                string          `json:"import"`
	Description           string          `json:"description"`
	JSDocTags             json.RawMessage `json:"jsDocTags,omitempty"`
	Stories               []Story         `json:"stories"`
	ReactDocgenTypeScript DocgenInfo      `json:"reactDocgenTypescript"`
}

// Story is a single Storybook story for a component.
type Story struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Snippet string `json:"snippet"`
}

// DocgenInfo holds the react-docgen-typescript output for a component.
type DocgenInfo struct {
	DisplayName string            `json:"displayName"`
	Description string            `json:"description"`
	ExportName  string            `json:"exportName"`
	FilePath    string            `json:"filePath"`
	Tags        map[string]string `json:"tags"`
	Props       map[string]Prop   `json:"props"`
}

// Prop describes a single component property.
type Prop struct {
	Name         string       `json:"name"`
	Description  string       `json:"description"`
	Required     bool         `json:"required"`
	DefaultValue *PropDefault `json:"defaultValue"`
	Type         PropType     `json:"type"`
}

// PropDefault is the default value of a prop, when one is documented.
type PropDefault struct {
	Value json.RawMessage `json:"value"`
}

// String renders the default value as a readable string.
func (d *PropDefault) String() string {
	if d == nil || len(d.Value) == 0 {
		return ""
	}
	// The value may be a JSON string, number, or bool. Try string first.
	var s string
	if err := json.Unmarshal(d.Value, &s); err == nil {
		return s
	}
	return string(d.Value)
}

// PropType describes the resolved type of a prop.
type PropType struct {
	Name  string          `json:"name"`
	Raw   string          `json:"raw"`
	Value json.RawMessage `json:"value"`
}

// String renders the prop type, preferring the raw TypeScript expression.
func (t PropType) String() string {
	if t.Raw != "" {
		return t.Raw
	}
	return t.Name
}

// Doc describes a single MDX documentation/guideline page.
type Doc struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Path    string `json:"path"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

// ParseComponents decodes components.json bytes.
func ParseComponents(data []byte) (*Components, error) {
	var c Components
	if err := json.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("parse components manifest: %w", err)
	}
	if c.Components == nil {
		c.Components = map[string]Component{}
	}
	return &c, nil
}

// ParseDocs decodes docs.json bytes.
func ParseDocs(data []byte) (*Docs, error) {
	var d Docs
	if err := json.Unmarshal(data, &d); err != nil {
		return nil, fmt.Errorf("parse docs manifest: %w", err)
	}
	if d.Docs == nil {
		d.Docs = map[string]Doc{}
	}
	return &d, nil
}

// VersionMismatch reports whether the components manifest version differs from
// the schema version this build understands.
func (c *Components) VersionMismatch() bool { return c.V != SchemaVersion }

// VersionMismatch reports whether the docs manifest version differs from the
// schema version this build understands.
func (d *Docs) VersionMismatch() bool { return d.V != SchemaVersion }
