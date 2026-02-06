# Drawer

A draggable overlay panel that slides in from the edge of the screen. Built with Vaul, providing native-like drawer interactions with swipe gestures.

## Installation

```bash
bunx shadcn@latest add drawer
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@venizia/ardor-admin'

export default function Example() {
  return (
    <Drawer>
      <DrawerTrigger>Open Drawer</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Drawer Title</DrawerTitle>
          <DrawerDescription>Drawer description goes here.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <DrawerClose>Close</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
```

## Examples

### Basic Drawer (Bottom)

Default drawer from bottom with swipe to dismiss:

```tsx
<Drawer>
  <DrawerTrigger asChild>
    <Button variant="outline">Open Drawer</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Are you sure?</DrawerTitle>
      <DrawerDescription>This action cannot be undone.</DrawerDescription>
    </DrawerHeader>
    <DrawerFooter>
      <Button>Submit</Button>
      <DrawerClose asChild>
        <Button variant="outline">Cancel</Button>
      </DrawerClose>
    </DrawerFooter>
  </DrawerContent>
</Drawer>
```

### Side Drawers

Drawers from different directions:

```tsx
// From Right (most common for navigation)
<Drawer direction="right">
  <DrawerTrigger asChild>
    <Button>Open Right Drawer</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Navigation Menu</DrawerTitle>
    </DrawerHeader>
    <div className="p-4">
      <p>Navigation content here</p>
    </div>
  </DrawerContent>
</Drawer>

// From Left
<Drawer direction="left">
  <DrawerTrigger asChild>
    <Button>Open Left Drawer</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Filters</DrawerTitle>
    </DrawerHeader>
    <div className="p-4">
      <p>Filter options here</p>
    </div>
  </DrawerContent>
</Drawer>

// From Top
<Drawer direction="top">
  <DrawerTrigger asChild>
    <Button>Open Top Drawer</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Notifications</DrawerTitle>
    </DrawerHeader>
    <div className="p-4">
      <p>Notification content here</p>
    </div>
  </DrawerContent>
</Drawer>
```

### Controlled Drawer

Control drawer state programmatically:

```tsx
import { useState } from 'react'

function ControlledDrawer() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Drawer</Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Controlled Drawer</DrawerTitle>
            <DrawerDescription>
              This drawer's state is controlled by React state.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}
```

### Form in Drawer

Interactive form inside drawer:

```tsx
import { useState } from 'react'
import { Label, Input, Textarea } from '@venizia/ardor-admin'

function FormDrawer() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted:', formData)
  }

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button>Contact Us</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Get in Touch</DrawerTitle>
          <DrawerDescription>
            Fill out the form below and we'll get back to you.
          </DrawerDescription>
        </DrawerHeader>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              required
            />
          </div>
        </form>
        <DrawerFooter>
          <Button onClick={handleSubmit}>Send Message</Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
```

### Nested Drawers

Stack multiple drawers:

```tsx
function NestedDrawers() {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button>Open First Drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>First Drawer</DrawerTitle>
        </DrawerHeader>
        <div className="p-4">
          <Drawer>
            <DrawerTrigger asChild>
              <Button>Open Second Drawer</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Second Drawer</DrawerTitle>
              </DrawerHeader>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button>Close</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button>Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
```

### Scrollable Content

Drawer with scrollable content:

```tsx
<Drawer>
  <DrawerTrigger asChild>
    <Button>View Details</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Long Content</DrawerTitle>
      <DrawerDescription>Scroll to see more content</DrawerDescription>
    </DrawerHeader>
    <div className="p-4 overflow-y-auto max-h-[60vh]">
      {Array.from({ length: 20 }).map((_, i) => (
        <p key={i} className="mb-4">
          This is paragraph {i + 1} of scrollable content.
        </p>
      ))}
    </div>
    <DrawerFooter>
      <DrawerClose asChild>
        <Button>Close</Button>
      </DrawerClose>
    </DrawerFooter>
  </DrawerContent>
</Drawer>
```

### Snap Points

Drawer with snap positions:

```tsx
<Drawer snapPoints={[0.2, 0.5, 1]}>
  <DrawerTrigger asChild>
    <Button>Open with Snap Points</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Drawer with Snap Points</DrawerTitle>
      <DrawerDescription>
        Drag to snap to 20%, 50%, or 100% height
      </DrawerDescription>
    </DrawerHeader>
    <div className="p-4 min-h-[200px]">
      <p>Content that adapts to snap heights</p>
    </div>
  </DrawerContent>
</Drawer>
```

### Dismissible Configuration

Control dismiss behavior:

```tsx
<Drawer dismissible={false}>
  <DrawerTrigger asChild>
    <Button>Open Non-Dismissible</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Cannot Dismiss by Dragging</DrawerTitle>
      <DrawerDescription>
        You must use the close button to dismiss.
      </DrawerDescription>
    </DrawerHeader>
    <DrawerFooter>
      <DrawerClose asChild>
        <Button>Close</Button>
      </DrawerClose>
    </DrawerFooter>
  </DrawerContent>
</Drawer>
```

## API Reference

### Drawer

Root drawer component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | - | Controlled open state |
| `defaultOpen` | `boolean` | - | Uncontrolled default open state |
| `onOpenChange` | `(open: boolean) => void` | - | Callback when open state changes |
| `direction` | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"` | Direction drawer slides from |
| `snapPoints` | `number[]` | - | Array of snap point percentages (0-1) |
| `dismissible` | `boolean` | `true` | Whether drawer can be dismissed by dragging |
| `modal` | `boolean` | `true` | Whether drawer is modal |

### DrawerTrigger

Button that opens the drawer.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props into child element |

### DrawerContent

The drawer panel container.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### DrawerHeader

Header section of the drawer.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### DrawerFooter

Footer section with actions.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### DrawerTitle

Title heading for the drawer.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### DrawerDescription

Descriptive text for the drawer.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### DrawerClose

Button that closes the drawer.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props into child element |

### Data Attributes

- `data-slot="drawer"` - Root element
- `data-slot="drawer-trigger"` - Trigger button
- `data-slot="drawer-content"` - Content panel
- `data-slot="drawer-overlay"` - Background overlay
- `data-slot="drawer-header"` - Header section
- `data-slot="drawer-footer"` - Footer section
- `data-slot="drawer-title"` - Title element
- `data-slot="drawer-description"` - Description text
- `data-vaul-drawer-direction` - Current drawer direction

## Accessibility

Follows dialog accessibility patterns:

### Keyboard Interactions

- **Escape** - Closes the drawer
- **Tab** - Moves focus through interactive elements
- **Swipe/Drag** - Gesture to dismiss (on touch devices)

### Screen Reader Support

- Dialog role with proper ARIA attributes
- Title linked via `aria-labelledby`
- Description linked via `aria-describedby`
- Focus trapped within drawer when modal

### Touch Interactions

- Swipe to dismiss (configurable)
- Drag to resize (with snap points)
- Natural mobile-like interactions

### Best Practices

::: tip
Use drawers for mobile-optimized experiences:
```tsx
{/* Drawer works great on mobile with swipe gestures */}
<Drawer>
  <DrawerContent>{/* Mobile-friendly content */}</DrawerContent>
</Drawer>
```
:::

::: tip
Provide clear ways to close:
```tsx
<DrawerFooter>
  <DrawerClose asChild>
    <Button>Close</Button>
  </DrawerClose>
</DrawerFooter>
```
:::

## Styling

### CSS Variables

```css
--background /* Drawer background */
--foreground /* Text color */
--muted-foreground /* Description text */
```

### Direction-Specific Styling

- **Bottom**: Rounded top corners, handle indicator, max 80vh height
- **Top**: Rounded bottom corners, max 80vh height
- **Right**: Full height, max-width sm, rounded left corners
- **Left**: Full height, max-width sm, rounded right corners

### Handle Indicator

Bottom drawers show a drag handle:
- Visible only on bottom direction
- Centered at top of drawer
- Visual indicator for swipe gesture

### Customization

```tsx
<DrawerContent className="max-h-[90vh]">
  {/* Custom max height */}
</DrawerContent>
```

## Common Patterns

### Mobile Navigation Drawer

```tsx
import { Menu, Home, Settings, User, LogOut } from 'lucide-react'

function MobileNav() {
  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>
        <Button size="icon" variant="ghost">
          <Menu className="h-5 w-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Menu</DrawerTitle>
        </DrawerHeader>
        <nav className="p-4 space-y-2">
          <Button variant="ghost" className="w-full justify-start">
            <Home className="mr-2 h-4 w-4" />
            Home
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <User className="mr-2 h-4 w-4" />
            Profile
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button variant="ghost" className="w-full justify-start text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </nav>
      </DrawerContent>
    </Drawer>
  )
}
```

### Product Details Drawer

```tsx
function ProductDrawer({ product }: { product: Product }) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button>View Details</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{product.name}</DrawerTitle>
          <DrawerDescription>${product.price}</DrawerDescription>
        </DrawerHeader>
        <div className="p-4 space-y-4">
          <img
            src={product.image}
            alt={product.name}
            className="w-full rounded-lg"
          />
          <p className="text-sm">{product.description}</p>
        </div>
        <DrawerFooter>
          <Button className="w-full">Add to Cart</Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
```

### Filter Drawer

```tsx
function FilterDrawer() {
  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Filter Results</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="electronics">Electronics</SelectItem>
                <SelectItem value="clothing">Clothing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Price Range</Label>
            <div className="flex gap-2">
              <Input placeholder="Min" type="number" />
              <Input placeholder="Max" type="number" />
            </div>
          </div>
        </div>
        <DrawerFooter>
          <Button>Apply Filters</Button>
          <DrawerClose asChild>
            <Button variant="outline">Reset</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
```

## Related Components

- [Sheet](/components/sheet) - Similar slide-in panel with different use cases
- [Dialog](/components/dialog) - Modal dialog for desktop
- [Adaptive Dialog](/components/adaptive-dialog) - Automatically switches between dialog and drawer
- [Popover](/components/popover) - For smaller interactive content
