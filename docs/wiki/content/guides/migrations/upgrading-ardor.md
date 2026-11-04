# Upgrading ARDOR

Every ARDOR release is listed in the [changelogs](../../changelogs/) with who is affected and what to do. A release that changes a few names comes with a batch overview: a table of every change since the last overview, and an ordered checklist. This page says which one to read for the version you are on, and how to run the codemod that moves the names removed in 0.4.7.

## Rules for every upgrade

- **Move the four packages together.** `@venizia/ardor`, `@venizia/ardor-kernel`, `@venizia/ardor-react` and `@venizia/ardor-admin` carry the same version. Do not mix versions.
- **Move every `@venizia/ignis-*` package to a version that satisfies the new peers.** The ranges are in each ARDOR `package.json`, and the overview of the release lists them.
- **Read the releases in order.** Start at the row of your version and go down the table.

## Which entry to read

| You are on | You move to | Read |
|------------|-------------|------|
| 0.4.0 or older | 0.4.1 | [ARDOR 0.4.0](../../changelogs/2026-10-24-ardor-0-4-0) and [ARDOR 0.4.1](../../changelogs/2026-10-25-ardor-0-4-1) |
| 0.4.1 | 0.4.3 | [Everything since 0.4.1](../../changelogs/2026-10-25-batch-overview) |
| 0.4.3 | 0.4.4 | [Everything since 0.4.3](../../changelogs/2026-10-26-batch-overview) |
| 0.4.4 | 0.4.5 | [Everything since 0.4.4](../../changelogs/2026-10-28-batch-overview) |
| 0.4.5 | 0.4.6 | No changelog entry: the release holds repository and preset fixes only |
| 0.4.6 | 0.4.7 | [Everything since 0.4.6](../../changelogs/2026-11-02-batch-overview); run the codemod below |
| 0.4.7 | 0.4.8 | [Everything since 0.4.7](../../changelogs/2026-11-05-batch-overview) |

## The codemod

`ardor codemod namespace` moves the names that 0.4.7 removed from `@venizia/ardor` to the class members that replace them, in your source files. The list of old and new names is in [how to update your project](../../changelogs/2026-11-01-class-namespaces#how-to-upgrade). It reads syntax only, so a name that the file also declares itself, a re-export by name and a class name already taken are listed with their line and left for you.

It needs `typescript` `>=5.0.0`, an optional peer of `@venizia/ardor`; without it the command exits with code 2. It reads `.ts`, `.tsx`, `.mts` and `.cts` files, not `.d.ts`. Commit your work first, then preview, write, and run your formatter:

```bash
bun run ardor codemod namespace src
bun run ardor codemod namespace src --write
```

`bun run ardor` works in a package whose `package.json` depends on `@venizia/ardor`.

| Flag | What it does |
|------|--------------|
| none | Lists what would change and writes nothing. |
| `--write` | Writes the changed files. Inside a git repository, a file with local changes (changed, staged or untracked) is refused, so git can undo the codemod. |
| `--allow-dirty` | With `--write`, also writes a file that has local changes, such as one another codemod just changed. |
| `--check` | A dry run that exits 1 when anything would change or is left; for CI. It cannot go with `--write`. |
| `--hooks` | Also moves a hook imported from `@venizia/ardor` to the `Ardor` namespace: `useRepository()` becomes `Ardor.useRepository()`. A hook imported from `@venizia/ardor-react` or `@venizia/ardor-admin` is never touched. |
| `--help` | Prints the usage and exits. |

The command prints one line per finding and a summary:

- `refused <path>`: the file has local changes. Commit or stash it, or add `--allow-dirty`.
- `left <path>:<line> <name>`: the codemod could not rewrite it. Change it by hand.
- `note <path>:<line> <name>`: a change made on purpose that is worth knowing. `--check` ignores it.

The exit code is 0 when the run is done, 1 when a file was refused or `--check` found work, and 2 for an unknown option, a pair of options that contradict each other (`--write` with `--check`, `--allow-dirty` without `--write`), or when `typescript` is not installed.
