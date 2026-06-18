---
name: angular-ag-grid-rules
description: Enforces Angular and AG Grid project coding standards, patterns, and best practices. Use when working on Angular components, AG Grid configurations, services, styling, or when the user asks about code style, patterns, or project conventions.
---

# Angular + AG Grid Project Rules

## Code Cleanup & Maintenance

- Remove unused variables, imports, methods, and commented-out code before commit
- Do not commit debug or test-only logic (TEST_*, injectTestErrors, console logs)
- TODO/FIXME comments are not allowed unless explicitly requested

## Avoid Over-Engineering

- Keep solutions simple; do not introduce unnecessary abstractions
- Reuse existing working grid patterns instead of creating new ones
- Do not create alternate implementations if a pattern already exists
- Prefer existing service methods over adding new ones
- Extract reusable logic to utility services (UtilService) or other appropriate service files rather than duplicating code in components
- Do not add custom CSS if global styles.css already covers the use case

## Follow Existing Patterns

- Grid configuration must use `GridConfigService.getCommonGridOptions()`
- Scrollbar behavior must use `GridConfigService.forceHorizontalScrollbarVisibility()`
- Follow existing modal patterns used in app.ts
- Reuse existing services (DataService, GridConfigService, etc.); do not duplicate logic
- Use utility services (UtilService, etc.) and other service files for reusable functionality instead of duplicating code in components

## Code Style

- Use `readonly` for properties that should not be reassigned
- Use `private readonly` for Sets/Maps used for state tracking
- Follow Angular standalone component patterns
- Use proper TypeScript types (ColDef, GridApi, GridOptions)
- Avoid using `any` unless explicitly unavoidable

## Styling

- Do not override AG Grid scrollbar styles unless absolutely necessary
- Match existing CSS patterns from styles.css
- Use `::ng-deep` sparingly and only when required
- Component styles must not affect global grid behavior

## Server & Build

- Do not run `ng serve` or `npm run start` (server is already running)
- Do not create documentation files unless explicitly requested
