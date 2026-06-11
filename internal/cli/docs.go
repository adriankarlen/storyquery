package cli

import (
	"os"

	"github.com/spf13/cobra"

	"github.com/adriankarlen/storyquery/internal/output"
	"github.com/adriankarlen/storyquery/internal/search"
)

func newDocsCmd(gf *globalFlags) *cobra.Command {
	var limit int
	cmd := &cobra.Command{
		Use:   "docs <term>",
		Short: "Search documentation and guideline pages",
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
			matches := search.Docs(bundle.Docs.Docs, term, limit)
			res := output.DocsResult{Term: term, Warnings: bundle.Warnings}
			for _, m := range matches {
				res.Docs = append(res.Docs, output.DetailDoc(m.Doc))
			}
			return output.Encode(os.Stdout, format, res)
		},
	}
	cmd.Flags().IntVar(&limit, "limit", defaultQueryLimit, "maximum results (0 = all)")
	return cmd
}
