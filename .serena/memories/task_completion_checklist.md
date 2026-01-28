# ARDOR Task Completion Checklist

When completing a development task, follow this checklist:

## 1. Code Quality

```bash
# Run linting and auto-fix issues
bun run --filter "@venizia/ardor-admin" lint:fix

# Or run separately:
bun run --filter "@venizia/ardor-admin" eslint --fix
bun run --filter "@venizia/ardor-admin" prettier:fix
```

## 2. Regenerate Exports (if needed)

If you added/modified files in these directories:
- `src/components/`
- `src/hooks/`
- `src/utilities/`

Run:
```bash
bun run --filter "@venizia/ardor-admin" gen:index
```

## 3. Build Verification

```bash
# Build the admin package
make admin

# Or full rebuild (clean + gen:index + build)
bun run --filter "@venizia/ardor-admin" rebuild
```

## 4. Pre-commit Checks

If git hooks are set up (`make setup-hooks`), these run automatically on commit:
- Linting all packages via `make lint`

If not set up, run manually:
```bash
make lint
```

## 5. Git Commit

Use conventional commit format:
```bash
git add .
git commit -m "feat: add new adaptive component"
# or
git commit -m "fix: correct button styling"
# or  
git commit -m "docs: update component examples"
```

## 6. Before Creating PR

- [ ] Ensure you're on a feature branch (not develop/main)
- [ ] All linting passes
- [ ] Build succeeds without errors
- [ ] Commit messages follow conventions
- [ ] Branch is up-to-date with develop

```bash
# Update branch with latest develop
git fetch origin
git merge origin/develop

# Or rebase
git rebase origin/develop
```

## 7. Testing

Currently no automated tests exist. When tests are added:
- Run test suite before committing
- Add tests for new features
- Ensure all tests pass

## Common Issues

### Import Errors After Adding Components
**Solution**: Regenerate exports
```bash
bun run --filter "@venizia/ardor-admin" gen:index
```

### Linting Fails on shadcn Components
**Solution**: shadcn/ is already ignored in eslint.config.mjs, but if needed:
- Don't manually lint shadcn/ directory
- Focus on custom code in core/, hooks/, utilities/

### Build Fails with Path Alias Errors
**Solution**: Ensure tsc-alias runs after tsc
```bash
# The build.sh script should have:
tsc -p tsconfig.build.json && tsc-alias -p tsconfig.build.json
```

### Pre-commit Hook Not Running
**Solution**: Setup hooks
```bash
make setup-hooks
```

## Special Cases

### Adding shadcn Components
After running `bunx shadcn@latest add <component>`:
1. Component appears in `src/components/shadcn/`
2. Run `gen:index` to export it
3. Build the package

### Modifying Dependencies
After changing package.json dependencies:
```bash
bun install
make build
```

### Force Updating @venizia Packages
```bash
make update-admin
bun install
```
