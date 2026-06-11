// Package search ranks design-system components and documentation pages against
// a free-text query term.
//
// Ranking is tiered, highest first: exact name match, exact id match, name
// prefix, id substring, then fuzzy subsequence. Scores are normalized so
// callers can sort across tiers and apply a cutoff.
package search
