# Security Policy

## Supported Scope

Triad Workbench is a local-first desktop app. The main security-sensitive areas are:

- subprocess execution
- git worktree isolation
- prompt and artifact persistence
- archive path handling
- promotion back to the main checkout

## Reporting A Vulnerability

If you discover a security issue, please do not open a public issue with exploit details first.

Instead:

1. Prepare a short private report with:
   - affected area
   - steps to reproduce
   - impact
   - suggested mitigation if known
2. Share it with the maintainers through the private channel used for this repository.

If no private channel exists yet, open a minimal public issue that says a security report is available without publishing exploit details.

## Current Security Principles

- Workflows should operate inside isolated git worktrees
- Main checkout promotion should remain explicit
- Review, compare, and monitor flows should remain read-only by design
- Archive and worktree writes should stay inside intended roots
- Interactive terminals and agent execution should be bounded by the selected runner
