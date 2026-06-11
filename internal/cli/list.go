package cli

import (
	"os"
	"sort"
	"strings"

	"github.com/spf13/cobra"

	"github.com/adriankarlen/storyquery/internal/output"
)

func newListCmd(gf *globalFlags) *cobra.Command {
	var filter string
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List all components",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			format, err := resolveFormat(gf)
			if err != nil {
				return err
			}
			bundle, err := loadBundle(cmd.Context(), gf)
			if err != nil {
				return err
			}

			needle := strings.ToLower(strings.TrimSpace(filter))
			res := output.ListResult{Warnings: bundle.Warnings}
			for _, c := range bundle.Components.Components {
				if needle != "" &&
					!strings.Contains(strings.ToLower(c.Name), needle) &&
					!strings.Contains(strings.ToLower(c.ID), needle) {
					continue
				}
				res.Components = append(res.Components, output.SummarizeComponent(c, 0))
			}
			sort.SliceStable(res.Components, func(i, j int) bool {
				return res.Components[i].Name < res.Components[j].Name
			})
			return output.Encode(os.Stdout, format, res)
		},
	}
	cmd.Flags().StringVar(&filter, "filter", "", "case-insensitive substring filter on name/id")
	return cmd
}
