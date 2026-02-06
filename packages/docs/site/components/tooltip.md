# Tooltip

A popup that displays information related to an element when the element receives keyboard focus or the mouse hovers over it. Built on Radix UI Tooltip primitive.

## Installation

```bash
bunx shadcn@latest add tooltip
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@venizia/ardor-admin'

export default function Example() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>
          <p>This is a tooltip</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

## Examples

### Basic Tooltip

Simple tooltip with text:

```tsx
<Tooltip>
  <TooltipTrigger>Hover</TooltipTrigger>
  <TooltipContent>
    <p>Add to library</p>
  </TooltipContent>
</Tooltip>
```

### With Button

Tooltip on a button component:

```tsx
import { Button } from '@venizia/ardor-admin'

<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="outline">Hover me</Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Click to perform action</p>
  </TooltipContent>
</Tooltip>
```

### With Icon Button

Common pattern for icon-only buttons:

```tsx
import { Trash2 } from 'lucide-react'

<Tooltip>
  <TooltipTrigger asChild>
    <Button size="icon" variant="ghost">
      <Trash2 className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Delete item</p>
  </TooltipContent>
</Tooltip>
```

### Rich Content

Tooltip with formatted content:

```tsx
<Tooltip>
  <TooltipTrigger>Hover for info</TooltipTrigger>
  <TooltipContent>
    <div className="space-y-1">
      <p className="font-semibold">Pro Feature</p>
      <p className="text-xs">Upgrade to access this feature</p>
    </div>
  </TooltipContent>
</Tooltip>
```

### Different Sides

Position tooltip on different sides:

```tsx
<div className="flex gap-4">
  <Tooltip>
    <TooltipTrigger>Top</TooltipTrigger>
    <TooltipContent side="top">
      <p>Tooltip on top</p>
    </TooltipContent>
  </Tooltip>

  <Tooltip>
    <TooltipTrigger>Right</TooltipTrigger>
    <TooltipContent side="right">
      <p>Tooltip on right</p>
    </TooltipContent>
  </Tooltip>

  <Tooltip>
    <TooltipTrigger>Bottom</TooltipTrigger>
    <TooltipContent side="bottom">
      <p>Tooltip on bottom</p>
    </TooltipContent>
  </Tooltip>

  <Tooltip>
    <TooltipTrigger>Left</TooltipTrigger>
    <TooltipContent side="left">
      <p>Tooltip on left</p>
    </TooltipContent>
  </Tooltip>
</div>
```

### With Delay

Custom delay before showing:

```tsx
<TooltipProvider delayDuration={300}>
  <Tooltip>
    <TooltipTrigger>Delayed</TooltipTrigger>
    <TooltipContent>
      <p>Appears after 300ms</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Keyboard Shortcut

Display keyboard shortcuts in tooltips:

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="outline">Save</Button>
  </TooltipTrigger>
  <TooltipContent>
    <div className="flex items-center gap-2">
      <span>Save</span>
      <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
        <span className="text-xs">⌘</span>S
      </kbd>
    </div>
  </TooltipContent>
</Tooltip>
```

## API Reference

### TooltipProvider

Wraps your app to provide tooltip functionality.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `delayDuration` | `number` | `0` | Delay in ms before tooltip appears |
| `skipDelayDuration` | `number` | `300` | Time until delay is skipped after closing |
| `disableHoverableContent` | `boolean` | `false` | Prevents hovering over tooltip content |

### Tooltip

Root tooltip component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | - | Controlled open state |
| `defaultOpen` | `boolean` | - | Uncontrolled default open state |
| `onOpenChange` | `(open: boolean) => void` | - | Callback when open state changes |
| `delayDuration` | `number` | - | Override provider delay |

### TooltipTrigger

Element that triggers the tooltip.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props into child element |

### TooltipContent

The tooltip popup content.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `side` | `"top" \| "right" \| "bottom" \| "left"` | `"top"` | Preferred side of trigger |
| `align` | `"start" \| "center" \| "end"` | `"center"` | Alignment relative to trigger |
| `sideOffset` | `number` | `0` | Distance from trigger in pixels |
| `alignOffset` | `number` | `0` | Offset from ideal alignment |
| `className` | `string` | - | Additional CSS classes |

### Data Attributes

- `data-slot="tooltip"` - Root element
- `data-slot="tooltip-trigger"` - Trigger element
- `data-slot="tooltip-content"` - Content popup
- `data-state="open|closed"` - Current tooltip state
- `data-side="top|right|bottom|left"` - Current side

## Accessibility

Follows WAI-ARIA Tooltip pattern:

### Keyboard Interactions

- **Hover** - Shows tooltip
- **Focus** - Shows tooltip on keyboard focus
- **Escape** - Hides tooltip
- **Tab** - Moves to next focusable element

### Screen Reader Support

- Tooltip content linked via `aria-describedby`
- Trigger properly labeled
- Content announced when shown

### Best Practices

::: tip
Use tooltips for supplementary information, not critical content:
```tsx
{/* Good: Extra context */}
<Tooltip>
  <TooltipTrigger>Premium</TooltipTrigger>
  <TooltipContent>Available on Pro plan</TooltipContent>
</Tooltip>

{/* Bad: Critical information */}
{/* Use visible text instead */}
```
:::

::: tip
Keep tooltip content concise:
```tsx
<TooltipContent>
  <p>Quick, helpful tip</p>
</TooltipContent>
```
:::

::: warning
Don't use tooltips on mobile - they don't work well with touch:
```tsx
{/* Consider alternative UI for mobile */}
```
:::

## Styling

### CSS Variables

```css
--foreground /* Background color (inverted) */
--background /* Text color (inverted) */
```

### Arrow

- Tooltip includes a small arrow pointing to trigger
- Arrow color matches tooltip background
- Position automatically adjusts based on side

### Animations

- Fade in/out with zoom effect
- Slide from appropriate direction
- 200ms smooth transitions

### Customization

```tsx
<TooltipContent className="bg-blue-600 text-white">
  <p>Custom styled tooltip</p>
</TooltipContent>
```

## Common Patterns

### Icon with Tooltip

```tsx
import { Info } from 'lucide-react'

function IconWithTooltip() {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Info className="h-4 w-4 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent>
        <p>Additional information about this feature</p>
      </TooltipContent>
    </Tooltip>
  )
}
```

### Toolbar with Tooltips

```tsx
import { Bold, Italic, Underline } from 'lucide-react'

function Toolbar() {
  return (
    <TooltipProvider>
      <div className="flex gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost">
              <Bold className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bold (Ctrl+B)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost">
              <Italic className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Italic (Ctrl+I)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost">
              <Underline className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Underline (Ctrl+U)</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
```

### Disabled Button with Tooltip

```tsx
function DisabledWithTooltip() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Button disabled>Submit</Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>Complete all required fields to submit</p>
      </TooltipContent>
    </Tooltip>
  )
}
```

## Related Components

- [Popover](/components/popover) - For interactive content
- [Alert](/components/alert) - For prominent messages
- [Badge](/components/badge) - For inline status indicators
- [Button](/components/button) - Common tooltip trigger
