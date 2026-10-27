// MathType MathML → LaTeX for <math-field>, without the losses of plain
// mathml-to-latex (the fallback in sandbox/basic/src/serialize.ts).
//
// mathml-to-latex 1.8.0 drops or breaks what MathType writes for: upright
// letters (mathvariant="normal": units and chemistry turn italic), colour,
// background and size (<mstyle>), <mfenced> brackets (parentheses become
// square brackets; an empty closing fence gives LaTeX MathLive rejects),
// circles (<menclose notation="circle"> becomes a box), manual line breaks and
// MathML elementary math (<mstack>, <mlongdiv>: just the digits in a row).
//
// This pre-pass converts those elements itself and lets mathml-to-latex do the
// rest: each handled element is swapped for a one-character <mi> stand-in
// (a private-use character), the tree is converted, and the stand-ins are
// replaced by the LaTeX built here. See tests/wiris-import.test.ts.

import { MathMLToLaTeX } from 'mathml-to-latex';

const NS = 'http://www.w3.org/1998/Math/MathML';
const TEX_ENCODINGS = ['application/x-tex', 'latex', 'tex', 'text/x-latex'];

export type Imported = {
  latex: string;
  source: 'annotation' | 'converted';
  /** What could only be approximated, for the "check it before you save" note */
  approximations: string[];
};

/** Wiris's default formula size is 16px; LaTeX size commands relative to that */
function sizeCommand(mathsize: string): string | null {
  const m = /^([\d.]+)\s*(px|pt|em|%)?$/.exec(mathsize.trim());
  if (!m) return { small: '\\small', big: '\\large' }[mathsize as 'small' | 'big'] ?? null;
  const n = parseFloat(m[1]);
  const px = m[2] === 'pt' ? n * (4 / 3) : m[2] === 'em' ? n * 16 : m[2] === '%' ? (n / 100) * 16 : n;
  const r = px / 16;
  if (r < 0.65) return '\\tiny';
  if (r < 0.8) return '\\scriptsize';
  if (r < 0.95) return '\\small';
  if (r < 1.1) return null;
  if (r < 1.3) return '\\large';
  if (r < 1.6) return '\\Large';
  if (r < 1.9) return '\\LARGE';
  if (r < 2.3) return '\\huge';
  return '\\Huge';
}

const FENCE: Record<string, string> = {
  '(': '(', ')': ')', '[': '[', ']': ']', '{': '\\{', '}': '\\}', '|': '|', '‖': '\\|',
  '⟨': '\\langle', '⟩': '\\rangle', '〈': '\\langle', '〉': '\\rangle',
  '⌊': '\\lfloor', '⌋': '\\rfloor', '⌈': '\\lceil', '⌉': '\\rceil', '': '.',
};

const ENCLOSE: Record<string, (x: string) => string> = {
  updiagonalstrike: (x) => `\\cancel{${x}}`,
  downdiagonalstrike: (x) => `\\bcancel{${x}}`,
  'updiagonalstrike downdiagonalstrike': (x) => `\\xcancel{${x}}`,
  box: (x) => `\\boxed{${x}}`,
  top: (x) => `\\overline{${x}}`,
  bottom: (x) => `\\underline{${x}}`,
  circle: (x) => `\\enclose{circle}{${x}}`,
  roundedbox: (x) => `\\enclose{roundedbox}{${x}}`,
  longdiv: (x) => `\\enclose{longdiv}{${x}}`,
};

export class WirisImporter {
  private subs: string[] = [];
  approximations: string[] = [];

  /** Swap `el` for a stand-in whose LaTeX is `latex` */
  private stand(el: Element, latex: string) {
    const mi = el.ownerDocument.createElementNS(NS, 'mi');
    mi.textContent = String.fromCharCode(0xe000 + this.subs.length);
    this.subs.push(latex);
    el.replaceWith(mi);
  }

  /** LaTeX of a list of MathML nodes, with every special element handled */
  latexOf(nodes: Element[]): string {
    if (!nodes.length) return '';
    const doc = nodes[0].ownerDocument;
    const math = doc.createElementNS(NS, 'math');
    for (const n of nodes) math.append(n.cloneNode(true));
    this.rewrite(math);
    let latex = MathMLToLaTeX.convert(new XMLSerializer().serializeToString(math));
    // Stand-ins may nest (a colour inside a fraction inside a colour), so resolve until none remain
    for (let i = 0; i < 10 && /[-]/.test(latex); i++)
      latex = latex.replace(/[-]/g, (c) => this.subs[c.charCodeAt(0) - 0xe000] ?? c);
    return latex.trim();
  }

  private kids(el: Element): Element[] {
    return Array.from(el.children);
  }

  /** Rewrite special elements below `root`, deepest first so their content is already handled */
  private rewrite(root: Element) {
    for (const el of Array.from(root.children)) this.rewrite(el);
    for (const el of Array.from(root.children)) this.handle(el);
  }

  private handle(el: Element) {
    const name = el.localName;
    // Upright single letters: mathml-to-latex makes them italic
    if (name === 'mi' && el.getAttribute('mathvariant') === 'normal' && !el.hasAttribute('mathcolor'))
      return this.stand(el, `\\mathrm{${el.textContent}}`);

    const color = el.getAttribute('mathcolor');
    const bg = el.getAttribute('mathbackground');
    const size = el.getAttribute('mathsize');
    if (color || bg || size) {
      const copy = el.cloneNode(true) as Element;
      copy.removeAttribute('mathcolor');
      copy.removeAttribute('mathbackground');
      copy.removeAttribute('mathsize');
      let x = name === 'mstyle' || name === 'mrow' ? this.latexOf(this.kids(copy)) : this.latexOf([copy]);
      if (copy.localName === 'mi' && copy.getAttribute('mathvariant') === 'normal') x = `\\mathrm{${copy.textContent}}`;
      const cmd = size ? sizeCommand(size) : null;
      if (size && cmd) x = `{${cmd} ${x}}`;
      if (color) x = `\\textcolor{${color}}{${x}}`;
      if (bg) x = `\\colorbox{${bg}}{$${x}$}`;
      return this.stand(el, x);
    }

    if (name === 'mfenced') {
      const open = el.getAttribute('open') ?? '(';
      const close = el.getAttribute('close') ?? ')';
      const seps = (el.getAttribute('separators') ?? ',').replace(/\s/g, '');
      const parts = this.kids(el).map((k, i) => (i ? (seps[Math.min(i - 1, seps.length - 1)] ?? '') : '') + this.latexOf([k]));
      const l = FENCE[open] ?? open;
      const r = FENCE[close] ?? close;
      return this.stand(el, `\\left${l}${parts.join('')}\\right${r}`);
    }

    if (name === 'menclose') {
      const notation = (el.getAttribute('notation') ?? 'longdiv').trim().split(/\s+/).sort().join(' ');
      const wrap = ENCLOSE[notation] ?? ENCLOSE[notation.split(' ').reverse().join(' ')];
      const x = this.latexOf(this.kids(el));
      if (!wrap) this.approximations.push(`menclose notation="${notation}" drawn as a box`);
      return this.stand(el, (wrap ?? ENCLOSE.box)(x));
    }

    if (name === 'mover' && el.children.length === 2) {
      const accent = el.children[1].textContent?.trim();
      const base = this.latexOf([el.children[0]]);
      if (accent === '⌒' || accent === '⏜') return this.stand(el, `\\wideparen{${base}}`);
      if (accent === '→' || accent === '⃗')
        return this.stand(el, base.length > 1 ? `\\overrightarrow{${base}}` : `\\vec{${base}}`);
      if (accent === '↔') return this.stand(el, `\\overleftrightarrow{${base}}`);
    }

    if (name === 'mmultiscripts') return this.stand(el, this.multiscripts(el));
    if (name === 'mstack') return this.stand(el, this.stack(el));
    if (name === 'mlongdiv') return this.stand(el, this.longdiv(el));
  }

  /** <mmultiscripts> base (sub sup)* <mprescripts/> (presub presup)* → {}_{a}^{b}X_{c}^{d} */
  private multiscripts(el: Element): string {
    const kids = this.kids(el);
    const pre = kids.findIndex((k) => k.localName === 'mprescripts');
    const post = pre < 0 ? kids.slice(1) : kids.slice(1, pre);
    const prescripts = pre < 0 ? [] : kids.slice(pre + 1);
    const script = (k: Element | undefined) => (k && k.localName !== 'none' ? this.latexOf([k]) : '');
    const pair = (list: Element[]) => {
      let s = '';
      for (let i = 0; i < list.length; i += 2) {
        const sub = script(list[i]);
        const sup = script(list[i + 1]);
        s += (sub ? `_{${sub}}` : '') + (sup ? `^{${sup}}` : '');
      }
      return s;
    };
    const left = pair(prescripts);
    const right = pair(post);
    return `${left ? `{}${left}` : ''}${this.latexOf([kids[0]])}${right}`;
  }

  /**
   * <mstack>: rows of digits, operators, lines and carries, right-aligned.
   * LaTeX has no column arithmetic, so it becomes a right-aligned array, a
   * line under a row becomes \underline (MathLive has no \hline), carries a
   * small row. Digit-by-digit alignment (stackalign, charalign, position) is
   * only kept as far as right alignment keeps it.
   */
  private stack(el: Element): string {
    const rows: string[] = [];
    for (const k of this.kids(el)) {
      if (k.localName === 'msline') {
        if (rows.length) rows[rows.length - 1] = `\\underline{${rows[rows.length - 1]}}`;
      } else if (k.localName === 'mscarries') {
        rows.push(
          `\\scriptstyle ${this.kids(k)
            .map((c) => (c.localName === 'none' ? '\\phantom{0}' : this.latexOf([c.localName === 'mscarry' ? (c.firstElementChild ?? c) : c])))
            .join('')}`
        );
      } else if (k.localName === 'msrow' || k.localName === 'msgroup') {
        rows.push(this.kids(k).map((c) => (c.localName === 'none' ? '\\phantom{0}' : this.latexOf([c]))).join('\\,'));
      } else rows.push(this.latexOf([k]));
    }
    this.approximations.push('column arithmetic (<mstack>) laid out as a right-aligned table');
    return `\\begin{array}{r}${rows.join('\\\\')}\\end{array}`;
  }

  /**
   * <mlongdiv>: divisor, result, dividend, then the working. Drawn the US way
   * (result above, divisor left of the bracket) whatever longdivstyle says.
   */
  private longdiv(el: Element): string {
    const [divisor, result, dividend, ...steps] = this.kids(el);
    const style = el.getAttribute('longdivstyle') ?? 'lefttop';
    if (style !== 'lefttop' && style !== 'left)(right')
      this.approximations.push(`long division style "${style}" drawn in the US style`);
    const rows = [`${this.latexOf([result])}`, `${this.latexOf([divisor])}\\enclose{longdiv}{${this.latexOf([dividend])}}`];
    for (const s of steps) {
      if (s.localName === 'msline') {
        if (rows.length > 2) rows[rows.length - 1] = `\\underline{${rows[rows.length - 1]}}`;
      } else if (s.localName === 'msgroup' || s.localName === 'msrow') {
        for (const c of this.kids(s)) {
          if (c.localName === 'msline') rows[rows.length - 1] = `\\underline{${rows[rows.length - 1]}}`;
          else rows.push(this.latexOf([c]));
        }
      } else rows.push(this.latexOf([s]));
    }
    this.approximations.push('long division (<mlongdiv>) laid out as a right-aligned table');
    return `\\begin{array}{r}${rows.join('\\\\')}\\end{array}`;
  }
}

/** Manual line breaks at the top level become rows of an aligned block (MathType aligns them left). */
function splitLines(nodes: Element[]): Element[][] {
  const lines: Element[][] = [[]];
  for (const n of nodes) {
    if (n.localName === 'mspace' && n.getAttribute('linebreak') === 'newline') lines.push([]);
    else lines[lines.length - 1].push(n);
  }
  return lines;
}

/** Editable LaTeX for a stored or MathType <math>: its LaTeX annotation, or converted from the MathML. */
export function importMathml(xml: string): Imported {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid MathML');
  for (const ann of Array.from(doc.getElementsByTagNameNS('*', 'annotation'))) {
    if (TEX_ENCODINGS.includes((ann.getAttribute('encoding') ?? '').toLowerCase()))
      return { latex: ann.textContent ?? '', source: 'annotation', approximations: [] };
  }
  for (const a of Array.from(doc.querySelectorAll('annotation, annotation-xml'))) a.remove();
  let nodes = Array.from(doc.documentElement.children);
  if (nodes.length === 1 && nodes[0].localName === 'semantics') nodes = Array.from(nodes[0].children);
  if (nodes.length === 1 && nodes[0].localName === 'mrow') nodes = Array.from(nodes[0].children);

  const imp = new WirisImporter();
  const lines = splitLines(nodes);
  const latex =
    lines.length > 1
      ? `\\begin{aligned}${lines.map((l) => `&${imp.latexOf(l)}`).join('\\\\')}\\end{aligned}`
      : imp.latexOf(nodes);
  return { latex, source: 'converted', approximations: imp.approximations };
}
