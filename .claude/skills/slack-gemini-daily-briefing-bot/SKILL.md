```markdown
# slack-gemini-daily-briefing-bot Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill covers the core development patterns and conventions used in the `slack-gemini-daily-briefing-bot` TypeScript codebase. The repository implements a Slack bot that provides daily briefings, leveraging TypeScript for type safety and maintainability. The guide details coding conventions, commit message patterns, and testing approaches to ensure consistency and quality in contributions.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names.
  - Example: `dailyBriefingBot.ts`

### Import Style
- Use **relative imports** for modules within the project.
  - Example:
    ```typescript
    import { fetchBriefing } from './fetchBriefing';
    ```

### Export Style
- Use **named exports** for all exported functions, constants, and types.
  - Example:
    ```typescript
    export function sendBriefing() { ... }
    export const BRIEFING_TIME = '09:00';
    ```

### Commit Messages
- Follow the **Conventional Commits** specification.
- Use the `feat` prefix for new features.
- Keep commit messages concise (average: 51 characters).
  - Example:
    ```
    feat: add support for custom briefing time
    ```

## Workflows

### Feature Development
**Trigger:** When adding a new feature to the bot  
**Command:** `/feature-development`

1. Create a new branch for your feature.
2. Implement the feature using camelCase file naming and relative imports.
3. Export new functions or constants using named exports.
4. Write or update relevant tests (`*.test.*`).
5. Commit changes with a `feat:` prefix and a concise message.
6. Open a pull request for review.

### Testing
**Trigger:** When verifying code correctness  
**Command:** `/run-tests`

1. Identify or create test files matching the `*.test.*` pattern.
2. Write tests for new or modified functionality.
3. Run the test suite using your preferred test runner.
4. Ensure all tests pass before merging changes.

## Testing Patterns

- Test files follow the `*.test.*` naming convention (e.g., `dailyBriefingBot.test.ts`).
- The specific testing framework is not detected, but standard TypeScript testing approaches apply.
- Example test structure:
  ```typescript
  import { sendBriefing } from './sendBriefing';

  test('sends briefing at correct time', () => {
    // Test implementation here
  });
  ```

## Commands
| Command                | Purpose                                  |
|------------------------|------------------------------------------|
| /feature-development   | Start the feature development workflow   |
| /run-tests             | Run the test suite                       |
```
