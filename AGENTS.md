<!-- Generated: 2026-05-20 -->

# Link State Routing Simulator

## Purpose
An interactive simulation and visualization of the Link State Routing Protocol with Dijkstra ECMP (Equal-Cost Multi-Path), network delay, and packet loss. Built as a Google AI Studio applet with Gemini API integration.

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Project dependencies and scripts (Vite + React + Tailwind CSS) |
| `tsconfig.json` | TypeScript config with `@/*` path alias, ES2022 target, react-jsx |
| `vite.config.ts` | Vite config with React plugin, Tailwind CSS plugin, and `@` path alias |
| `index.html` | Entry HTML mounting `<div id="root">` |
| `.env.example` | Template for `GEMINI_API_KEY` and `APP_URL` environment variables |
| `metadata.json` | AI Studio metadata: app name, description, and capabilities |
| `.gitignore` | Ignores node_modules, dist, .env files (except .env.example), logs |
| `README.md` | Setup instructions: `npm install`, set API key, `npm run dev` |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | Application source code |

## For AI Agents

### Working In This Directory
- Run `npm install` after modifying `package.json`
- Use `npm run dev` to start the dev server on port 3000
- TypeScript strict mode is NOT enabled — `skipLibCheck: true`, `allowJs: true`
- Path alias `@/*` maps to the project root; subdirectories use relative imports by convention

### Testing Requirements
- Run `npm run lint` (which runs `tsc --noEmit`) before committing
- No test framework is configured — rely on type-checking for correctness

### Common Patterns
- React functional components with hooks
- Tailwind CSS 4 for all styling (no CSS modules)
- `lucide-react` for icons, `motion` for animations
- `cn()` helper from `src/lib/utils.ts` for conditional class merging

## Dependencies

### External
Exact versions are managed in `package.json`. Key libraries:
- React — UI framework
- Vite — Build tool and dev server
- Tailwind CSS — Utility-first CSS via `@tailwindcss/vite`
- D3 — Type definitions only (`@types/d3`); actual rendering uses raw SVG
- lucide-react — Icon library
- motion — Animation library (formerly framer-motion)
- @google/genai — Google Gemini AI SDK
- express — Server runtime for AI Studio deployment

<!-- MANUAL: -->