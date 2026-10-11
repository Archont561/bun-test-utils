/**
 * Render a visible label in front of code samples whose fence meta names the
 * kind of sample it is.
 *
 *     ```ts title="test.ts" runnable
 *     ```ts title="orders.test.ts" illustrative
 *     ```ts partial
 *
 * `runnable` means a complete sample: `apps/docs/tests/first-test-snippet.test.ts`
 * writes every runnable TypeScript sample into a scratch project, performs
 * every runnable shell line, and requires the tests to pass against the built
 * package, so the label cannot rot. `illustrative` means a complete sample the
 * check cannot execute (it needs a browser, a service, or application helpers
 * the sample does not define). `partial` means the sample is one step of a
 * longer file or workflow.
 *
 * The label is emitted as a paragraph of text (not a colour swatch), so the
 * kind is readable in a screen reader and in a no-CSS render. `apps/docs/
 * README.md` carries the same contract for writers.
 */

const KINDS = {
  runnable: {
    text: "Runnable",
    hint: "complete sample — the docs check runs it against the built package",
  },
  illustrative: {
    text: "Illustrative",
    hint: "a complete sample the check cannot run, or one that calls helpers it does not define",
  },
  partial: {
    text: "Partial",
    hint: "one step of a longer file or workflow — surrounding lines are omitted",
  },
};

/** First sample kind named in a fence's meta string, if any. */
function kindOf(meta) {
  if (typeof meta !== "string") return undefined;
  return Object.keys(KINDS).find((kind) =>
    new RegExp(`(?:^|\\s)${kind}(?:\\s|$)`).test(meta),
  );
}

/** Raw HTML paragraph marking one code block, or `undefined` for no label. */
function label(kind) {
  const { text, hint } = KINDS[kind];
  return {
    type: "html",
    value:
      `<p class="sample-label sample-label--${kind}">` +
      `<strong>${text}</strong> — ${hint}</p>`,
  };
}

export default function sampleLabels() {
  return (tree) => {
    const children = [];
    for (const node of tree.children) {
      const kind = node.type === "code" ? kindOf(node.meta) : undefined;
      if (kind) children.push(label(kind));
      children.push(node);
    }
    tree.children = children;
  };
}
