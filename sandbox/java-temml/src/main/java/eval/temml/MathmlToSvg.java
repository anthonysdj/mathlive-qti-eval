package eval.temml;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.PolyglotException;
import org.graalvm.polyglot.Source;
import org.graalvm.polyglot.Value;

/**
 * Stored MathML → SVG image on a Java backend: the same MathJax build, font
 * and options as the browser and the Node print path (src/print.ts), run in
 * GraalJS. The script is src/svg-sync.ts bundled with every glyph range, so a
 * conversion is a plain synchronous call.
 *
 * Feed it MathML from {@link TemmlConverter}, never MathML from a client.
 * Like TemmlConverter, one instance per thread (or a small pool).
 */
public final class MathmlToSvg implements AutoCloseable {

  /** Far above any one formula Temml produces from MAX_LATEX_LENGTH characters of LaTeX. */
  public static final int MAX_MATHML_LENGTH = 1_000_000;

  public static final class RenderException extends Exception {
    public RenderException(String message) { super(message); }
  }

  private final Context context;
  private final Value convert;

  public MathmlToSvg() {
    // Sandboxed: the script gets no host access, no I/O, no threads.
    context = Context.newBuilder("js")
        .allowAllAccess(false)
        .option("engine.WarnInterpreterOnly", "false")
        .build();
    context.eval(load("mathml-to-svg.js"));
    convert = context.getBindings("js").getMember("mathmlToSvg");
  }

  /** A self-contained SVG (glyphs as paths, no fonts), sized in ex. */
  public synchronized String toSvg(String mathml) throws RenderException {
    if (mathml == null || mathml.isBlank()) throw new RenderException("Empty MathML");
    if (mathml.length() > MAX_MATHML_LENGTH) throw new RenderException("MathML too long");
    try {
      return convert.execute(mathml).asString();
    } catch (PolyglotException e) {
      throw new RenderException(e.getMessage());
    }
  }

  private static Source load(String file) {
    try (InputStream in = MathmlToSvg.class.getResourceAsStream("/mathjax/" + file)) {
      if (in == null) throw new IllegalStateException("Missing /mathjax/" + file + " (run pnpm build:svg-sync in sandbox/converters)");
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
