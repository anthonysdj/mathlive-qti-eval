import 'mathlive/fonts.css';
import { MathfieldElement } from 'mathlive';

// MathLive writes its shadow DOM with innerHTML. Under
// `require-trusted-types-for 'script'` that needs a policy, passed through
// the static `createHTML` hook. It must be installed before any field
// connects, so this page has no <math-field> in its HTML.
// MathLive's markup is generated from the parsed LaTeX (not raw HTML) and was
// hardened in 0.111.1, so the policy passes it through unchanged.
const tt = (window as any).trustedTypes;
if (tt) {
  const policy = tt.createPolicy('mathlive', { createHTML: (s: string) => s });
  MathfieldElement.createHTML = (html: string) => policy.createHTML(html);
}
const mf = new MathfieldElement();
mf.value = '\\frac{a}{b}+\\sqrt{x}';
document.getElementById('host')!.append(mf);
(window as any).ttOk = () => !!mf.shadowRoot?.querySelector('.ML__frac-line');
