package manifest

import "strings"

// GuidelineFor returns the guideline/usage doc associated with a component, if
// one exists. It matches docs whose id begins with the component's id-derived
// prefix and looks like a guideline page (e.g.
// "components-alert-guidelines-usage--docs" for component "components-alert").
func GuidelineFor(docs *Docs, c Component) (Doc, bool) {
	if docs == nil {
		return Doc{}, false
	}
	// Component ids look like "components-buttons-mainbutton"; guideline doc ids
	// look like "components-<name>-guidelines-usage--docs". Try a direct prefix
	// match first, then a looser name-based match.
	prefix := c.ID + "-guidelines"
	for _, d := range docs.Docs {
		if strings.HasPrefix(d.ID, prefix) {
			return d, true
		}
	}

	name := strings.ToLower(c.Name)
	for _, d := range docs.Docs {
		id := strings.ToLower(d.ID)
		if strings.Contains(id, "guidelines") && strings.Contains(id, name) {
			return d, true
		}
	}
	return Doc{}, false
}
