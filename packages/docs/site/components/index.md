# Components

ARDOR provides 40+ React components built on Radix UI and styled with Tailwind CSS v4.

## Form Components

- [Button](/components/button) - Clickable button with variants and sizes
- [Input](/components/input) - Text input field *(coming soon)*
- [Checkbox](/components/checkbox) - Checkbox input *(coming soon)*
- [Select](/components/select) - Dropdown select *(coming soon)*

## Data Display

- [Card](/components/card) - Content container *(coming soon)*
- [Table](/components/table) - Data tables *(coming soon)*
- [Badge](/components/badge) - Status badges *(coming soon)*

## Overlay

- [Dialog](/components/dialog) - Modal dialog *(coming soon)*
- [Tabs](/components/tabs) - Tab navigation *(coming soon)*

## Adaptive Components ⭐

ARDOR's unique responsive components that automatically adapt between desktop and mobile layouts:

- [Adaptive Dialog](/components/adaptive-dialog) - Desktop modal ↔ Mobile drawer
- Adaptive Popover - Desktop popover ↔ Mobile drawer *(coming soon)*

## Component Philosophy

All ARDOR components follow these principles:

### Accessibility First
Every component is built on Radix UI primitives with:
- WCAG 2.1 AA compliance
- Full keyboard navigation
- Screen reader support
- ARIA attributes

### Customizable
- CSS variables for theming
- CVA (class-variance-authority) for variants
- Tailwind utilities for styling
- Easy to override styles

### TypeScript Native
- Strict TypeScript definitions
- Comprehensive type safety
- IntelliSense support

### Modern Styling
- Tailwind CSS v4
- OKLCH color system
- Perceptually uniform colors
- Dark mode support

## Installation

Install the full package to get all components:

```bash
bun add @venizia/ardor-admin
```

Or use shadcn CLI to add individual components:

```bash
bunx shadcn@latest add button
```

## Usage

Import components from the package:

```tsx
import { 
  Button, 
  Card, 
  CardHeader, 
  CardTitle 
} from '@venizia/ardor-admin'
```

## Next Steps

- [Installation Guide](/guide/installation) - Set up ARDOR in your project
- [Button Component](/components/button) - See a fully documented example
- [Adaptive Dialog](/components/adaptive-dialog) - Explore unique ARDOR features
