# ARDOR Codebase Structure

## Repository Layout

```
ardor/
├── packages/                    # Monorepo packages
│   └── admin/                   # @venizia/ardor-admin package
│       ├── src/
│       │   ├── components/      # React components
│       │   │   ├── shadcn/     # shadcn/ui base components (auto-generated)
│       │   │   ├── core/       # Custom core components
│       │   │   │   ├── adaptive/     # Adaptive responsive components
│       │   │   │   ├── backdrop/     # Backdrop utilities
│       │   │   │   └── common/       # Shared components
│       │   │   └── icons/      # Icon components
│       │   ├── hooks/           # React custom hooks
│       │   │   └── use-mobile.ts    # Mobile detection hook
│       │   ├── utilities/       # Utility functions
│       │   │   └── tw.utility.ts    # Tailwind merge utility (cn function)
│       │   ├── styles/          # Global CSS
│       │   │   └── globals.css       # Theme variables and base styles
│       │   ├── generate-index.ts     # Script to auto-generate barrel exports
│       │   └── index.ts              # Auto-generated barrel exports (DON'T EDIT)
│       ├── scripts/             # Build and utility scripts
│       │   ├── build.sh              # TypeScript compilation
│       │   ├── rebuild.sh            # Full rebuild process
│       │   ├── clean.sh              # Clean dist/
│       │   └── force-update.sh       # Update @venizia deps
│       ├── dist/                # Compiled output (generated)
│       ├── components.json      # shadcn/ui configuration
│       ├── tsconfig.json        # TypeScript config
│       ├── tsconfig.build.json  # Build-specific TS config
│       ├── eslint.config.mjs    # ESLint configuration
│       ├── .prettierrc.mjs      # Prettier configuration
│       └── package.json         # Package manifest
├── .githooks/                   # Git hooks
│   └── pre-commit              # Runs make lint before commits
├── .github/                     # GitHub configuration
│   ├── workflows/              # CI/CD workflows
│   │   ├── deploy-docs.yml          # Documentation deployment
│   │   └── package-release.yml      # NPM package releases
│   └── ISSUE_TEMPLATE/         # Issue templates
├── Makefile                     # Build orchestration
├── package.json                 # Root workspace config
├── bun.lock                     # Bun lockfile
├── CLAUDE.md                    # AI assistant guidance
├── CONTRIBUTING.md              # Contribution guidelines
├── CODE_OF_CONDUCT.md          # Community guidelines
└── README.md                    # Project README
```

## Component Architecture

### Layered Approach
1. **Base Layer (shadcn/)**: Auto-generated components from shadcn/ui CLI
   - Built on Radix UI primitives
   - Can be modified after generation
   - Examples: Button, Dialog, Select, Dropdown

2. **Core Layer (core/)**: Custom components built on base layer
   - **adaptive/**: Components that adapt between desktop/mobile
     - AdaptiveDialog (Dialog on desktop, Sheet on mobile)
     - AdaptivePopover (Popover on desktop, Drawer on mobile)
   - **common/**: Shared utility components (e.g., ComingSoon)
   - **backdrop/**: Backdrop and overlay utilities

3. **Icons Layer (icons/)**: Icon components using lucide-react

### Component Composition Pattern
- Components use Radix UI primitives as foundation
- Styled with Tailwind CSS utility classes
- Variants managed with class-variance-authority (cva)
- Responsive behavior handled at component level

## Build Architecture

### Compilation Flow
1. **TypeScript Compilation**: `tsc -p tsconfig.build.json`
   - Compiles `src/` to `dist/`
   - Generates `.d.ts` declaration files
   
2. **Path Alias Resolution**: `tsc-alias -p tsconfig.build.json`
   - Resolves `@/*` imports to relative paths
   - Required because tsc doesn't resolve path aliases in output

3. **Index Generation**: `bun src/generate-index.ts` (before build)
   - Scans components/, hooks/, utilities/
   - Creates barrel exports in src/index.ts
   - Excludes test files and existing index.ts

### Build Orchestration
- **Makefile**: Root-level build orchestration
- **Shell scripts**: Package-level build steps (packages/admin/scripts/)
- **Bun filters**: Target specific packages (`--filter "@venizia/ardor-admin"`)

## Export System

All public APIs are exported via auto-generated `src/index.ts`:

```typescript
// Auto-scanned directories:
- src/components/**/*
- src/hooks/**/*  
- src/utilities/**/*

// Exclusions:
- *.test.ts, *.test.tsx
- *.d.ts
- index.ts files
```

Consumers import like:
```typescript
import { Button, AdaptiveDialog, useMobile } from '@venizia/ardor-admin';
```

## Configuration Files

- **tsconfig.json**: Base TypeScript config, extends @venizia/dev-configs
- **tsconfig.build.json**: Build-specific overrides
- **eslint.config.mjs**: ESLint config, ignores shadcn/ directory
- **components.json**: shadcn/ui configuration (style: "new-york", base color: zinc)
- **.prettierrc.mjs**: Prettier with Tailwind plugin

## Key Patterns

1. **Auto-generation**: index.ts and shadcn components are auto-generated
2. **Path Aliases**: All imports use @/* aliases resolved at build time
3. **Shell Scripts**: Build process uses bash scripts rather than npm scripts
4. **Workspace Filters**: Bun's `--filter` targets specific packages
5. **Monorepo Structure**: Single workspace with packages/* pattern
