package cli

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/adriankarlen/storyquery/internal/manifest"
	"github.com/adriankarlen/storyquery/internal/output"
	"github.com/adriankarlen/storyquery/internal/search"
)

func newShowCmd(gf *globalFlags) *cobra.Command {
	return &cobra.Command{
		Use:   "show <term|id>",
		Short: "Show full detail for a single component",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			format, err := resolveFormat(gf)
			if err != nil {
				return err
			}
			bundle, err := loadBundle(cmd.Context(), gf)
			if err != nil {
				return err
			}

			term := args[0]
			match, ok, ambiguous := search.BestComponent(bundle.Components.Components, term)
			if !ok && !ambiguous {
				return fmt.Errorf("%q: %w", term, manifest.ErrNotFound)
			}
			if ambiguous {
				suggestions := suggest(bundle, term)
				return fmt.Errorf("%q: %w; candidates: %v", term, manifest.ErrAmbiguous, suggestions)
			}

			var guideline *manifest.Doc
			if g, found := manifest.GuidelineFor(bundle.Docs, match.Component); found {
				guideline = &g
			}
			detail := output.DetailComponent(match.Component, guideline)
			detail.Warnings = bundle.Warnings
			return output.Encode(os.Stdout, format, detail)
		},
	}
}

// suggest returns up to five candidate component names for an ambiguous term.
func suggest(bundle *manifest.Bundle, term string) []string {
	matches := search.Components(bundle.Components.Components, term, 5)
	out := make([]string, 0, len(matches))
	for _, m := range matches {
		out = append(out, m.Component.ID)
	}
	return out
}
