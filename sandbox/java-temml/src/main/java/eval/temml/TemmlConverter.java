package eval.temml;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.PolyglotException;
import org.graalvm.polyglot.Source;
import org.graalvm.polyglot.Value;

/**
 * LaTeX → stored MathML on a Java backend: the same Temml build the browser
 * uses, run in GraalJS (no Node, no network, no file access from the script).
 *
 * A GraalJS context is single-threaded, so one converter per thread (or a
 * small pool); conversion itself takes well under a millisecond.
 */
public final class TemmlConverter implements AutoCloseable {

  /** One formula; anything longer is refused before it reaches Temml. */
  public static final int MAX_LATEX_LENGTH = 4000;

  /** Thrown for every input we refuse to store. */
  public static final class RejectedException extends Exception {
    public RejectedException(String message) { super(message); }
  }

  private final Context context;
  private final Value render;

  public TemmlConverter() {
    // Sandboxed: the script gets no host access, no I/O, no threads.
    context = Context.newBuilder("js")
        .allowAllAccess(false)
        .option("engine.WarnInterpreterOnly", "false")
        .build();
    context.eval(load("temml.js"));
    context.eval("js", "globalThis.temml = temml;");
    context.eval(load("mhchem.js"));
    // trust stays at its default (false): \class, \style, \id, \data and
    // \includegraphics are rejected. maxSize caps \rule and spaces at 20em.
    render = context.eval("js", """
        (latex) => temml.renderToString(latex, {
          xml: true, annotate: true, throwOnError: true, maxSize: [20, 200] })
        """);
  }

  /** The <math> element to store, with the LaTeX kept as its annotation. */
  public synchronized String toStoredMathml(String latex) throws RejectedException {
    if (latex == null || latex.isBlank()) throw new RejectedException("Empty formula");
    if (latex.length() > MAX_LATEX_LENGTH)
      throw new RejectedException("Formula longer than " + MAX_LATEX_LENGTH + " characters");
    try {
      return render.execute(latex).asString();
    } catch (PolyglotException e) {
      // ParseError (unknown or untrusted command, bad colour, macro loop) or
      // RangeError (absurd nesting): either way, nothing is stored.
      throw new RejectedException(e.getMessage());
    }
  }

  private static Source load(String file) {
    try (InputStream in = TemmlConverter.class.getResourceAsStream("/temml/" + file)) {
      if (in == null) throw new IllegalStateException("Missing /temml/" + file + " (run pnpm install in sandbox/converters)");
      return Source.newBuilder("js", new String(in.readAllBytes(), StandardCharsets.UTF_8), file).build();
    } catch (IOException e) {
      throw new IllegalStateException(e);
    }
  }

  @Override
  public void close() {
    context.close();
  }
}
