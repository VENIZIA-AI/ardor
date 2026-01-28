# ARDOR Suggested Commands

## Setup & Installation

```bash
# Install all dependencies (runs force-update via postinstall)
bun install

# Setup git hooks for pre-commit linting
make setup-hooks
```

## Building

```bash
# Build all packages
make build

# Build admin package specifically  
make admin

# Clean build artifacts
make clean

# Rebuild admin (clean + gen:index + build)
bun run --filter "@venizia/ardor-admin" rebuild
```

## Development

```bash
# Regenerate barrel exports (index.ts) for admin package
bun run --filter "@venizia/ardor-admin" gen:index

# Add a new shadcn component
cd packages/admin
bunx shadcn@latest add <component-name>

# Force update @venizia dependencies from NPM
make update-admin
```

## Linting & Formatting

```bash
# Lint all packages
make lint

# Lint admin package only
make lint-admin

# Auto-fix linting issues in admin
bun run --filter "@venizia/ardor-admin" lint:fix

# Check Prettier formatting
bun run --filter "@venizia/ardor-admin" prettier:cli

# Auto-fix Prettier formatting
bun run --filter "@venizia/ardor-admin" prettier:fix
```

## Testing

Currently no test infrastructure is set up.

## Git Commands

```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name

# Commit with conventional commit format
git commit -m "feat: add new component"

# Push and create PR (target develop branch)
git push origin feature/your-feature-name
```

## Package-Specific Commands

```bash
# Run any script in admin package
bun run --filter "@venizia/ardor-admin" <script-name>

# Available admin scripts:
# - build          : Compile TypeScript
# - clean          : Remove dist/
# - rebuild        : Clean + gen:index + build
# - gen:index      : Regenerate barrel exports
# - lint           : Run ESLint + Prettier check
# - lint:fix       : Auto-fix ESLint + Prettier
# - force-update   : Update @venizia deps from NPM
```

## Useful Development Commands

```bash
# List all files in packages
ls -la packages/

# Find TypeScript files
find packages/admin/src -name "*.tsx" -o -name "*.ts"

# Search for text in codebase
grep -r "search-term" packages/admin/src/

# View git status
git status

# View git diff
git diff

# View recent commits
git log --oneline -10
```

## System Commands (Linux)

Standard Linux commands are available:
- `ls`, `cd`, `pwd` - Navigation
- `cat`, `head`, `tail` - File viewing
- `grep`, `find` - Searching
- `git` - Version control
- `make` - Build orchestration
