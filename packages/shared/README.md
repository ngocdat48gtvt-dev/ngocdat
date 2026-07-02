# @quanlysuco/shared

Shared foundation scaffold for **Phase 3.1** of the monorepo migration.

## Status

This package is **scaffold only**. It is not yet wired into any app (`dieu-hanh`, `nhat-ky`, `website`). No imports from apps point here yet.

## What belongs here

Pure, side-effect-free modules only:

- Constants and enums
- TypeScript types and interfaces
- Formatters, parsers, validators
- String, date, number, and chainage (km) utilities
- Pure business rules (no I/O)

## What does NOT belong here

- React components, hooks, or context
- Firebase / Firestore / Storage / Auth
- Browser APIs (`window`, `document`, `localStorage`, `canvas`, etc.)
- Tailwind / CSS class helpers
- Services that perform network or persistence I/O
- Report builders that depend on ExcelJS, docx, or DOM image loading

## Next steps (future phases)

1. Move vetted pure modules from apps into `src/`
2. Add build output (`dist/`) when apps start consuming the package
3. Update app imports incrementally with tests
