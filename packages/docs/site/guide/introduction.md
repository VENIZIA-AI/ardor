# Introduction

ARDOR is a React UI Kit built on industry-proven foundations: Radix UI primitives, shadcn/ui patterns, and Tailwind CSS v4.

## What is ARDOR?

ARDOR provides 40+ accessible React components designed for modern web applications. It combines:

- **Radix UI** for accessibility and unstyled primitives
- **shadcn/ui** patterns for component architecture
- **Tailwind CSS v4** for styling with OKLCH colors
- **Custom adaptive components** for responsive design

## Key Features

### 🎨 Modern Styling

Built with Tailwind CSS v4's OKLCH color system for perceptually uniform colors and advanced theming.

```css
/* ARDOR uses OKLCH for more accurate color representation */
oklch(0.5 0.2 180) /* cyan */
oklch(0.7 0.15 30) /* warm orange */
```

### ♿ Accessible by Default

All components use Radix UI primitives with:
- WCAG 2.1 AA compliance
- Full keyboard navigation
- Screen reader support
- Proper ARIA attributes
- Focus management

### 📱 Adaptive Components

Unique components that automatically switch between desktop (Dialog/Popover) and mobile (Drawer) layouts:

```tsx
// Automatically becomes a Drawer on mobile!
<AdaptiveDialog>
  <AdaptiveDialogTrigger>Open</AdaptiveDialogTrigger>
  <AdaptiveDialogContent>
    {/* Content works on both desktop and mobile */}
  </AdaptiveDialogContent>
</AdaptiveDialog>
```

### ⚡ TypeScript First

Complete type safety with:
- React 19
- Strict TypeScript mode
- Comprehensive type definitions
- IntelliSense support

### 🔧 Fully Customizable

Full control over styling:
- CSS variables for theming
- CVA (class-variance-authority) for variants
- Tailwind utilities
- Easy style overrides

### 🎯 Developer Experience

- Path aliases (`@/components`, `@/ui`, etc.)
- Auto-generated exports
- Patterns inspired by shadcn/ui
- Bun monorepo for fast builds

## When to Use ARDOR

ARDOR is ideal for:

- **Admin dashboards** - Complex data-heavy interfaces
- **SaaS applications** - Multi-tenant web apps
- **Internal tools** - Business applications
- **Content management** - CMS and publishing platforms
- **Any React app** needing accessible, customizable components

## Architecture

ARDOR follows a layered component architecture:

```
shadcn/ (Base UI primitives from shadcn/ui)
  ↓
core/ (Custom components built on shadcn)
  ├── adaptive/ (Responsive desktop↔mobile components)
  ├── common/ (Shared utility components)
  └── backdrop/ (Backdrop and overlay utilities)
  ↓
Your App (Compose and customize)
```

## Comparison

| Feature | ARDOR | shadcn/ui | Radix UI |
|---------|-------|-----------|----------|
| Pre-built components | ✓ | ✓ (via CLI) | ✗ |
| NPM package | ✓ | ✗ | ✓ |
| Tailwind CSS v4 | ✓ | ✗ (v3) | ✗ |
| OKLCH colors | ✓ | ✗ | ✗ |
| Adaptive components | ✓ | ✗ | ✗ |
| TypeScript | ✓ | ✓ | ✓ |
| Customizable | ✓ | ✓ | ✓ |
| Copy-paste code | ✗ | ✓ | ✗ |

**Key Difference**: ARDOR is distributed as an NPM package, while shadcn/ui uses a CLI to copy components into your project. ARDOR also includes unique adaptive components and uses Tailwind CSS v4.

## Philosophy

ARDOR embraces the **"progressive disclosure"** approach:

1. **Start simple** - Use components out of the box
2. **Customize styling** - Override with CSS variables and Tailwind
3. **Extend functionality** - Build on top of ARDOR primitives
4. **Copy and modify** - Fork components if you need full control

## Tech Stack

- **React 19** - Latest React features
- **Radix UI** - Unstyled, accessible primitives
- **Tailwind CSS v4** - Utility-first styling with OKLCH
- **class-variance-authority** - Variant management
- **lucide-react** - Icon library
- **TypeScript 5+** - Type safety

## Next Steps

- [Installation](/guide/installation) - Get started with ARDOR
- [Components](/components/) - Browse all components
- [Theming](/guide/theming) - Customize colors and styles *(coming soon)*
- [Examples](/examples/quick-start) - See complete examples *(coming soon)*

## Community & Support

- **GitHub**: [VENIZIA-AI/ardor](https://github.com/VENIZIA-AI/ardor)
- **Issues**: Report bugs or request features
- **Discussions**: Ask questions and share ideas

## License

ARDOR is open source software licensed under the [MIT License](https://github.com/VENIZIA-AI/ardor/blob/main/LICENSE.md).
