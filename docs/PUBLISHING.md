# Publishing Triad Workbench

This guide is for turning the local Triad Workbench repository into a clean public or private GitHub repository that other people can clone, review, and run.

## Before You Push

Make sure the repository includes:

- `README.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`
- `.github/ISSUE_TEMPLATE/*`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/workflows/ci.yml`
- `docs/USER_GUIDE.md`

Then run:

```powershell
npm run typecheck
npm test
npm run build
```

## Decide Repository Visibility

- Use `private` if the codebase still includes experiments, local-only infrastructure, or unfinished security work.
- Use `public` if you want collaboration, stars, forks, downloads, issues, and release visibility.

## Recommended GitHub Repository Settings

Set these in the new GitHub repo:

- Repository name: `triad-workbench`
- Description:
  - `Local-first multi-agent coding workbench for Claude Code, Codex CLI, Gemini CLI, and Ollama.`
- Website:
  - leave empty unless you publish docs or a landing page
- Topics:
  - `electron`
  - `typescript`
  - `react`
  - `ollama`
  - `claude-code`
  - `codex`
  - `gemini`
  - `developer-tools`
  - `ai-agents`
  - `git-worktree`

Enable:

- Issues
- Discussions (optional but recommended)
- Actions
- Pull requests
- Releases

## Add The Remote

Create the GitHub repository first, then connect the local repo:

```powershell
git remote add origin https://github.com/<your-user-or-org>/triad-workbench.git
git branch -M main
git push -u origin main
```

If you want to keep `production-hardening` as the main working branch:

```powershell
git remote add origin https://github.com/<your-user-or-org>/triad-workbench.git
git push -u origin production-hardening
```

## First Release Checklist

Before the first tagged release:

1. Confirm the screenshot in `triad-workbench-preview.png` is current.
2. Review `README.md` for stale workflow or feature claims.
3. Confirm the installer path works with:
   - `npm run dist:win`
4. Test onboarding for:
   - Claude
   - Codex
   - Gemini
   - Ollama
5. Confirm at least one full workflow succeeds on a real git project.
6. Confirm a failed workflow still preserves logs and artifacts.
7. Confirm app restart does not leave broken runtime state.

## Make The Repo More Downloadable And Trustworthy

To improve adoption after publishing:

- keep the screenshot and slide decks up to date
- add a release every time installer behavior changes materially
- use GitHub Releases for downloadable Windows builds
- keep CI green on the default branch
- write short release notes with:
  - user-facing changes
  - bug fixes
  - upgrade notes

## Suggested Release Notes Shape

Use a simple structure:

- What changed
- Why it matters
- What to test
- Known limits

## License

This repo now includes an MIT license, which is a good default if you want broad reuse and contribution with minimal friction. You can still change the license later before wider distribution if your goals change.
