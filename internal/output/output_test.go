package output_test

import (
	"bytes"
	"flag"
	"os"
	"path/filepath"
	"testing"

	"github.com/adriankarlen/storyquery/internal/manifest"
	"github.com/adriankarlen/storyquery/internal/output"
)

var update = flag.Bool("update", false, "update golden files")

func sampleComponent() manifest.Component {
	return manifest.Component{
		ID:          "components-button",
		Name:        "Button",
		Description: "Button - Primary UI component for user interaction",
		Import:      `import { Button } from "@acme/design-system";`,
		Path:        "./src/components/Button/Button.stories.tsx",
		Stories: []manifest.Story{
			{ID: "components-button--primary", Name: "Primary", Snippet: `const Primary = () => <Button variant="primary">Click me</Button>;`},
		},
		ReactDocgenTypeScript: manifest.DocgenInfo{
			DisplayName: "Button",
			Props: map[string]manifest.Prop{
				"variant": {
					Name:         "variant",
					Description:  "Decides the visual variant of the button",
					Required:     false,
					DefaultValue: &manifest.PropDefault{Value: []byte(`"primary"`)},
					Type:         manifest.PropType{Name: "enum", Raw: `"primary" | "secondary" | "ghost"`},
				},
				"children": {
					Name:        "children",
					Description: "The contents of the button",
					Required:    true,
					Type:        manifest.PropType{Name: "ReactNode"},
				},
			},
		},
	}
}

func TestParseFormat(t *testing.T) {
	for _, in := range []string{"json", "JSON", "text", " text "} {
		if _, err := output.ParseFormat(in); err != nil {
			t.Errorf("ParseFormat(%q) error: %v", in, err)
		}
	}
	if _, err := output.ParseFormat("yaml"); err == nil {
		t.Error("expected error for yaml")
	}
}

func TestDetailComponentJSON_Golden(t *testing.T) {
	detail := output.DetailComponent(sampleComponent(), nil)
	var buf bytes.Buffer
	if err := output.Encode(&buf, output.FormatJSON, detail); err != nil {
		t.Fatal(err)
	}
	assertGolden(t, "detail_button.json", buf.Bytes())
}

func TestDetailComponentProps(t *testing.T) {
	detail := output.DetailComponent(sampleComponent(), nil)
	if len(detail.Props) != 2 {
		t.Fatalf("props = %d, want 2", len(detail.Props))
	}
	// Props are sorted by name: children before variant.
	if detail.Props[0].Name != "children" {
		t.Errorf("first prop = %q, want children", detail.Props[0].Name)
	}
	if detail.Props[1].Default != "primary" {
		t.Errorf("variant default = %q, want primary", detail.Props[1].Default)
	}
}

func TestEncodeText(t *testing.T) {
	detail := output.DetailComponent(sampleComponent(), nil)
	var buf bytes.Buffer
	if err := output.Encode(&buf, output.FormatText, detail); err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(buf.Bytes(), []byte("Button")) {
		t.Error("text output should contain component name")
	}
}

func assertGolden(t *testing.T, name string, got []byte) {
	t.Helper()
	path := filepath.Join("testdata", name)
	if *update {
		if err := os.MkdirAll("testdata", 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, got, 0o644); err != nil {
			t.Fatal(err)
		}
		return
	}
	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read golden %s: %v (run with -update)", name, err)
	}
	if !bytes.Equal(got, want) {
		t.Errorf("output mismatch for %s\ngot:\n%s\nwant:\n%s", name, got, want)
	}
}
