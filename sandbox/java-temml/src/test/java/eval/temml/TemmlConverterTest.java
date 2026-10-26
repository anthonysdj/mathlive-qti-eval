package eval.temml;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

class TemmlConverterTest {
  static TemmlConverter temml;

  @BeforeAll
  static void start() { temml = new TemmlConverter(); }

  @AfterAll
  static void stop() { temml.close(); }

  /** The Temml output the converter spike recorded in Node (findings/mathml-converters-raw.json). */
  static Stream<Arguments> corpus() throws Exception {
    JsonNode rows = new ObjectMapper().readTree(Path.of("../../findings/mathml-converters-raw.json").toFile());
    List<Arguments> out = new ArrayList<>();
    for (JsonNode r : rows) {
      JsonNode t = r.get("results").get("Temml 0.14.0");
      out.add(Arguments.of(r.get("id").asText(), t.get("input").asText(), t.get("mathml").asText()));
    }
    return out.stream();
  }

  /** Our stored form minus the annotation wrapper, to compare with the plain Node output. */
  static String withoutAnnotation(String mathml) {
    return mathml.replaceAll("<annotation\\b[^>]*>[\\s\\S]*?</annotation>", "").replaceAll("</?semantics>", "");
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("corpus")
  void sameMathmlAsNode(String id, String latex, String nodeMathml) throws Exception {
    String stored = temml.toStoredMathml(latex);
    assertTrue(stored.contains("<annotation encoding=\"application/x-tex\">"), stored);
    assertEquals(nodeMathml, withoutAnnotation(stored));
  }

  @ParameterizedTest
  @ValueSource(strings = {
      "\\href{javascript:alert(1)}{x}",
      "\\url{javascript:alert(1)}",
      "\\includegraphics{http://evil.example/x.png}",
      "\\class{x\" onmouseover=\"alert(1)}{x}",
      "\\style{background:red}{x}",
      "\\data{onclick=alert(1)}{x}",
      "\\htmlData{onclick=alert(1)}{x}",
      "\\cssId{a}{x}",
      "\\textcolor{red\" onmouseover=\"alert(1)}{x}",
      "\\unicode{60}",
      "\\def\\a{\\a\\a}\\a",
  })
  void rejectsDangerousOrLoopingInput(String latex) {
    assertThrows(TemmlConverter.RejectedException.class, () -> temml.toStoredMathml(latex));
  }

  @Test
  void escapesTextAndAnnotation() throws Exception {
    String out = temml.toStoredMathml("\\text{<script>alert(1)</script>}</annotation><img src=x onerror=alert(1)>");
    assertFalse(out.contains("<script"));
    assertFalse(out.contains("<img"));
  }

  @Test
  void rejectsAbsurdNestingWithoutCrashing() {
    String deep = "{".repeat(1500) + "x" + "}".repeat(1500);
    assertThrows(TemmlConverter.RejectedException.class, () -> temml.toStoredMathml(deep));
  }

  @Test
  void rejectsOverlongInput() {
    assertThrows(TemmlConverter.RejectedException.class, () -> temml.toStoredMathml("x+".repeat(3000)));
  }

  @Test
  void capsHugeSizes() throws Exception {
    String out = temml.toStoredMathml("\\rule{100000em}{100000em}");
    assertTrue(out.contains("<mspace mathbackground=\"black\" width=\"20em\" height=\"20em\">"), out);
  }

  @Test
  void isFastOnceWarm() throws Exception {
    for (int i = 0; i < 200; i++) temml.toStoredMathml("x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}");
    long t0 = System.nanoTime();
    int n = 500;
    for (int i = 0; i < n; i++) temml.toStoredMathml("x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}");
    double ms = (System.nanoTime() - t0) / 1e6 / n;
    System.out.printf("Temml in GraalJS: %.3f ms per formula (warm)%n", ms);
    assertTrue(ms < 20, "too slow: " + ms + " ms");
  }
}
