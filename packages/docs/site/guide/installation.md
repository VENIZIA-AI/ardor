# Installation

Get started with ARDOR UI in your React application.

## Prerequisites

Before installing ARDOR, ensure you have:

- **React** 19 or higher
- **Tailwind CSS** v4.0 or higher
- **Bun** 1.3+ (or npm/pnpm/yarn)

## Installation

### 1. Install the Package

::: code-group
```bash [bun]
bun add @venizia/ardor-admin
```

```bash [npm]
npm install @venizia/ardor-admin
```

```bash [pnpm]
pnpm add @venizia/ardor-admin
```
:::

### 2. Configure Tailwind CSS

ARDOR requires Tailwind CSS v4. Add the ARDOR styles to your main CSS file:

```css
/* app/index.css or src/index.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400..900&display=swap');
@import '@venizia/ardor-admin/styles/default.css';

/* Point Tailwind to scan ARDOR components */
@source '../node_modules/@venizia/ardor-admin';
```

::: tip
ARDOR uses the Inter font by default. You can customize this in your CSS.
:::

### 3. Import and Use Components

```tsx
import { Button, Card, CardHeader, CardTitle } from '@venizia/ardor-admin'

export default function App() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hello ARDOR</CardTitle>
      </CardHeader>
    </Card>
  )
}
```

## Path Aliases (Optional)

ARDOR supports path aliases for cleaner imports. Add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/components/*": ["./node_modules/@venizia/ardor-admin/dist/components/*"],
      "@/ui/*": ["./node_modules/@venizia/ardor-admin/dist/components/shadcn/*"],
      "@/hooks/*": ["./node_modules/@venizia/ardor-admin/dist/hooks/*"],
      "@/utilities/*": ["./node_modules/@venizia/ardor-admin/dist/utilities/*"]
    }
  }
}
```

Now you can use:

```tsx
import { Button } from '@/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
```

## TypeScript Configuration

For best results, enable strict mode in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx"
  }
}
```

## Next Steps

- [Browse Components](/components/) - Explore all available components
- [Theming Guide](/guide/theming) - Customize colors and styles
- [Examples](/examples/quick-start) - See complete examples

## Troubleshooting

### Tailwind classes not working

Make sure you've added the `@source` directive pointing to `@venizia/ardor-admin` in your CSS file.

### Type errors

Ensure you're using TypeScript 5.0+ and React 19+.

### Styles not loading

Verify the `@import '@venizia/ardor-admin/styles/default.css'` line is at the top of your CSS file.
