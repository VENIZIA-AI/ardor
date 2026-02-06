# Adaptive Popover

::: tip ARDOR Feature
Adaptive Popover is a custom ARDOR component that automatically adapts between desktop Popover and mobile Drawer based on viewport size, providing optimal UX across devices.
:::

A responsive popover component that switches between Popover (desktop) and Drawer (mobile) automatically. Built with SSR-safe hydration and mobile detection.

## Installation

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  AdaptivePopover,
  AdaptivePopoverTrigger,
  AdaptivePopoverContent,
} from '@venizia/ardor-admin'

export default function Example() {
  return (
    <AdaptivePopover>
      <AdaptivePopoverTrigger asChild>
        <Button variant="outline">Open Popover</Button>
      </AdaptivePopoverTrigger>
      <AdaptivePopoverContent>
        <div className="p-4">
          <h3 className="font-semibold">Popover Content</h3>
          <p className="text-sm text-muted-foreground">
            This appears as a popover on desktop and a drawer on mobile.
          </p>
        </div>
      </AdaptivePopoverContent>
    </AdaptivePopover>
  )
}
```

## Examples

### Basic Adaptive Popover

Simple adaptive popover:

```tsx
<AdaptivePopover>
  <AdaptivePopoverTrigger asChild>
    <Button>Settings</Button>
  </AdaptivePopoverTrigger>
  <AdaptivePopoverContent>
    <div className="grid gap-4 p-4">
      <h3 className="font-medium">Settings</h3>
      <div className="grid gap-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" defaultValue="johndoe" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" defaultValue="john@example.com" />
      </div>
    </div>
  </AdaptivePopoverContent>
</AdaptivePopover>
```

### With Header (Mobile Only)

Header appears only on mobile drawer:

```tsx
<AdaptivePopover>
  <AdaptivePopoverTrigger asChild>
    <Button variant="outline">Filter</Button>
  </AdaptivePopoverTrigger>
  <AdaptivePopoverContent>
    <AdaptivePopoverHeader>
      <AdaptivePopoverTitle>Filters</AdaptivePopoverTitle>
      <AdaptivePopoverDescription>
        Apply filters to narrow down results
      </AdaptivePopoverDescription>
    </AdaptivePopoverHeader>
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Category</Label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="tech">Technology</SelectItem>
            <SelectItem value="design">Design</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  </AdaptivePopoverContent>
</AdaptivePopover>
```

### Controlled State

Control open/close state:

```tsx
function ControlledAdaptivePopover() {
  const [open, setOpen] = useState(false)

  return (
    <AdaptivePopover open={open} onOpenChange={setOpen}>
      <AdaptivePopoverTrigger asChild>
        <Button>Actions</Button>
      </AdaptivePopoverTrigger>
      <AdaptivePopoverContent>
        <div className="p-4 space-y-2">
          <Button variant="outline" className="w-full" onClick={() => {
            console.log('Edit clicked')
            setOpen(false)
          }}>
            Edit
          </Button>
          <Button variant="outline" className="w-full" onClick={() => {
            console.log('Share clicked')
            setOpen(false)
          }}>
            Share
          </Button>
          <Button variant="destructive" className="w-full" onClick={() => {
            console.log('Delete clicked')
            setOpen(false)
          }}>
            Delete
          </Button>
        </div>
      </AdaptivePopoverContent>
    </AdaptivePopover>
  )
}
```

### Form in Adaptive Popover

Complete form that adapts to viewport:

```tsx
function AddTaskPopover() {
  const [open, setOpen] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
    setOpen(false)
  }

  return (
    <AdaptivePopover open={open} onOpenChange={setOpen}>
      <AdaptivePopoverTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </AdaptivePopoverTrigger>
      <AdaptivePopoverContent>
        <AdaptivePopoverHeader>
          <AdaptivePopoverTitle>Create Task</AdaptivePopoverTitle>
          <AdaptivePopoverDescription>
            Add a new task to your list
          </AdaptivePopoverDescription>
        </AdaptivePopoverHeader>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-name">Task name</Label>
            <Input id="task-name" placeholder="Enter task name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              placeholder="Add description..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-priority">Priority</Label>
            <Select>
              <SelectTrigger id="task-priority">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full">
            Create Task
          </Button>
        </form>
      </AdaptivePopoverContent>
    </AdaptivePopover>
  )
}
```

### Profile Quick Actions

User profile actions that adapt:

```tsx
function ProfileActions() {
  return (
    <AdaptivePopover>
      <AdaptivePopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <Avatar className="size-8">
            <AvatarImage src="/avatar.jpg" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
        </Button>
      </AdaptivePopoverTrigger>
      <AdaptivePopoverContent>
        <AdaptivePopoverHeader>
          <div className="flex items-center gap-3 pb-3">
            <Avatar className="size-12">
              <AvatarImage src="/avatar.jpg" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <div>
              <AdaptivePopoverTitle className="text-base">
                John Doe
              </AdaptivePopoverTitle>
              <AdaptivePopoverDescription>
                john@example.com
              </AdaptivePopoverDescription>
            </div>
          </div>
        </AdaptivePopoverHeader>
        <div className="grid gap-1 p-2">
          <Button variant="ghost" className="justify-start">
            <User className="h-4 w-4" />
            Profile
          </Button>
          <Button variant="ghost" className="justify-start">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
          <Separator />
          <Button variant="ghost" className="justify-start text-destructive">
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>
      </AdaptivePopoverContent>
    </AdaptivePopover>
  )
}
```

### Share Dialog

Share content with adaptive layout:

```tsx
function ShareButton() {
  return (
    <AdaptivePopover>
      <AdaptivePopoverTrigger asChild>
        <Button variant="outline">
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </AdaptivePopoverTrigger>
      <AdaptivePopoverContent className="w-80">
        <AdaptivePopoverHeader>
          <AdaptivePopoverTitle>Share this document</AdaptivePopoverTitle>
          <AdaptivePopoverDescription>
            Anyone with the link can view this document
          </AdaptivePopoverDescription>
        </AdaptivePopoverHeader>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Input value="https://example.com/doc/123" readOnly />
            <Button size="icon" variant="outline">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Share via</Label>
            <div className="grid grid-cols-4 gap-2">
              <Button variant="outline" size="icon">
                <Mail className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Twitter className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Facebook className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </AdaptivePopoverContent>
    </AdaptivePopover>
  )
}
```

## API Reference

### AdaptivePopover

Root adaptive popover component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultOpen` | `boolean` | `false` | Initial open state |
| `open` | `boolean` | - | Controlled open state |
| `onOpenChange` | `(open: boolean) => void` | - | Callback when open changes |

Extends all Popover/Drawer props. Automatically switches between components based on viewport.

### AdaptivePopoverTrigger

Trigger element for opening popover/drawer.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props with child element |

Extends all PopoverTrigger/DrawerTrigger props.

### AdaptivePopoverContent

Content container that adapts between popover and drawer.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all PopoverContent/DrawerContent props. On mobile, renders as drawer; on desktop, renders as popover.

### AdaptivePopoverHeader

Header section (visible only on mobile drawer).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Only renders on mobile. Hidden on desktop popover.

### AdaptivePopoverTitle

Title text (visible only on mobile drawer).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all DrawerTitle props. Only visible on mobile.

### AdaptivePopoverDescription

Description text (visible only on mobile drawer).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all DrawerDescription props. Only visible on mobile.

### AdaptivePopoverClose

Close button (visible only on mobile drawer).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Only renders on mobile drawer. Desktop popover closes on outside click.

## Responsive Behavior

### Desktop (≥768px)
- Renders as Popover
- Positioned relative to trigger
- Closes on outside click or Escape
- Header components don't render

### Mobile (<768px)
- Renders as Drawer
- Slides up from bottom
- Includes drag-to-close handle
- Header, Title, Description, Close button all render
- Full-width layout

## Accessibility

Adaptive Popover maintains accessibility across both modes:

### Keyboard Interactions

**Desktop (Popover):**
- **Escape** - Close popover
- **Tab** - Navigate through focusable elements
- **Outside Click** - Close popover

**Mobile (Drawer):**
- **Escape** - Close drawer
- **Tab** - Navigate through content
- **Swipe Down** - Close drawer (touch)

### Screen Reader Support

- Proper ARIA attributes on both modes
- Focus management on open/close
- Clear accessible names via Title/Description
- Announced state changes

### Focus Management

- Focus trapped in both modes
- Returns to trigger on close
- Clear focus indicators
- Keyboard navigation works naturally

### Best Practices

::: tip
Always provide title and description for mobile:
```tsx
<AdaptivePopoverHeader>
  <AdaptivePopoverTitle>Settings</AdaptivePopoverTitle>
  <AdaptivePopoverDescription>
    Configure your preferences
  </AdaptivePopoverDescription>
</AdaptivePopoverHeader>
```
These only show on mobile but are important for accessibility.
:::

::: tip
Use asChild for custom triggers:
```tsx
<AdaptivePopoverTrigger asChild>
  <Button variant="outline">Custom Trigger</Button>
</AdaptivePopoverTrigger>
```
:::

## Styling

### CSS Variables

Uses variables from both Popover and Drawer:

```css
/* Popover (Desktop) */
--popover            /* Background */
--popover-foreground /* Text color */

/* Drawer (Mobile) */
--background         /* Drawer background */
--foreground         /* Drawer text */
```

### Customization

```tsx
{/* Custom content width on desktop */}
<AdaptivePopoverContent className="w-96">
  {/* Content */}
</AdaptivePopoverContent>

{/* Custom drawer height on mobile */}
<AdaptivePopoverContent className="max-h-[80vh]">
  {/* Content */}
</AdaptivePopoverContent>

{/* Custom header styling (mobile only) */}
<AdaptivePopoverHeader className="border-b pb-4">
  {/* Header content */}
</AdaptivePopoverHeader>
```

### Dark Mode

- Automatically adapts in both modes
- Consistent styling across desktop/mobile
- Proper contrast maintained

## SSR and Hydration

Adaptive Popover handles SSR safely:

- Component doesn't render until mounted (`isMounted` state)
- Prevents hydration mismatches
- Mobile detection happens client-side
- Returns `null` during SSR

```tsx
// Safe for Next.js, Remix, etc.
export default function Page() {
  return (
    <AdaptivePopover>
      {/* Will render correctly after hydration */}
    </AdaptivePopover>
  )
}
```

## Common Patterns

### Filter Panel

```tsx
function FilterPanel() {
  const [filters, setFilters] = useState({
    category: '',
    status: '',
    date: '',
  })

  return (
    <AdaptivePopover>
      <AdaptivePopoverTrigger asChild>
        <Button variant="outline">
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      </AdaptivePopoverTrigger>
      <AdaptivePopoverContent className="w-80">
        <AdaptivePopoverHeader>
          <AdaptivePopoverTitle>Filter Options</AdaptivePopoverTitle>
        </AdaptivePopoverHeader>
        <div className="p-4 space-y-4">
          {/* Filter controls */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setFilters({ category: '', status: '', date: '' })}
            >
              Reset
            </Button>
            <Button className="flex-1">Apply</Button>
          </div>
        </div>
      </AdaptivePopoverContent>
    </AdaptivePopover>
  )
}
```

## Related Components

- [Popover](/components/popover) - Desktop popover component
- [Drawer](/components/drawer) - Mobile drawer component
- [Adaptive Dialog](/components/adaptive-dialog) - Similar adaptive pattern for dialogs
- [Button](/components/button) - Common trigger element
