# ARDOR

A UI Kit library built by [VENIZIA AI](https://venizia.ai). Provides production-ready React components with Tailwind CSS v4, Radix UI primitives, and shadcn/ui integration.

## Packages

| Package | Description | NPM |
|---------|-------------|-----|
| [`@venizia/ardor-ui-kit`](./packages/ui-kit) | Core UI components library | [![npm](https://img.shields.io/npm/v/@venizia/ardor-ui-kit)](https://www.npmjs.com/package/@venizia/ardor-ui-kit) |
| [`docs`](./packages/docs) | VitePress documentation site | - |

## Quick Start

**Prerequisites:** [Bun](https://bun.sh) >= 1.3

```bash
# Install dependencies
bun install

# Build all packages
make build

# Start docs dev server
make docs-dev
```

## Development

```bash
# Lint all packages
make lint

# Build ui-kit package
make ui-kit

# Regenerate barrel exports after adding components
bun --filter "@venizia/ardor-ui-kit" run gen:index

# Auto-fix lint issues
bun --filter "@venizia/ardor-ui-kit" run lint:fix
```

### Adding Components

**shadcn/ui components:**

```bash
cd packages/ui-kit
bunx shadcn@latest add <component-name>
```

**Custom components:** Create in `packages/ui-kit/src/components/core/` under the appropriate subdirectory (`adaptive/`, `backdrop/`, `common/`, or `input/`).

## Usage

Install the published package in your project:

```bash
npm install @venizia/ardor-ui-kit
```

Import the default theme in your CSS:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
@import '@venizia/ardor-ui-kit/styles/default.css';
@source '../node_modules/@venizia/ardor-ui-kit';
```

## Git Workflow

- PRs target `develop` (never `main` directly)
- Branches: `feature/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>`
- [Conventional Commits](https://www.conventionalcommits.org/) required

## Tech Stack

- React 19 + TypeScript (strict)
- Tailwind CSS v4
- Radix UI primitives
- shadcn/ui (new-york style)
- Bun workspace monorepo

## License

MIT
