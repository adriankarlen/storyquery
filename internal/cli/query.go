package cli

import (
	"os"

	"github.com/spf13/cobra"

	"github.com/adriankarlen/storyquery/internal/output"
	"github.com/adriankarlen/storyquery/internal/search"
)

const defaultQueryLimit = 10

func newQueryCmd(gf *globalFlags) *cobra.Command {
	var limit int
	cmd := &cobra.Command{
		Use:   "query <term>",
		Short: "Search components and docs for a term",
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
			comps := search.Components(bundle.Components.Components, term, limit)
			docs := search.Docs(bundle.Docs.Docs, term, limit)

			res := output.QueryResult{Term: term, Warnings: bundle.Warnings}
			for _, m := range comps {
				res.Components = append(res.Components, output.SummarizeComponent(m.Component, m.Score))
			}
			for _, m := range docs {
				res.Docs = append(res.Docs, output.DocSummary{ID: m.Doc.ID, Title: m.Doc.Title, Score: m.Score})
			}
			return output.Encode(os.Stdout, format, res)
		},
	}
	cmd.Flags().IntVar(&limit, "limit", defaultQueryLimit, "maximum results per category (0 = all)")
	return cmd
}
