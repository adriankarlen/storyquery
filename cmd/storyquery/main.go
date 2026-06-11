// Command storyquery is a CLI for querying a Storybook design-system manifest.
package main

import (
	"context"
	"os"
	"os/signal"

	"github.com/adriankarlen/storyquery/internal/cli"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	os.Exit(cli.Execute(ctx))
}
