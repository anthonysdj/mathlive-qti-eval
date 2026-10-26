// Reading content written by Wiris MathType (@wiris/mathtype-froala 8.15.4,
// mathtype-html-integration-devkit 1.17.17, read from their npm sources).
//
// Depending on its `saveMode`, Wiris stores a formula as:
//   xml      <math xmlns="…">…</math>               plain MathML (nothing to do here)
//   safeXml  «math xmlns=¨…¨»…«/math»                MathML with « » ¨ § ` for < > " & '
//   image    <img class="Wirisformula" data-mathml="«math…»" src="…render service…">
// and inside the editor it always shows the <img> form. A formula typed as
// LaTeX keeps it in <annotation encoding="LaTeX">; handwritten ones carry
// their strokes in <annotation encoding="application/json">.

const SAFE_XML: [string, string][] = [
  ['«', '<'],
  ['»', '>'],
  ['¨', '"'],
  ['§', '&'],
  ['`', "'"],
];

/**
 * Wiris's MathML.safeXmlDecode: the five safe characters and their HTML entity
 * spellings (&laquo; &raquo; &uml;). Their decoder also tries to turn an old
 * `$name;` entity form into `&name;`, but its character test never matches,
 * so in practice it leaves `$` alone, and so do we.
 */
export function safeXmlDecode(input: string): string {
  let s = input.replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&uml;/g, '¨').replace(/&quot;/g, '¨');
  for (const [from, to] of SAFE_XML) s = s.split(from).join(to);
  return s;
}

/** A Wiris formula image, as the Wiris plugin leaves it in the editor or in `image` save mode */
export function isWirisImage(el: Element): el is HTMLImageElement {
  return el.tagName === 'IMG' && (el.classList.contains('Wirisformula') || el.hasAttribute('data-mathml'));
}

/** The MathML (still a string, possibly with HTML entities) behind a Wiris formula image */
export function wirisImageMathml(img: HTMLImageElement): string | null {
  const raw = img.getAttribute('data-mathml') ?? img.getAttribute('alt');
  if (!raw || !/^\s*(«|<)math\b/.test(raw)) return null;
  return safeXmlDecode(raw);
}

/** Matches one safeXml formula written as text: «math …»…«/math» */
export const SAFE_XML_FORMULA = /«math\b[\s\S]*?«\/math»/g;
