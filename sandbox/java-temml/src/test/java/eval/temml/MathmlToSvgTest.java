package eval.temml;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class MathmlToSvgTest {
  static TemmlConverter temml;
  static MathmlToSvg svg;
  static double startupMs;

  @BeforeAll
  static void start() {
    temml = new TemmlConverter();
    long t0 = System.nanoTime();
    svg = new MathmlToSvg();
    startupMs = (System.nanoTime() - t0) / 1e6;
    System.out.printf("MathJax bundle loaded in GraalJS in %.0f ms%n", startupMs);
  }

  @AfterAll
  static void stop() {
    svg.close();
    temml.close();
  }

  /** The SVGs the print spike made in Node with src/print.ts (findings/print-svg-raw.json). */
  /** Each row also carries the standard LaTeX Temml was given (MathLive's output after toStandardLatex()). */
  static Stream<Arguments> corpus() throws Exception {
    ObjectMapper json = new ObjectMapper();
    Map<String, String> temmlInput = new HashMap<>();
    for (JsonNode r : json.readTree(Path.of("../../findings/mathml-converters-raw.json").toFile()))
      temmlInput.put(r.get("id").asText(), r.get("results").get("Temml 0.14.0").get("input").asText());
    List<Arguments> out = new ArrayList<>();
    for (JsonNode r : json.readTree(Path.of("../../findings/print-svg-raw.json").toFile()).get("rows")) {
      String id = r.get("id").asText();
      out.add(Arguments.of(id, temmlInput.get(id), r.get("mathml").asText(), r.get("svg").asText()));
    }
    return out.stream();
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("corpus")
  void sameSvgAsNode(String id, String latex, String mathml, String nodeSvg) throws Exception {
    assertEquals(nodeSvg, svg.toSvg(mathml));
  }

  /** Backend path end to end: LaTeX → stored MathML (with annotation) → SVG, all in Java. */
  @ParameterizedTest(name = "{0}")
  @MethodSource("corpus")
  void storedMathmlGivesTheSameSvg(String id, String latex, String mathml, String nodeSvg) throws Exception {
    assertEquals(nodeSvg, svg.toSvg(temml.toStoredMathml(latex)));
  }

  @Test
  void drawsRareGlyphsWithoutLoadingAnything() throws Exception {
    // double-struck, fraktur and script live in ranges MathJax loads on demand in Node and the browser
    String out = svg.toSvg(temml.toStoredMathml("\\mathbb{R}\\mathfrak{g}\\mathscr{L}"));
    assertTrue(out.contains("data-c=\"211D\""), out);
    assertFalse(out.contains("data-mjx-error"), out);
  }

  @Test
  void isSelfContained() throws Exception {
    String out = svg.toSvg(temml.toStoredMathml("x^2"));
    assertTrue(out.startsWith("<svg"), out);
    assertFalse(out.contains("<use"), "glyphs must be inline paths, not references"); // fontCache: 'none'
    assertTrue(out.matches("(?s).*width=\"[\\d.]+ex\".*"), out);
  }

  @Test
  void badMathmlIsAnErrorNotACrash() {
    assertThrows(MathmlToSvg.RenderException.class, () -> svg.toSvg(""));
    assertThrows(MathmlToSvg.RenderException.class, () -> svg.toSvg("x".repeat(MathmlToSvg.MAX_MATHML_LENGTH + 1)));
    // Malformed MathML: MathJax either throws or draws an error box, but the converter keeps working
    try { svg.toSvg("<math><mi>x</math>"); } catch (MathmlToSvg.RenderException expected) { }
    assertDoesNotThrow(() -> svg.toSvg(temml.toStoredMathml("a+b")));
  }

  @Test
  void isFastOnceWarm() throws Exception {
    String mathml = temml.toStoredMathml("x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}");
    for (int i = 0; i < 200; i++) svg.toSvg(mathml);
    long t0 = System.nanoTime();
    int n = 300;
    for (int i = 0; i < n; i++) svg.toSvg(mathml);
    double ms = (System.nanoTime() - t0) / 1e6 / n;
    System.out.printf("MathJax SVG in GraalJS: %.3f ms per formula (warm)%n", ms);
    assertTrue(ms < 100, "too slow: " + ms + " ms");
  }
}
