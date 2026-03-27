# Release Checklist

Use this before calling a Triad Workbench build shareable.

## Product Checks

- Open an existing git project successfully
- Probe all configured agents
- Connect Claude, Codex, Gemini, and Ollama as applicable
- Run at least one successful coding workflow
- Run at least one failed workflow and verify logs are preserved
- Cancel a running workflow and confirm the app does not hang
- Review artifacts, findings, and diff in the review center
- Test `Apply to main`, `Keep worktree`, and `Open task branch`

## Technical Checks

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run dist:win` for installer validation

## Documentation Checks

- `README.md` matches real capabilities
- `docs/USER_GUIDE.md` is current
- `SECURITY.md` still reflects supported reporting and risk model
- Screenshot and slide decks are current

## GitHub Checks

- CI workflow passes on the default branch
- Issue templates render correctly
- License is present
- Repository description and topics are filled in
- First release notes are drafted
