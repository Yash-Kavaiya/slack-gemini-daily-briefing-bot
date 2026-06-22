---
name: project-setup-or-infra-upgrade
description: Workflow command scaffold for project-setup-or-infra-upgrade in slack-gemini-daily-briefing-bot.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /project-setup-or-infra-upgrade

Use this workflow when working on **project-setup-or-infra-upgrade** in `slack-gemini-daily-briefing-bot`.

## Goal

Sets up or upgrades project infrastructure, including toolchain, CI/CD, Docker, and documentation for onboarding.

## Common Files

- `package.json`
- `tsconfig.json`
- `eslint.config.js`
- `.prettierrc.json`
- `vitest.config.ts`
- `.gitignore`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Add or update configuration files for TypeScript, linting, formatting, and testing
- Add or update Dockerfile and .dockerignore for containerization
- Add or update GitHub Actions workflow for CI
- Add or update README and example environment files for onboarding
- Add or update manifest files for external integrations (e.g., Slack)

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.