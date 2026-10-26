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
 * Other inline styles (colour, the \boxed border) are kept: MathJax honours them.
 */
export function prepareForSvg(mathml: string): string {
  return mathml
    .replace(/<annotation(-xml)?\b[^>]*>[\s\S]*?<\/annotation\1>/g, '')
    .replace(/<\/?semantics\b[^>]*>/g, '')
    .replace(/(<mtd\b[^>]*?) style="[^"]*"/g, '$1')
    .replace(/ class="[^"]*"/g, '');
}
