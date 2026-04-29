# Commit Message Guidelines

This repository uses short conventional commit prefixes so GitHub Releases can generate cleaner notes.

## Format

Use:

```text
<type>: <summary>
```

Examples:

```text
feat: add tree prompt retry flow
fix: keep provider and refs when retrying failed image nodes
refactor: simplify workspace node graph pointer handling
docs: add GitHub release automation guide
```

## Recommended types

- `feat`: new user-facing feature
- `fix`: bug fix or regression fix
- `refactor`: internal cleanup without intended behavior change
- `perf`: performance improvement
- `docs`: documentation only
- `chore`: tooling, workflow, release, maintenance
- `style`: visual polish or formatting-only change
- `test`: tests only

## Writing tips

- Keep the summary on one line.
- Start with a verb: `add`, `fix`, `improve`, `preserve`, `remove`.
- Focus on the user-visible outcome when possible.
- Avoid vague summaries like `update code` or `misc fixes`.

## Suggested style for this project

Prefer messages like:

```text
fix: stop tree image nodes from hanging after generation failure
fix: restore prompt node references after refresh
feat: add automatic GitHub releases on version tags
chore: rename repository remote to Jacky-Studio
```

## Relationship to Releases

When you later push tags like `v0.1.1`, GitHub Release notes are easier to read if commits already follow this format.
