<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-20 -->

# i18n

## Purpose
Internationalization system supporting English and Chinese (zh). Provides a React context for language switching with automatic detection and localStorage persistence.

## Key Files

| File | Description |
|------|-------------|
| `LanguageContext.tsx` | `LanguageProvider` context and `useLanguage()` hook; auto-detects language from `navigator.language` or localStorage |
| `translations.ts` | Translation dictionary with `en` and `zh` keys; exports `Language` type (`'en' | 'zh'`) and the `translations` object |

## For AI Agents

### Working In This Directory
- Translations are flat key-value objects — no nested structures or interpolation
- When adding new UI text, add keys to BOTH `en` and `zh` objects in `translations.ts`
- The `t` object returned by `useLanguage()` has the same shape as the `en` translations
- All user-facing strings MUST be added to `translations.ts`; do not use inline conditional strings

### Common Patterns
- `LanguageProvider` wraps the entire app in `main.tsx`
- Components consume translations via `const { t, language, setLanguage } = useLanguage()`

### External Dependencies
Inherited from root `AGENTS.md`.

<!-- MANUAL: -->