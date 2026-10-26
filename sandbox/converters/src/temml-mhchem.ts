import temml from 'temml';

// The mhchem extension is a plain script that registers \ce on a global
// `temml`, so it is loaded lazily after the global is set: call
// loadTemmlMhchem() once before converting chemistry.
export async function loadTemmlMhchem() {
  (globalThis as any).temml = temml;
  await import('temml/contrib/mhchem/mhchem.js');
}
