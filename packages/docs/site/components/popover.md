# Popover

A floating panel that displays rich content anchored to a trigger element. Built on Radix UI Popover primitive.

## Installation

```bash
bunx shadcn@latest add popover
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@venizia/ardor-admin'

export default function Example() {
  return (
    <Popover>
      <PopoverTrigger>Open</PopoverTrigger>
      <PopoverContent>Place content for the popover here.</PopoverContent>
    </Popover>
  )
}
```

## Examples

### Basic Popover

Simple popover with text content:

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">Open popover</Button>
  </PopoverTrigger>
  <PopoverContent>
    <div className="space-y-2">
      <h4 className="font-medium leading-none">Dimensions</h4>
      <p className="text-sm text-muted-foreground">
        Set the dimensions for the layer.
      </p>
    </div>
  </PopoverContent>
</Popover>
```

### Form in Popover

Interactive form inside popover:

```tsx
import { Label, Input, Button } from '@venizia/ardor-admin'

<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">Settings</Button>
  </PopoverTrigger>
  <PopoverContent className="w-80">
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="font-medium leading-none">Settings</h4>
        <p className="text-sm text-muted-foreground">
          Configure your preferences
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="width">Width</Label>
        <Input id="width" defaultValue="100%" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="height">Height</Label>
        <Input id="height" defaultValue="300px" />
      </div>
      <Button className="w-full">Save</Button>
    </div>
  </PopoverContent>
</Popover>
```

### Controlled Popover

Control popover state:

```tsx
import { useState } from 'react'

function ControlledPopover() {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          {open ? 'Close' : 'Open'} Popover
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-2">
          <p className="text-sm">This popover is controlled by state.</p>
          <Button size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

### Different Positions

Position popover on different sides:

```tsx
<div className="flex gap-4">
  <Popover>
    <PopoverTrigger>Top</PopoverTrigger>
    <PopoverContent side="top">
      <p>Content positioned on top</p>
    </PopoverContent>
  </Popover>

  <Popover>
    <PopoverTrigger>Right</PopoverTrigger>
    <PopoverContent side="right">
      <p>Content positioned on right</p>
    </PopoverContent>
  </Popover>

  <Popover>
    <PopoverTrigger>Bottom</PopoverTrigger>
    <PopoverContent side="bottom">
      <p>Content positioned on bottom</p>
    </PopoverContent>
  </Popover>

  <Popover>
    <PopoverTrigger>Left</PopoverTrigger>
    <PopoverContent side="left">
      <p>Content positioned on left</p>
    </PopoverContent>
  </Popover>
</div>
```

### Date Picker Popover

Calendar in a popover:

```tsx
import { Calendar } from '@venizia/ardor-admin'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'

function DatePickerPopover() {
  const [date, setDate] = useState<Date>()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[240px] justify-start text-left">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'PPP') : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
```

### User Profile Popover

Rich content with avatar and actions:

```tsx
import { Avatar, AvatarImage, AvatarFallback } from '@venizia/ardor-admin'

<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
      <Avatar>
        <AvatarImage src="/avatar.jpg" alt="@username" />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-80">
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src="/avatar.jpg" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
        <div>
          <h4 className="text-sm font-semibold">John Doe</h4>
          <p className="text-xs text-muted-foreground">john@example.com</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1">
          Profile
        </Button>
        <Button variant="outline" size="sm" className="flex-1">
          Settings
        </Button>
      </div>
    </div>
  </PopoverContent>
</Popover>
```

### Menu-Style Popover

List of actions in popover:

```tsx
import { MoreHorizontal, Edit, Trash2, Share } from 'lucide-react'

<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-48 p-2">
    <div className="flex flex-col gap-1">
      <Button variant="ghost" size="sm" className="justify-start">
        <Edit className="mr-2 h-4 w-4" />
        Edit
      </Button>
      <Button variant="ghost" size="sm" className="justify-start">
        <Share className="mr-2 h-4 w-4" />
        Share
      </Button>
      <Button variant="ghost" size="sm" className="justify-start text-destructive">
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>
    </div>
  </PopoverContent>
</Popover>
```

### Color Picker Popover

Color selection in popover:

```tsx
import { useState } from 'react'

function ColorPickerPopover() {
  const [color, setColor] = useState('#3b82f6')

  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16',
    '#10b981', '#14b8a6', '#06b6d4', '#3b82f6',
    '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  ]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[220px] justify-start">
          <div className="flex items-center gap-2">
            <div
              className="h-4 w-4 rounded border"
              style={{ backgroundColor: color }}
            />
            <span>Pick a color</span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Pick a color</h4>
          <div className="grid grid-cols-6 gap-2">
            {colors.map((c) => (
              <button
                key={c}
                className="h-8 w-8 rounded border hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

## API Reference

### Popover

Root popover component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | - | Controlled open state |
| `defaultOpen` | `boolean` | - | Uncontrolled default open state |
| `onOpenChange` | `(open: boolean) => void` | - | Callback when open state changes |
| `modal` | `boolean` | `false` | Whether popover is modal |

### PopoverTrigger

Button that opens the popover.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props into child element |

Extends all HTML button attributes.

### PopoverContent

The popover content panel.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `side` | `"top" \| "right" \| "bottom" \| "left"` | `"bottom"` | Preferred side |
| `align` | `"start" \| "center" \| "end"` | `"center"` | Alignment |
| `sideOffset` | `number` | `4` | Distance from trigger |
| `alignOffset` | `number` | `0` | Alignment offset |
| `className` | `string` | - | Additional CSS classes |

### PopoverAnchor

Optional anchor element for custom positioning.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props into child |

### Data Attributes

- `data-slot="popover"` - Root element
- `data-slot="popover-trigger"` - Trigger button
- `data-slot="popover-content"` - Content panel
- `data-state="open|closed"` - Current state
- `data-side="top|right|bottom|left"` - Current side

## Accessibility

Follows WAI-ARIA Popover patterns:

### Keyboard Interactions

- **Space/Enter** - Opens popover
- **Escape** - Closes popover
- **Tab** - Moves focus through interactive elements
- **Click outside** - Closes popover (if not modal)

### Screen Reader Support

- Content linked via `aria-describedby` or `aria-labelledby`
- Focus management between trigger and content
- Proper ARIA attributes for expanded/collapsed state

### Best Practices

::: tip
Use Popover for interactive content, Tooltip for simple text:
```tsx
{/* Good: Interactive content in Popover */}
<Popover>
  <PopoverContent>
    <Input />
    <Button>Submit</Button>
  </PopoverContent>
</Popover>

{/* Use Tooltip for simple text instead */}
```
:::

::: tip
Provide a way to close the popover:
```tsx
<PopoverContent>
  <Button onClick={() => setOpen(false)}>Close</Button>
</PopoverContent>
```
:::

## Styling

### CSS Variables

```css
--popover            /* Background color */
--popover-foreground /* Text color */
--border             /* Border color */
```

### Animations

- Fade and zoom in/out
- Slide from appropriate direction
- Smooth 200ms transitions

### Size

- Default width: 288px (w-72)
- Can be customized via className
- Responsive to content

### Customization

```tsx
<PopoverContent className="w-96 p-6">
  <p>Custom width and padding</p>
</PopoverContent>
```

## Common Patterns

### Share Dialog

```tsx
import { Share2, Twitter, Facebook, Link } from 'lucide-react'

function SharePopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon">
          <Share2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="space-y-4">
          <h4 className="font-medium">Share this post</h4>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="h-20 flex-col gap-2">
              <Twitter className="h-5 w-5" />
              <span className="text-xs">Twitter</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <Facebook className="h-5 w-5" />
              <span className="text-xs">Facebook</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <Link className="h-5 w-5" />
              <span className="text-xs">Copy Link</span>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

### Filter Popover

```tsx
import { Filter } from 'lucide-react'

function FilterPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <h4 className="font-medium">Filter results</h4>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm">Reset</Button>
            <Button size="sm">Apply</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

## Related Components

- [Tooltip](/components/tooltip) - For simple text hints
- [Dialog](/components/dialog) - For modal dialogs
- [Dropdown Menu](/components/dropdown-menu) - For menu actions
- [Select](/components/select) - For selection dropdowns
- [Adaptive Popover](/components/adaptive-popover) - Responsive popover/drawer
