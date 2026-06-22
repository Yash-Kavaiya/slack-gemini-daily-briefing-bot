```markdown
# slack-gemini-daily-briefing-bot Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill covers the development patterns, coding conventions, and workflows used in the `slack-gemini-daily-briefing-bot` TypeScript project. The repository is designed for building a Slack bot that delivers daily briefings, with a strong emphasis on structured feature development, robust testing, and clear documentation. The project uses conventional commits, relative imports, and named exports, and is tested with Vitest.

## Coding Conventions

- **File Naming:** Use `camelCase` for file names.
  - Example: `dailyBriefingBot.ts`, `messageFormatter.test.ts`

- **Import Style:** Use relative imports for modules within the project.
  ```typescript
  import { formatBriefing } from './messageFormatter';
  ```

- **Export Style:** Use named exports for all modules.
  ```typescript
  // In messageFormatter.ts
  export function formatBriefing(data: BriefingData): string { ... }
  ```

- **Commit Messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/) with prefixes like `feat`, `docs`, and `chore`.
  - Example: `feat: add Gemini integration for daily summaries`

## Workflows

### Feature Development Spec-Plan-Implementation-Tests
**Trigger:** When adding a significant new feature or module  
**Command:** `/new-feature`

1. **Write a design spec**  
   Create a markdown file describing the new feature in `docs/superpowers/specs/`.
   - Example: `docs/superpowers/specs/daily-summary.md`

2. **Write an implementation plan**  
   Outline the technical approach in `docs/superpowers/plans/`.
   - Example: `docs/superpowers/plans/daily-summary-plan.md`

3. **Implement the feature**  
   Add code and types in the appropriate `src/` subdirectory.
   - Example:
     ```typescript
     // src/dailySummary.ts
     export function generateDailySummary(data: Data): Summary { ... }
     ```

4. **Write unit tests**  
   Create or update corresponding `*.test.ts` files.
   - Example:
     ```typescript
     // src/dailySummary.test.ts
     import { describe, it, expect } from 'vitest';
     import { generateDailySummary } from './dailySummary';

     describe('generateDailySummary', () => {
       it('should return a summary for valid data', () => {
         // test implementation
       });
     });
     ```

5. **Update documentation**  
   Revise the spec or plan as needed to reflect implementation details.

---

### Project Setup or Infra Upgrade
**Trigger:** When initializing a new project, upgrading toolchain, or updating CI/CD and deployment infrastructure  
**Command:** `/setup-infra`

1. **Add or update configuration files**  
   - `package.json`, `tsconfig.json`, `eslint.config.js`, `.prettierrc.json`, `vitest.config.ts`, `.gitignore`

2. **Add or update Docker support**  
   - `Dockerfile`, `.dockerignore`

3. **Add or update CI workflows**  
   - `.github/workflows/*.yml`

4. **Update onboarding documentation**  
   - `README.md`, `.env.example`

5. **Add or update external integration manifests**  
   - `slack-app-manifest.yaml`

---

## Testing Patterns

- **Framework:** [Vitest](https://vitest.dev/)
- **Test File Pattern:** All test files are named with the `.test.ts` suffix and are placed alongside the code they test.
  - Example: `src/messageFormatter.test.ts`
- **Test Example:**
  ```typescript
  import { describe, it, expect } from 'vitest';
  import { formatBriefing } from './messageFormatter';

  describe('formatBriefing', () => {
    it('formats the briefing message correctly', () => {
      const result = formatBriefing({ ... });
      expect(result).toContain('Summary:');
    });
  });
  ```

## Commands

| Command        | Purpose                                                      |
|----------------|--------------------------------------------------------------|
| /new-feature   | Start the feature development workflow (spec, plan, code, test, docs) |
| /setup-infra   | Run project setup or infrastructure upgrade workflow          |
```