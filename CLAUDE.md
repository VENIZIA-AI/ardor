# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

ARDOR is a UI Kit library built by VENIZIA AI. It's a Bun-based monorepo that provides React UI components with Tailwind CSS v4, Radix UI primitives, and shadcn/ui integration.

- **Package Manager**: Bun (>= 1.3)
- **Language**: TypeScript (strict mode)
- **Main Package**: `@venizia/ardor-admin` - Admin UI Kit with React 19

## Common Commands

### Setup & Installation

```bash
# Install dependencies (also runs force-update via postinstall)
bun install
# or
make install

# Setup git hooks (runs linting before commits)
make setup-hooks
```

### Building

```bash
# Build all packages
make build
# or
make build-all

# Build admin package specifically
make admin

# Clean build artifacts
make clean
```

### Development

```bash
# Generate index.ts exports for admin package
bun --filter "@venizia/ardor-admin" run gen:index

# Force update dependencies from NPM registry
make update           # Update all packages
make update-admin     # Update admin package only
```

### Linting & Code Quality

```bash
# Lint all packages
make lint
# or
bun run --filter "./packages/*" lint

# Lint admin package only
make lint-admin

# Auto-fix linting issues
bun --filter "@venizia/ardor-admin" run lint:fix
```

### Individual Package Commands

All package-specific commands use Bun's filter syntax:

```bash
# Run any script in admin package
bun run --filter "@venizia/ardor-admin" <script-name>

# Examples:
bun run --filter "@venizia/ardor-admin" rebuild
bun run --filter "@venizia/ardor-admin" clean
bun run --filter "@venizia/ardor-admin" gen:index
```

## Architecture

### Monorepo Structure

```
ardor/
├── packages/
│   └── admin/              # @venizia/ardor-admin package
│       ├── src/
│       │   ├── components/
│       │   │   ├── shadcn/        # shadcn/ui components (auto-generated, don't edit)
│       │   │   ├── core/          # Custom core components
│       │   │   │   ├── adaptive/  # Adaptive components (responsive dialogs/popovers)
│       │   │   │   ├── backdrop/  # Backdrop utilities
│       │   │   │   └── common/    # Common shared components
│       │   │   └── icons/         # Icon components
│       │   ├── hooks/             # React hooks
│       │   ├── utilities/         # Utility functions
│       │   ├── styles/            # Global CSS and theme
│       │   ├── generate-index.ts  # Auto-generates index.ts exports
│       │   └── index.ts           # Auto-generated barrel file
│       ├── scripts/               # Build and utility shell scripts
│       └── components.json        # shadcn/ui configuration
├── .githooks/                     # Git hooks (pre-commit linting)
├── Makefile                       # Build orchestration
└── package.json                   # Root workspace config
```

### Build System

- **TypeScript Compilation**: Uses `tsc` with `tsconfig.build.json`
- **Path Alias Resolution**: `tsc-alias` resolves `@/*` imports after compilation
- **Build Scripts**: Shell scripts in `packages/admin/scripts/` (build.sh, rebuild.sh, clean.sh)
- **Auto-generated Exports**: `generate-index.ts` scans components/hooks/utilities and creates barrel exports

### Component Architecture

The admin package follows a layered component architecture:

1. **shadcn/** - Base UI primitives from shadcn/ui (auto-generated, don't manually edit)
2. **core/** - Custom components built on top of shadcn primitives:
   - **adaptive/** - Components that adapt between desktop/mobile (Dialog↔Sheet, Popover↔Drawer)
   - **common/** - Shared utility components
   - **backdrop/** - Backdrop and overlay utilities
3. **icons/** - Icon components using lucide-react

### Path Aliases

TypeScript and tooling are configured with these path aliases:

```typescript
"@/*"           → "src/*"
"@/components"  → "src/components"
"@/utilities"   → "src/utilities"
"@/hooks"       → "src/hooks"
"@/ui"          → "src/components/shadcn"
```

### Dependencies

**Core UI Stack:**
- React 19 + React DOM 19
- Tailwind CSS v4 (required peer dependency)
- Radix UI primitives (@radix-ui/react-*)
- lucide-react for icons
- class-variance-authority (cva) for component variants
- clsx + tailwind-merge for className utilities

**Build & Dev Tools:**
- @venizia/dev-configs (shared ESLint/TypeScript configs)
- shadcn CLI for component generation
- Bun for package management and scripts

## Development Workflows

### Adding New Components

1. **For shadcn components**: Use the shadcn CLI
   ```bash
   cd packages/admin
   bunx shadcn@latest add <component-name>
   ```
   This auto-generates components in `src/components/shadcn/`

2. **For custom components**: Create in `src/components/core/`
   - Place in appropriate subdirectory (adaptive/common/backdrop)
   - Follow existing patterns using Radix UI primitives

3. **After adding components**: Regenerate exports
   ```bash
   bun run --filter "@venizia/ardor-admin" gen:index
   ```

### Modifying Components

- **shadcn components**: Directly modify files in `src/components/shadcn/`
- **Core components**: Modify files in `src/components/core/`
- **Auto-export**: Changes are automatically picked up by `gen:index` during build

### Force Updating Dependencies

The `force-update.sh` script fetches latest versions of @venizia packages from NPM:

```bash
# Update to latest stable versions
make update-admin

# Update to next/canary versions
bun run --filter "@venizia/ardor-admin" force-update next
```

Currently updates: `@venizia/dev-configs`, `@venizia/ignis-inversion`, `@venizia/ignis-helpers`, `@venizia/ignis-boot`

## Git Workflow

### Branching Strategy

- `main` - Production branch (stable releases only)
- `develop` - Staging branch (active development, **default PR target**)
- Feature branches: `feature/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>`

**IMPORTANT**: Always create PRs targeting `develop`, never `main`

### Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new component
fix: correct validation logic
docs: update component examples
chore: upgrade dependencies
refactor: simplify utility function
test: add unit tests
```

### Pre-commit Hook

The repository uses a pre-commit hook that runs `make lint` on all packages. Enable it with:

```bash
make setup-hooks
```

This ensures all commits pass linting before being accepted.

## Code Style & Standards

### TypeScript

- Use **strict TypeScript** - avoid `any` types
- Prefer **interfaces** over type aliases for object shapes
- Use **explicit return types** for public functions
- Follow consistent naming conventions

### Linting

Uses `@venizia/dev-configs` for shared ESLint configuration with custom ignores:

- `src/components/shadcn/` is ignored from linting (auto-generated code)

### Formatting

Prettier is configured with:
- Tailwind CSS class sorting via `prettier-plugin-tailwindcss`
- Custom config in `.prettierrc.mjs`

## Package Publishing

The `@venizia/ardor-admin` package is published to NPM via GitHub Actions workflow (`package-release.yml`).

**Workflow**: Manual trigger with version bump selection (patch/minor/major/pre*)

**Build Process**:
1. `prepublishOnly` script runs `rebuild.sh`
2. TypeScript compilation + tsc-alias path resolution
3. Generates `dist/` with compiled JS + declaration files

**Published Files**:
- `dist/` - Compiled code
- `src/styles/` - CSS files for consumers
- `README.md`, `LICENSE.md`

## Testing Notes

Currently no test infrastructure is set up. When adding tests:
- Place test files alongside source files
- Use `.test.ts` or `.test.tsx` suffix
- These are excluded from `generate-index.ts` scanning

## Additional Context

- **Documentation Site**: Deployed via `deploy-docs.yml` workflow from `packages/docs/` (VitePress-based)
- **Component Registry**: Uses shadcn/ui registry system with custom registry support in `components.json`
- **Styling**: "new-york" style variant, zinc base color, CSS variables enabled
- **Icon Library**: lucide-react (configured in components.json)
