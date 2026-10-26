// Froala plugin: "Insert equation" button, click-to-edit, and stored-format
// in/out. Strategy (b): the document holds rendered equations (<math-eq>),
// and one modal <math-field> edits whichever is inserted or clicked.
//
//   editor.html.set(stored)  → allow-list keeps <math>/Wiris images → hydrate() → <math-eq>
//   paste                    → same
//   editor.html.get()        → toStoredHtml(): <math-eq> → <math>, serialised as XML
//
// Usage: registerMathPlugin(FroalaEditor) once, then add 'insertEquation' to
// the toolbar. The plugin is on by default once registered (pluginsEnabled).

import { fromPersistedMathml } from '@sandbox/basic/src/serialize';
import { EquationDialog } from './equation-dialog';
import { defineMathEq, type MathEqElement } from './math-eq-element';
import { hydrate, createEq, toStoredHtml } from './math-html';
import { EQ_TAG, MATHML_ATTRS, MATHML_TAGS } from './mathml-allowlist';

// froala-editor's own typings say an event handler returns void | boolean,
// but chained events such as html.get take the handler's string, so the
// editor is typed loosely here.
type Froala = Record<string, any>;

export const COMMAND = 'insertEquation';
export const PLUGIN = 'mathEquation';

// Radical sign (√) on a 24×24 grid, in the same weight as Froala's own icons
const ICON_PATH = 'M2 12h4.4l2.5 6L13.6 3H22v2h-6.9L9.9 21H8l-3-7H2z';

const union = (a: string[] | undefined, b: string[]) => [...new Set([...(a ?? []), ...b])];

// Empty MathML elements, and <math-eq> itself, which has no children
const EMPTY_TAGS = [EQ_TAG, 'mspace', 'none', 'mprescripts', 'malignmark', 'maligngroup', 'mglyph', 'mtd', 'mi', 'mo', 'mn', 'mtext', 'mrow'];

/**
 * Froala options with the MathML allow-list merged in. The plugin adds the
 * same lists when it starts, which covers html.set() and paste, but Froala
 * cleans the content already inside its element before any plugin starts, so
 * MathML there is lost unless the lists are in the options from the start.
 */
export function withMathOptions<T extends Record<string, any>>(opts: T = {} as T, defaults: Record<string, any> = {}): T {
  const pick = (k: string): string[] | undefined => opts[k] ?? defaults[k];
  return {
    ...opts,
    htmlAllowedTags: union(pick('htmlAllowedTags'), [...MATHML_TAGS, EQ_TAG]),
    htmlAllowedAttrs: union(pick('htmlAllowedAttrs'), MATHML_ATTRS),
    htmlAllowedEmptyTags: union(pick('htmlAllowedEmptyTags'), EMPTY_TAGS),
  };
}

/** What the plugin exposes as editor.mathEquation */
export interface MathEquationApi {
  /** Open the dialog: edit `eq` if given, else insert at the caret. Resolves when the dialog closes. */
  open(eq?: HTMLElement | null): Promise<void>;
  /** The equation in the current selection, if any */
  selected(): HTMLElement | null;
  /** The dialog, created on first use (for tests and the demo) */
  dialog(): EquationDialog;
}

export function registerMathPlugin(FroalaEditor: any) {
  defineMathEq();
  if (FroalaEditor.PLUGINS[PLUGIN]) return;

  FroalaEditor.PLUGINS[PLUGIN] = function (editor: Froala): MathEquationApi & { _init(): void } {
    let dialog: EquationDialog | null = null;
    let wrapper: HTMLElement | null = null;
    const getDialog = () => (dialog ??= new EquationDialog(editor.doc ?? document));

    function selected(): HTMLElement | null {
      const sel = editor.selection.get() as Selection;
      if (!sel || !sel.rangeCount) return null;
      const range = sel.getRangeAt(0);
      if (range.collapsed) return null;
      for (const eq of Array.from(editor.el.querySelectorAll(EQ_TAG)) as HTMLElement[])
        if (range.intersectsNode(eq)) return eq;
      return null;
    }

    async function open(eq: HTMLElement | null = selected()): Promise<void> {
      if (editor.edit.isDisabled()) return;
      let latex = '';
      let note: string | undefined;
      if (eq) {
        const found = fromPersistedMathml(eq.getAttribute('data-mathml') ?? '');
        latex = found.latex;
        if (found.source === 'converted')
          note = 'This equation was made in another editor. Its LaTeX was converted from MathML, so check it before you save.';
        (eq as MathEqElement).editing = true;
      } else {
        // Keep the caret where the author was: the dialog takes focus away.
        editor.selection.save();
      }
      const mathml = await getDialog().open({ latex, mode: eq ? 'update' : 'insert', note });
      if (eq) (eq as MathEqElement).editing = false;
      if (!editor.el) return; // destroyed while the dialog was open

      if (eq) {
        if (mathml && mathml !== eq.getAttribute('data-mathml')) {
          eq.setAttribute('data-mathml', mathml);
          eq.removeAttribute('data-source'); // now ours
          editor.undo.saveStep();
          editor.events.trigger('contentChanged');
        }
        editor.events.focus();
        placeCaretAfter(eq);
        return;
      }
      editor.selection.restore();
      if (!mathml) return;
      const html = createEq(editor.doc ?? document, mathml).outerHTML;
      // The trailing marker puts the caret after the equation; a space after it
      // keeps the caret visible in Chromium when the equation ends the paragraph.
      editor.html.insert(`${html}&nbsp;`);
      editor.undo.saveStep();
    }

    function placeCaretAfter(node: Node) {
      const range = (editor.doc ?? document).createRange();
      range.setStartAfter(node);
      range.collapse(true);
      const sel = editor.selection.get() as Selection;
      sel.removeAllRanges();
      sel.addRange(range);
    }

    // The node the caret is right in front of, skipping empty text nodes
    function nodeAfterCaret(): Node | null {
      const sel = editor.selection.get() as Selection;
      if (!sel?.rangeCount || !sel.isCollapsed) return null;
      const { startContainer: c, startOffset: o } = sel.getRangeAt(0);
      let next: Node | null;
      if (c.nodeType === Node.TEXT_NODE) {
        if (c.nodeValue!.slice(o).replace(/\u200b/g, '') !== '') return null;
        next = c.nextSibling;
      } else next = c.childNodes[o] ?? null;
      while (next && next.nodeType === Node.TEXT_NODE && next.nodeValue!.replace(/\u200b/g, '') === '') next = next.nextSibling;
      return next;
    }

    // Froala removes an `fr-deletable` element on Backspace, but not on
    // Delete (forward delete) in 5.5.0: the caret just stays put. Listening on
    // the wrapper in the capture phase runs before Froala's own key handling
    // on the editable element, which would otherwise delete the next character.
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      const next = nodeAfterCaret();
      if (!(next instanceof Element) || next.localName !== EQ_TAG) return;
      e.preventDefault();
      e.stopPropagation();
      editor.undo.saveStep();
      const range = (editor.doc ?? document).createRange();
      range.setStartBefore(next);
      range.collapse(true);
      next.remove();
      const sel = editor.selection.get() as Selection;
      sel.removeAllRanges();
      sel.addRange(range);
      editor.undo.saveStep();
      editor.events.trigger('contentChanged');
    };

    const onClick = (e: MouseEvent) => {
      const eq = (e.target as Element).closest?.(EQ_TAG) as HTMLElement | null;
      if (eq && editor.el.contains(eq)) {
        e.preventDefault();
        void open(eq);
      }
    };

    function _init() {
      Object.assign(editor.opts, withMathOptions(editor.opts));

      editor.events.on('html.set', () => hydrate(editor.el));
      editor.events.on('paste.after', () => {
        if (hydrate(editor.el)) editor.undo.saveStep();
      });
      editor.events.on('html.get', (html: string) => toStoredHtml(html, editor.doc ?? document));
      editor.el.addEventListener('click', onClick);
      wrapper = editor.el.parentNode as HTMLElement;
      wrapper.addEventListener('keydown', onKeydown, true);
      // Content already in the element when Froala starts (needs withMathOptions)
      hydrate(editor.el);

      editor.events.on(
        'destroy',
        () => {
          editor.el.removeEventListener('click', onClick);
          wrapper?.removeEventListener('keydown', onKeydown, true);
          dialog?.destroy();
          dialog = null;
        },
        true
      );
    }

    return { _init, open, selected, dialog: getDialog };
  };

  FroalaEditor.DefineIcon(COMMAND, { template: 'svg', PATH: ICON_PATH, VIEWBOX: '0 0 24 24' });
  FroalaEditor.RegisterCommand(COMMAND, {
    title: 'Insert equation (Ctrl+Shift+M)',
    focus: false,
    undo: false, // the plugin saves its own undo step once the dialog closes
    refreshAfterCallback: false,
    plugin: PLUGIN,
    callback(this: Froala) {
      void this[PLUGIN].open();
    },
  });
  // Ctrl/Cmd+Shift+M: insert, or edit the selected equation
  FroalaEditor.RegisterShortcut(FroalaEditor.KEYCODE.M, COMMAND, null, 'M', true, false);
}
