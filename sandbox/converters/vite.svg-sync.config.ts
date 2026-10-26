import { defineConfig } from 'vite';

// One classic script (no imports, no exports) that GraalJS can eval:
// MathJax + the whole New Computer Modern font + prepareForSvg().
// Output: dist-svg-sync/mathml-to-svg.js, copied into the Java jar by
// sandbox/java-temml/pom.xml.
export default defineConfig({
  build: {
    outDir: 'dist-svg-sync',
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    lib: { entry: 'src/svg-sync.ts', formats: ['iife'], name: 'MathmlToSvgBundle', fileName: () => 'mathml-to-svg.js' },
  },
});
