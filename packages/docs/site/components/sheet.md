# Sheet

A slide-in panel that overlays content from the edge of the screen. Built on Radix UI Dialog primitive, styled as a sheet overlay.

## Installation

```bash
bunx shadcn@latest add sheet
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@venizia/ardor-admin'

export default function Example() {
  return (
    <Sheet>
      <SheetTrigger>Open Sheet</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Sheet Title</SheetTitle>
          <SheetDescription>Sheet description goes here.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  )
}
```

## Examples

### Basic Sheet (Right Side)

Default sheet from right side:

```tsx
<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline">Open Sheet</Button>
  </SheetTrigger>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Edit Profile</SheetTitle>
      <SheetDescription>
        Make changes to your profile here. Click save when you're done.
      </SheetDescription>
    </SheetHeader>
    <div className="py-4">
      {/* Content here */}
    </div>
    <SheetFooter>
      <Button>Save changes</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

### Different Sides

Sheet can slide from any edge:

```tsx
// From Right (default)
<Sheet>
  <SheetTrigger>Open Right</SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Right Sheet</SheetTitle>
    </SheetHeader>
  </SheetContent>
</Sheet>

// From Left
<Sheet>
  <SheetTrigger>Open Left</SheetTrigger>
  <SheetContent side="left">
    <SheetHeader>
      <SheetTitle>Left Sheet</SheetTitle>
    </SheetHeader>
  </SheetContent>
</Sheet>

// From Top
<Sheet>
  <SheetTrigger>Open Top</SheetTrigger>
  <SheetContent side="top">
    <SheetHeader>
      <SheetTitle>Top Sheet</SheetTitle>
    </SheetHeader>
  </SheetContent>
</Sheet>

// From Bottom
<Sheet>
  <SheetTrigger>Open Bottom</SheetTrigger>
  <SheetContent side="bottom">
    <SheetHeader>
      <SheetTitle>Bottom Sheet</SheetTitle>
    </SheetHeader>
  </SheetContent>
</Sheet>
```

### Controlled Sheet

Control sheet state with React:

```tsx
import { useState } from 'react'

function ControlledSheet() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Sheet</Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Controlled Sheet</SheetTitle>
            <SheetDescription>
              This sheet is controlled by state.
            </SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
```

### Form in Sheet

Complete form inside sheet:

```tsx
import { Label, Input, Textarea, Button } from '@venizia/ardor-admin'

<Sheet>
  <SheetTrigger asChild>
    <Button>Edit Profile</Button>
  </SheetTrigger>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Edit profile</SheetTitle>
      <SheetDescription>
        Make changes to your profile here. Click save when you're done.
      </SheetDescription>
    </SheetHeader>
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" defaultValue="John Doe" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" defaultValue="@johndoe" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" placeholder="Tell us about yourself" />
      </div>
    </div>
    <SheetFooter>
      <SheetClose asChild>
        <Button type="button" variant="outline">
          Cancel
        </Button>
      </SheetClose>
      <Button type="submit">Save changes</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

### Settings Sheet

Settings panel in sheet:

```tsx
import { Switch, Label, Separator } from '@venizia/ardor-admin'

<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline">
      <Settings className="mr-2 h-4 w-4" />
      Settings
    </Button>
  </SheetTrigger>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Settings</SheetTitle>
      <SheetDescription>
        Manage your account settings and preferences.
      </SheetDescription>
    </SheetHeader>
    <div className="py-6 space-y-6">
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Notifications</h4>
        <div className="flex items-center justify-between">
          <Label htmlFor="email-notifications" className="flex-1">
            Email notifications
          </Label>
          <Switch id="email-notifications" />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="push-notifications" className="flex-1">
            Push notifications
          </Label>
          <Switch id="push-notifications" />
        </div>
      </div>
      <Separator />
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Privacy</h4>
        <div className="flex items-center justify-between">
          <Label htmlFor="profile-public" className="flex-1">
            Public profile
          </Label>
          <Switch id="profile-public" />
        </div>
      </div>
    </div>
  </SheetContent>
</Sheet>
```

### Navigation Sheet

Mobile navigation menu:

```tsx
import { Home, Users, Settings, HelpCircle } from 'lucide-react'

<Sheet>
  <SheetTrigger asChild>
    <Button variant="ghost" size="icon">
      <Menu className="h-5 w-5" />
    </Button>
  </SheetTrigger>
  <SheetContent side="left">
    <SheetHeader>
      <SheetTitle>Navigation</SheetTitle>
    </SheetHeader>
    <nav className="flex flex-col gap-2 py-4">
      <Button variant="ghost" className="justify-start">
        <Home className="mr-2 h-4 w-4" />
        Home
      </Button>
      <Button variant="ghost" className="justify-start">
        <Users className="mr-2 h-4 w-4" />
        Team
      </Button>
      <Button variant="ghost" className="justify-start">
        <Settings className="mr-2 h-4 w-4" />
        Settings
      </Button>
      <Button variant="ghost" className="justify-start">
        <HelpCircle className="mr-2 h-4 w-4" />
        Help
      </Button>
    </nav>
  </SheetContent>
</Sheet>
```

### Scrollable Content

Sheet with scrollable body:

```tsx
<Sheet>
  <SheetTrigger asChild>
    <Button>View Details</Button>
  </SheetTrigger>
  <SheetContent className="overflow-y-auto">
    <SheetHeader>
      <SheetTitle>Long Content</SheetTitle>
      <SheetDescription>
        This sheet has scrollable content.
      </SheetDescription>
    </SheetHeader>
    <div className="py-4 space-y-4">
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="p-4 border rounded">
          <h4 className="font-medium">Item {i + 1}</h4>
          <p className="text-sm text-muted-foreground">
            Description for item {i + 1}
          </p>
        </div>
      ))}
    </div>
  </SheetContent>
</Sheet>
```

### Product Details Sheet

E-commerce product view:

```tsx
function ProductSheet({ product }: { product: Product }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Quick View</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{product.name}</SheetTitle>
          <SheetDescription>${product.price}</SheetDescription>
        </SheetHeader>
        <div className="py-4 space-y-4">
          <img
            src={product.image}
            alt={product.name}
            className="w-full rounded-lg"
          />
          <div>
            <h4 className="font-medium mb-2">Description</h4>
            <p className="text-sm text-muted-foreground">
              {product.description}
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Specifications</h4>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">SKU</dt>
                <dd>{product.sku}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Category</dt>
                <dd>{product.category}</dd>
              </div>
            </dl>
          </div>
        </div>
        <SheetFooter>
          <Button className="w-full">Add to Cart</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

## API Reference

### Sheet

Root sheet component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | - | Controlled open state |
| `defaultOpen` | `boolean` | - | Uncontrolled default open state |
| `onOpenChange` | `(open: boolean) => void` | - | Callback when open state changes |
| `modal` | `boolean` | `true` | Whether sheet is modal |

### SheetTrigger

Button that opens the sheet.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props into child element |

### SheetContent

The sheet panel container.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `side` | `"top" \| "right" \| "bottom" \| "left"` | `"right"` | Side sheet slides from |
| `className` | `string` | - | Additional CSS classes |

Includes built-in close button.

### SheetHeader

Header section of the sheet.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### SheetFooter

Footer section with actions.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### SheetTitle

Title heading for the sheet.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### SheetDescription

Descriptive text for the sheet.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### SheetClose

Button that closes the sheet.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props into child element |

### Data Attributes

- `data-slot="sheet"` - Root element
- `data-slot="sheet-trigger"` - Trigger button
- `data-slot="sheet-content"` - Content panel
- `data-slot="sheet-overlay"` - Background overlay
- `data-slot="sheet-header"` - Header section
- `data-slot="sheet-footer"` - Footer section
- `data-slot="sheet-title"` - Title element
- `data-slot="sheet-description"` - Description text
- `data-state="open|closed"` - Current state

## Accessibility

Follows WAI-ARIA Dialog patterns:

### Keyboard Interactions

- **Escape** - Closes the sheet
- **Tab** - Moves focus through interactive elements
- **Shift + Tab** - Moves focus backwards

### Screen Reader Support

- Dialog role with proper ARIA attributes
- Title linked via `aria-labelledby`
- Description linked via `aria-describedby`
- Focus trapped within sheet when modal
- Focus returns to trigger on close

### Close Button

- Built-in accessible close button
- Positioned in top-right corner
- Includes screen reader text "Close"

### Best Practices

::: tip
Always provide a title for screen readers:
```tsx
<SheetHeader>
  <SheetTitle>Sheet Title</SheetTitle>
</SheetHeader>
```
:::

::: tip
Use SheetDescription for context:
```tsx
<SheetDescription>
  Additional context about this sheet's purpose
</SheetDescription>
```
:::

## Styling

### CSS Variables

```css
--background /* Sheet background */
--foreground /* Text color */
--muted-foreground /* Description text */
```

### Side-Specific Styling

- **Right** (default): Full height, 75% width (max 448px), slides from right
- **Left**: Full height, 75% width (max 448px), slides from left
- **Top**: Full width, auto height, slides from top
- **Bottom**: Full width, auto height, slides from bottom

### Animations

- Slide in from specified side
- Fade in/out overlay
- 300-500ms transitions for smooth feel

### Built-in Close Button

- Top-right corner (left for left-side sheets)
- Opacity hover effect
- Focus ring for keyboard navigation

### Customization

```tsx
<SheetContent className="w-full sm:max-w-md">
  {/* Custom width */}
</SheetContent>
```

## Common Patterns

### Shopping Cart Sheet

```tsx
function CartSheet({ items }: { items: CartItem[] }) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <ShoppingCart className="mr-2 h-4 w-4" />
          Cart ({items.length})
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Shopping Cart</SheetTitle>
          <SheetDescription>
            {items.length} items in your cart
          </SheetDescription>
        </SheetHeader>
        <div className="py-4 space-y-4">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-4">
              <img
                src={item.image}
                alt={item.name}
                className="w-16 h-16 rounded object-cover"
              />
              <div className="flex-1">
                <h4 className="font-medium">{item.name}</h4>
                <p className="text-sm text-muted-foreground">
                  ${item.price} × {item.quantity}
                </p>
              </div>
            </div>
          ))}
        </div>
        <SheetFooter className="flex-col gap-4">
          <div className="flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <Button className="w-full">Checkout</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

### Filter Sheet

```tsx
function FilterSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filter Products</SheetTitle>
          <SheetDescription>
            Refine your search results
          </SheetDescription>
        </SheetHeader>
        <div className="py-4 space-y-6">
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
          <div className="space-y-2">
            <Label>Rating</Label>
            {[5, 4, 3].map(rating => (
              <div key={rating} className="flex items-center gap-2">
                <Checkbox id={`rating-${rating}`} />
                <Label htmlFor={`rating-${rating}`}>
                  {rating} stars & up
                </Label>
              </div>
            ))}
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline">Reset</Button>
          <Button>Apply Filters</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

## Related Components

- [Drawer](/components/drawer) - Similar with swipe gestures
- [Dialog](/components/dialog) - Modal dialog
- [Popover](/components/popover) - Smaller floating content
- [Adaptive Dialog](/components/adaptive-dialog) - Responsive dialog/sheet
