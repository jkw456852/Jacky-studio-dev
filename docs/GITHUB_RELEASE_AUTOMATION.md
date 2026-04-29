# GitHub Release Automation

This repository is configured to create a GitHub Release automatically when you push a version tag that starts with `v`.

## Trigger rule

Push any tag like:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Or:

```bash
git tag v0.1.1
git push origin v0.1.1
```

## What happens automatically

- GitHub Actions runs the workflow in `.github/workflows/release-on-tag.yml`
- GitHub creates a Release for that tag
- Release notes are generated automatically from commits and pull requests
- The newest version is marked as `Latest`

## Recommended commit prefixes

If you want the generated notes to look cleaner, use commit messages like:

```text
feat: add tree node retry flow
fix: preserve refs when retrying failed image nodes
refactor: simplify workspace canvas pointer handling
docs: update project README
```

For a reusable local template and a short guideline, see:

- `./.github/commit-template.txt`
- `./docs/COMMIT_MESSAGE_GUIDELINES.md`

## Typical release flow

1. Commit your changes normally.
2. Push your branch to GitHub.
3. When you want a versioned update record, create a tag.
4. Push the tag.
5. Open the GitHub repository `Releases` page and review the generated notes.

## Notes

- This does not require Vercel, Production environments, or any deployment platform.
- If you push a tag that already has a Release, GitHub will update that Release instead of creating a second one.
- The workflow uses the repository's built-in `GITHUB_TOKEN`, so no extra secret is required for the basic setup.
