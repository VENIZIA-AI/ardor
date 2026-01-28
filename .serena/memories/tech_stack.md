# ARDOR Tech Stack

## Runtime & Package Manager
- **Bun** >= 1.3 (package manager, test runner, script executor)
- **Node.js** (for some build tools)

## Language
- **TypeScript 5+** (strict mode enabled)
- ESNext target with ESM modules

## UI Framework
- **React 19** with React DOM 19
- JSX transform: react-jsx

## Styling
- **Tailwind CSS v4** (peer dependency, required)
- CSS Variables for theming
- **clsx** + **tailwind-merge** for className utilities
- **class-variance-authority (cva)** for component variants
- **tw-animate-css** for animations

## Component Libraries
- **Radix UI** (@radix-ui/react-*) - Headless UI primitives
- **shadcn/ui** - Component system built on Radix
- **lucide-react** - Icon library
- **cmdk** - Command palette
- **next-themes** - Theme switching
- **sonner** - Toast notifications
- **vaul** - Drawer component
- **react-day-picker** - Date picker

## Build Tools
- **TypeScript Compiler (tsc)** - Compiles TypeScript to JavaScript
- **tsc-alias** - Resolves path aliases (@/*) after compilation
- Shell scripts (bash) for build orchestration

## Code Quality
- **ESLint 9** with @venizia/dev-configs
- **Prettier 3.6** with prettier-plugin-tailwindcss
- Pre-commit hooks for linting

## Development Tools
- **shadcn CLI** - Component generation
- Custom index generator (generate-index.ts) for barrel exports

## Monorepo Structure
- Bun workspaces
- packages/* pattern
- No separate build tools like Turborepo (uses Makefile + Bun filters)
