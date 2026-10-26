// Structural checks on a <math> string: is it something we can safely put in
// a QTI item body?

const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';
const TOKENS = new Set(['mi', 'mn', 'mo', 'mtext', 'ms', 'mspace', 'annotation', 'annotation-xml']);
const ARITY: Record<string, number> = {
  mfrac: 2, msub: 2, msup: 2, msubsup: 3, munder: 2, mover: 2, munderover: 3, mroot: 2,
};

export type Check = {
  wellFormed: boolean;
  empty: boolean;
  merror: boolean;
  /** Schema problems: wrong child counts, bare text, rows without cells */
  problems: string[];
  /** Characters from the LaTeX that are missing from the MathML text */
  missing: string[];
};

/** The letters and digits an author typed, ignoring command names and arguments that are not content */
export function contentChars(latex: string): string[] {
  const s = latex
    .replace(/\\(begin|end)\{[^}]*\}/g, ' ')
    .replace(/\\(textcolor|color)\{[^}]*\}/g, ' ')
    .replace(/\\placeholder(\[[^\]]*\])?/g, ' ')
    .replace(/\\operatorname\{([^}]*)\}/g, '$1')
    .replace(/\\(text|mathrm|mathbf|mathbb|ce)\{/g, '{')
    .replace(/\\[a-zA-Z]+/g, ' ');
  return [...new Set(s.match(/[A-Za-z0-9]/g) ?? [])];
}

export function check(mathml: string, latex: string): Check {
  const doc = new DOMParser().parseFromString(mathml, 'application/xml');
  if (doc.querySelector('parsererror'))
    return { wellFormed: false, empty: false, merror: false, problems: ['not well-formed XML'], missing: [] };

  const root = doc.documentElement;
  const problems: string[] = [];
  if (root.localName !== 'math' || root.namespaceURI !== MATHML_NS)
    problems.push(`root is <${root.localName}> in ${root.namespaceURI}`);

  const walk = (el: Element) => {
    const name = el.localName;
    // Content inside <semantics> annotations is not presentation markup
    if (name === 'annotation' || name === 'annotation-xml') return;
    const kids = Array.from(el.children);
    if (name in ARITY && kids.length !== ARITY[name])
      problems.push(`<${name}> has ${kids.length} children (needs ${ARITY[name]})`);
    if (name === 'mtable' && kids.some((k) => !['mtr', 'mlabeledtr'].includes(k.localName)))
      problems.push('<mtable> child that is not a row');
    if ((name === 'mtr' || name === 'mlabeledtr') && kids.some((k) => k.localName !== 'mtd'))
      problems.push(`<${name}> child that is not <mtd>`);
    if (!TOKENS.has(name)) {
      for (const n of Array.from(el.childNodes))
        if (n.nodeType === Node.TEXT_NODE && n.textContent!.trim())
          problems.push(`bare text "${n.textContent!.trim()}" in <${name}>`);
    }
    if (name === 'semantics' && kids.length) walk(kids[0]);
    else kids.forEach(walk);
  };
  walk(root);

  // Text of the presentation part only (skip annotations)
  const clone = root.cloneNode(true) as Element;
  clone.querySelectorAll('annotation, annotation-xml').forEach((a) => a.remove());
  const text = clone.textContent ?? '';
  const normalised = text.normalize('NFKC'); // ℝ → R, 𝐯 → v
  const missing = contentChars(latex).filter((c) => !normalised.includes(c));

  return {
    wellFormed: true,
    empty: clone.children.length === 0,
    merror: clone.getElementsByTagName('merror').length > 0,
    problems: [...new Set(problems)],
    missing,
  };
}
