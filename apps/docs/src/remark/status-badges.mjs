/**
 * Render a page's maturity, prerequisites, and support window as a text
 * badge row, from frontmatter:
 *
 *     status: experimental
 *     since: 0.1.0
 *     requires: [playwright]
 *     platforms: Linux and macOS
 *
 * The badge text carries the whole meaning, so the row survives a screen
 * reader, a monochrome print, and a no-CSS render. The fields are validated by
 * `src/content.config.ts`, and `apps/docs/README.md` documents when to set
 * them.
 */

/** Badge text for each frontmatter field, in render order. */
function badgesOf(data) {
  const badges = [];
  const status = data.status ?? "stable";
  badges.push([status, status === "experimental" ? "Experimental" : "Stable"]);
  if (data.since) badges.push(["since", `Since v${data.since}`]);
  for (const peer of data.requires ?? []) {
    badges.push(["requires", `Requires ${peer}`]);
  }
  if (data.platforms) badges.push(["platforms", data.platforms]);
  return badges;
}

export default function statusBadges() {
  return (tree, file) => {
    const data = file.data.astro?.frontmatter ?? {};
    const badges = badgesOf(data);
    if (badges.length === 0) return;

    const rendered = badges
      .map(
        ([kind, text]) =>
          `<span class="status-badge status-badge--${kind}">${text}</span>`,
      )
      .join("");
    tree.children.unshift({
      type: "html",
      value:
        `<p class="status-badges" role="group" aria-label="Capability status">` +
        `${rendered}</p>`,
    });
  };
}
