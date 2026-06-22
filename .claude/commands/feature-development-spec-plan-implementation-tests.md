---
name: feature-development-spec-plan-implementation-tests
description: Workflow command scaffold for feature-development-spec-plan-implementation-tests in slack-gemini-daily-briefing-bot.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-development-spec-plan-implementation-tests

Use this workflow when working on **feature-development-spec-plan-implementation-tests** in `slack-gemini-daily-briefing-bot`.

## Goal

Adds a new feature by first writing a design spec, then an implementation plan, followed by implementation code and tests, and updating the relevant documentation.

## Common Files

- `docs/superpowers/specs/*.md`
- `docs/superpowers/plans/*.md`
- `src/**/*.ts`
- `src/**/*.test.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Write a design spec in docs/superpowers/specs/
- Write an implementation plan in docs/superpowers/plans/
- Implement the feature in src/ (code and types)
- Write unit tests for new code in corresponding *.test.ts files
- Update documentation/spec/plan as needed

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.