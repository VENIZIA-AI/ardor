# Button

Displays a button or a component that looks like a button.

## Installation

```bash
bunx shadcn@latest add button
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Button } from '@venizia/ardor-admin'

export default function Example() {
  return <Button>Click me</Button>
}
```

## Examples

### Variants

The Button component supports multiple visual variants:

```tsx
<Button variant="default">Default</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
<Button variant="default-active">Default Active</Button>
```

### Sizes

Different button sizes for various use cases:

```tsx
<Button size="xs">Extra Small</Button>
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
```

### With Icons

Use Lucide React icons with buttons:

```tsx
import { ChevronRight, Mail } from 'lucide-react'

<Button>
  <Mail className="mr-2 h-4 w-4" />
  Send Email
</Button>

<Button>
  Continue
  <ChevronRight className="ml-2 h-4 w-4" />
</Button>
```

### Icon-Only Buttons

For icon-only buttons, use the icon sizes:

```tsx
import { Trash2 } from 'lucide-react'

<Button size="icon-xxs" aria-label="Delete">
  <Trash2 className="h-3 w-3" />
</Button>

<Button size="icon-xs" aria-label="Delete">
  <Trash2 className="h-3.5 w-3.5" />
</Button>

<Button size="icon-sm" aria-label="Delete">
  <Trash2 className="h-4 w-4" />
</Button>

<Button size="icon" variant="outline" aria-label="Delete">
  <Trash2 className="h-4 w-4" />
</Button>

<Button size="icon-lg" variant="outline" aria-label="Delete">
  <Trash2 className="h-4 w-4" />
</Button>
```

### As Child (Polymorphic)

Use `asChild` to render the Button as any element:

```tsx
import { Button } from '@venizia/ardor-admin'
import Link from 'next/link'

<Button asChild>
  <Link href="/dashboard">Dashboard</Link>
</Button>
```

## API Reference

### Button

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"default" \| "destructive" \| "outline" \| "secondary" \| "ghost" \| "link" \| "default-active"` | `"default"` | Visual style variant |
| `size` | `"xs" \| "sm" \| "default" \| "lg" \| "icon" \| "icon-sm" \| "icon-lg" \| "icon-xs" \| "icon-xxs"` | `"default"` | Size variant |
| `asChild` | `boolean` | `false` | Merge props into child element (uses Radix Slot) |

Extends all standard HTML `<button>` attributes.

### Data Attributes

The Button component uses these data attributes for styling:

- `data-slot="button"` - Applied to button element for styling context

## Accessibility

- **Role**: `button` (native HTML button)
- **Keyboard**: `Space` and `Enter` activate the button
- **Focus**: Visible focus ring via Tailwind's `focus-visible` utilities with 3px ring
- **ARIA**: Use `aria-label` for icon-only buttons
- **Invalid State**: `aria-invalid` applies destructive ring styling

### Best Practices

::: tip
Always provide accessible labels for icon-only buttons:
```tsx
<Button size="icon-sm" aria-label="Delete item">
  <Trash2 />
</Button>
```
:::

## Styling

### CSS Variables

The Button uses these CSS variables from your theme:

```css
--primary
--primary-foreground
--destructive
--destructive-foreground
--secondary
--secondary-foreground
--accent
--accent-foreground
--ring
--background
--input
```

### Focus Ring Behavior

ARDOR buttons feature an advanced focus system:
- Default: 3px ring with `focus-visible:ring-[3px]`
- Icon buttons (xs/xxs): Reduced ring size for compact UI
- Invalid state: Destructive-colored ring for form validation

### Customization

To add custom variants, extend the `buttonVariants` in your local copy:

```tsx
const buttonVariants = cva(
  // base classes
  "inline-flex items-center justify-center...",
  {
    variants: {
      variant: {
        default: "...",
        custom: "bg-purple-600 text-white hover:bg-purple-700"
      }
    }
  }
)
```

## Related Components

- [Input](/components/input) - Text input fields
- [Dialog](/components/dialog) - Use buttons as dialog triggers
- [Adaptive Dialog](/components/adaptive-dialog) - Use buttons with responsive dialogs
