# Adaptive Dialog

A unique ARDOR component that automatically adapts between Dialog (desktop) and Drawer (mobile) based on screen size.

::: tip ARDOR Feature
This is a custom component unique to ARDOR. It demonstrates responsive-first design by using the `useIsMobile` hook to switch between Dialog and Drawer components.
:::

## Installation

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  AdaptiveDialog,
  AdaptiveDialogTrigger,
  AdaptiveDialogContent,
  AdaptiveDialogHeader,
  AdaptiveDialogTitle,
  AdaptiveDialogDescription
} from '@venizia/ardor-admin'
import { Button } from '@venizia/ardor-admin'

export default function Example() {
  return (
    <AdaptiveDialog>
      <AdaptiveDialogTrigger asChild>
        <Button>Open Adaptive Dialog</Button>
      </AdaptiveDialogTrigger>
      <AdaptiveDialogContent>
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle>Responsive Dialog</AdaptiveDialogTitle>
          <AdaptiveDialogDescription>
            This dialog appears as a centered modal on desktop
            and a bottom drawer on mobile.
          </AdaptiveDialogDescription>
        </AdaptiveDialogHeader>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  )
}
```

## How It Works

The `AdaptiveDialog` component uses the `useIsMobile` hook (breakpoint: 768px) to detect screen size:

- **Desktop (≥768px)**: Renders as a `Dialog` (centered modal)
- **Mobile (<768px)**: Renders as a `Drawer` (bottom sheet)

This provides optimal UX for each device type without manual media queries.

## Examples

### Basic Form

```tsx
import { 
  AdaptiveDialog, 
  AdaptiveDialogTrigger, 
  AdaptiveDialogContent,
  AdaptiveDialogHeader,
  AdaptiveDialogTitle
} from '@venizia/ardor-admin'
import { Button, Input } from '@venizia/ardor-admin'

export default function FormExample() {
  return (
    <AdaptiveDialog>
      <AdaptiveDialogTrigger asChild>
        <Button>Edit Profile</Button>
      </AdaptiveDialogTrigger>
      <AdaptiveDialogContent>
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle>Edit Profile</AdaptiveDialogTitle>
        </AdaptiveDialogHeader>
        <div className="space-y-4 p-4">
          <div>
            <label htmlFor="name">Name</label>
            <Input id="name" placeholder="Enter your name" />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <Input id="email" type="email" placeholder="you@example.com" />
          </div>
          <Button className="w-full">Save Changes</Button>
        </div>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  )
}
```

### Controlled State

```tsx
import { useState } from 'react'
import { AdaptiveDialog } from '@venizia/ardor-admin'

export default function ControlledExample() {
  const [open, setOpen] = useState(false)

  return (
    <AdaptiveDialog open={open} onOpenChange={setOpen}>
      {/* ... */}
    </AdaptiveDialog>
  )
}
```

### With Close Button

```tsx
import { 
  AdaptiveDialog, 
  AdaptiveDialogClose 
} from '@venizia/ardor-admin'
import { Button } from '@venizia/ardor-admin'

<AdaptiveDialogContent>
  <AdaptiveDialogHeader>
    <AdaptiveDialogTitle>Confirm Action</AdaptiveDialogTitle>
  </AdaptiveDialogHeader>
  <div className="space-y-4 p-4">
    <p>Are you sure you want to continue?</p>
    <div className="flex gap-2">
      <AdaptiveDialogClose asChild>
        <Button variant="outline">Cancel</Button>
      </AdaptiveDialogClose>
      <Button>Confirm</Button>
    </div>
  </div>
</AdaptiveDialogContent>
```

## API Reference

### AdaptiveDialog

Container component that manages state and context.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | - | Controlled open state |
| `defaultOpen` | `boolean` | `false` | Uncontrolled default open state |
| `onOpenChange` | `(open: boolean) => void` | - | Callback when open state changes |

### AdaptiveDialogTrigger

Button that opens the adaptive dialog.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props into child element |

### AdaptiveDialogContent

Main content container that adapts between Dialog and Drawer.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### AdaptiveDialogHeader

Header section for title and description.

### AdaptiveDialogTitle

Accessible title (required for accessibility).

### AdaptiveDialogDescription

Optional description text.

### AdaptiveDialogClose

Close button component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props into child element |

## Hook: useAdaptiveDialog

Access the adaptive dialog context to check device type:

```tsx
import { useAdaptiveDialog } from '@venizia/ardor-admin'

function CustomContent() {
  const { isMobile } = useAdaptiveDialog()

  return (
    <div>
      {isMobile ? 'Mobile drawer mode' : 'Desktop dialog mode'}
    </div>
  )
}
```

::: warning
This hook must be used within an `AdaptiveDialog` component.
:::

## Implementation Details

### Client-Side Rendering

The `AdaptiveDialog` waits for client-side mounting before rendering to prevent hydration mismatches:

```tsx
// Component returns null until mounted
if (!isMounted) {
  return null;
}
```

This ensures SSR compatibility while maintaining responsive behavior.

### Breakpoint

The adaptive behavior triggers at `768px` (Tailwind's `md` breakpoint) via the `useIsMobile` hook.

## Accessibility

The component inherits accessibility from its underlying primitives:

**Dialog Mode (Desktop)**:
- Focus trap
- Escape to close
- ARIA dialog role
- Focus return on close

**Drawer Mode (Mobile)**:
- Touch gestures (swipe to close)
- Focus management
- ARIA sheet role

Both implementations are WCAG 2.1 AA compliant via Radix UI primitives.

## Related Components

- [Dialog](/components/dialog) - Standard desktop dialog
- [Drawer](/components/drawer) - Mobile drawer
- [Adaptive Popover](/components/adaptive-popover) - Similar pattern for popovers
- [useIsMobile Hook](/hooks/use-mobile) - The underlying responsive hook
