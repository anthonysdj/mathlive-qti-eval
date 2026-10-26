// Shared by the async print path (print.ts) and the synchronous bundle for
// JVM backends (svg-sync.ts), so both feed MathJax exactly the same input.

/**
 * Adapt Temml's MathML for MathJax:
 * - Temml spaces table columns with `style="padding-…"` on each <mtd>, which
 *   MathJax misreads: matrix entries overlap their brackets and `cases` is
 *   clipped. Without it MathJax uses its own (TeX-like) column spacing.
 * - Temml's `class="tml-…"` hooks only mean something with Temml's CSS.
 *   MathJax copies them onto the SVG, where that CSS (if present on the same
 *   page) would restyle the glyphs, so drop them.
 * - Our stored format wraps the formula in <semantics> with a LaTeX
 *   <annotation>. MathJax 4.1.3's SVG output then draws only the first child
 *   of the formula's <mrow> (`a+b` comes out as `a`), so unwrap it: the
 *   annotation is for editing, not for the image.
 * - A <math> with several children (usual in MathML from Wiris, which has no
 *   outer <mrow>) is drawn only up to its first operator: `a+b` comes out as
 *   `a`, `e^x+1` as `e^x`. The same MathJax 4.1.3 behaviour as with
 *   <semantics>. Wrapping the children in one <mrow> fixes it.
 * Other inline styles (colour, the \boxed border) are kept: MathJax honours them.
 */
export function prepareForSvg(mathml: string): string {
  const cleaned = mathml
    .replace(/<annotation(-xml)?\b[^>]*>[\s\S]*?<\/annotation\1>/g, '')
    .replace(/<\/?semantics\b[^>]*>/g, '')
    .replace(/(<mtd\b[^>]*?) style="[^"]*"/g, '$1')
    .replace(/ class="[^"]*"/g, '');
  const m = cleaned.match(/^(\s*<math\b[^>]*>)([\s\S]*)(<\/math>\s*)$/);
  return m && topLevelElements(m[2]) > 1 ? `${m[1]}<mrow>${m[2]}</mrow>${m[3]}` : cleaned;
}

/** How many elements sit directly in a fragment of well-formed markup */
function topLevelElements(fragment: string): number {
  let depth = 0;
  let count = 0;
  for (const [, close, , selfClose] of fragment.matchAll(/<(\/?)([\w:-]+)[^>]*?(\/?)>/g)) {
    if (close) depth--;
    else {
      if (depth === 0) count++;
      if (!selfClose) depth++;
    }
  }
  return count;
}
