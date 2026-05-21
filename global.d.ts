// Ambient type declarations for non-code asset imports.
//
// TypeScript 5.6+ added `--noUncheckedSideEffectImports`, which some toolchains
// (newer eslint-config-next, strict CI presets) enable implicitly. Without
// these declarations, `import "./globals.css"` fails type-checking with
// "Cannot find module or type declarations for side-effect import".

declare module "*.css";
declare module "*.scss";
declare module "*.sass";
