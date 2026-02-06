# Separator

A visual divider that separates content into distinct sections. Built on Radix UI Separator primitive with support for horizontal and vertical orientations.

## Installation

```bash
bunx shadcn@latest add separator
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Separator } from '@venizia/ardor-admin'

export default function Example() {
  return (
    <div>
      <div className="space-y-1">
        <h4 className="text-sm font-medium">Radix Primitives</h4>
        <p className="text-sm text-muted-foreground">
          An open-source UI component library.
        </p>
      </div>
      <Separator className="my-4" />
      <div className="flex h-5 items-center space-x-4 text-sm">
        <div>Blog</div>
        <Separator orientation="vertical" />
        <div>Docs</div>
        <Separator orientation="vertical" />
        <div>Source</div>
      </div>
    </div>
  )
}
```

## Examples

### Horizontal Separator

Default horizontal divider:

```tsx
<div className="space-y-4">
  <p>Content above separator</p>
  <Separator />
  <p>Content below separator</p>
</div>
```

### Vertical Separator

Vertical divider between inline elements:

```tsx
<div className="flex items-center space-x-4">
  <span>Item 1</span>
  <Separator orientation="vertical" className="h-4" />
  <span>Item 2</span>
  <Separator orientation="vertical" className="h-4" />
  <span>Item 3</span>
</div>
```

### In Navigation

Separate navigation items:

```tsx
<nav className="flex items-center space-x-4 text-sm">
  <a href="/">Home</a>
  <Separator orientation="vertical" className="h-4" />
  <a href="/about">About</a>
  <Separator orientation="vertical" className="h-4" />
  <a href="/contact">Contact</a>
</nav>
```

### Section Divider

Divide content sections:

```tsx
<div className="space-y-6">
  <section>
    <h2 className="text-2xl font-bold">Section 1</h2>
    <p>Content for section 1...</p>
  </section>

  <Separator />

  <section>
    <h2 className="text-2xl font-bold">Section 2</h2>
    <p>Content for section 2...</p>
  </section>

  <Separator />

  <section>
    <h2 className="text-2xl font-bold">Section 3</h2>
    <p>Content for section 3...</p>
  </section>
</div>
```

### In Sidebar

Separate sidebar sections:

```tsx
<aside className="w-64 space-y-4">
  <div>
    <h3 className="font-semibold">Navigation</h3>
    <ul className="space-y-2">
      <li>Dashboard</li>
      <li>Projects</li>
    </ul>
  </div>

  <Separator />

  <div>
    <h3 className="font-semibold">Settings</h3>
    <ul className="space-y-2">
      <li>Profile</li>
      <li>Preferences</li>
    </ul>
  </div>
</aside>
```

### In Forms

Separate form sections:

```tsx
<form className="space-y-6">
  <div className="space-y-4">
    <h3 className="font-semibold">Personal Information</h3>
    <Input placeholder="Name" />
    <Input placeholder="Email" />
  </div>

  <Separator />

  <div className="space-y-4">
    <h3 className="font-semibold">Address</h3>
    <Input placeholder="Street" />
    <Input placeholder="City" />
  </div>

  <Button type="submit">Submit</Button>
</form>
```

### In Toolbar

Separate toolbar button groups:

```tsx
<div className="flex items-center gap-2">
  <Button variant="outline" size="icon">
    <Bold className="h-4 w-4" />
  </Button>
  <Button variant="outline" size="icon">
    <Italic className="h-4 w-4" />
  </Button>

  <Separator orientation="vertical" className="h-6" />

  <Button variant="outline" size="icon">
    <AlignLeft className="h-4 w-4" />
  </Button>
  <Button variant="outline" size="icon">
    <AlignCenter className="h-4 w-4" />
  </Button>

  <Separator orientation="vertical" className="h-6" />

  <Button variant="outline" size="icon">
    <Link className="h-4 w-4" />
  </Button>
</div>
```

### Custom Styling

Separator with custom appearance:

```tsx
{/* Thicker separator */}
<Separator className="h-1" />

{/* Colored separator */}
<Separator className="bg-primary" />

{/* Dashed separator */}
<Separator className="border-dashed" />

{/* With margin */}
<Separator className="my-8" />
```

### In Card

Separate card sections:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description</CardDescription>
  </CardHeader>
  <Separator />
  <CardContent className="pt-6">
    <p>Card content goes here</p>
  </CardContent>
  <Separator />
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

## API Reference

### Separator

Visual divider component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Separator orientation |
| `decorative` | `boolean` | `true` | Whether separator is decorative (affects ARIA) |
| `className` | `string` | - | Additional CSS classes |

Extends all Radix UI Separator.Root props.

### Data Attributes

- `data-slot="separator"` - Applied to separator element
- `data-orientation` - Current orientation (horizontal/vertical)

## Accessibility

Separator follows WAI-ARIA separator pattern:

### Decorative vs Semantic

**Decorative** (default):
- `role="none"` - Hidden from accessibility tree
- Purely visual, no semantic meaning
- Use for visual spacing only

```tsx
<Separator decorative />
```

**Semantic**:
- `role="separator"` - Exposed to screen readers
- Has semantic meaning dividing content
- Use when separator conveys structure

```tsx
<Separator decorative={false} aria-label="Content divider" />
```

### Orientation

- `aria-orientation` automatically set based on orientation prop
- Screen readers announce orientation for semantic separators

### Best Practices

::: tip
Use decorative for pure visual styling:
```tsx
{/* Good - purely visual */}
<Separator decorative />

{/* Semantic - structural division */}
<Separator decorative={false} aria-label="End of navigation" />
```
:::

::: tip
For vertical separators, set explicit height:
```tsx
{/* Good - explicit height */}
<Separator orientation="vertical" className="h-4" />

{/* Bad - no height, won't be visible */}
<Separator orientation="vertical" />
```
:::

## Styling

### CSS Variables

Separator uses semantic color tokens:

```css
--border  /* Separator background color */
```

### Default Styling

- **Horizontal**: Full width, 1px height, shrink-0
- **Vertical**: Full height (requires explicit className), 1px width

### Customization

```tsx
{/* Thickness */}
<Separator className="h-px" />      {/* Thinner */}
<Separator className="h-0.5" />     {/* Thin */}
<Separator className="h-1" />       {/* Thick */}

{/* Color */}
<Separator className="bg-border" />        {/* Default */}
<Separator className="bg-primary" />       {/* Brand color */}
<Separator className="bg-muted" />         {/* Subtle */}

{/* Spacing */}
<Separator className="my-2" />      {/* Small margin */}
<Separator className="my-4" />      {/* Medium margin */}
<Separator className="my-8" />      {/* Large margin */}

{/* Style */}
<Separator className="border-dashed" />    {/* Dashed line */}
<Separator className="opacity-50" />       {/* Transparent */}
```

### Dark Mode

- Automatically adapts via `--border` CSS variable
- Maintains contrast in both light and dark themes

## Common Patterns

### Menu with Sections

```tsx
<div className="w-56">
  <div className="space-y-1 p-2">
    <div className="text-sm font-medium">Account</div>
    <button className="w-full text-left px-2 py-1.5">Profile</button>
    <button className="w-full text-left px-2 py-1.5">Settings</button>
  </div>

  <Separator className="my-1" />

  <div className="space-y-1 p-2">
    <div className="text-sm font-medium">Help</div>
    <button className="w-full text-left px-2 py-1.5">Documentation</button>
    <button className="w-full text-left px-2 py-1.5">Support</button>
  </div>

  <Separator className="my-1" />

  <div className="p-2">
    <button className="w-full text-left px-2 py-1.5 text-destructive">
      Logout
    </button>
  </div>
</div>
```

### Settings Page Layout

```tsx
function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Profile</h3>
        <p className="text-sm text-muted-foreground">
          Manage your public profile information.
        </p>
      </div>
      <Separator />
      <ProfileForm />

      <Separator />

      <div>
        <h3 className="text-lg font-medium">Security</h3>
        <p className="text-sm text-muted-foreground">
          Update your security settings.
        </p>
      </div>
      <Separator />
      <SecurityForm />

      <Separator />

      <div>
        <h3 className="text-lg font-medium">Notifications</h3>
        <p className="text-sm text-muted-foreground">
          Configure notification preferences.
        </p>
      </div>
      <Separator />
      <NotificationSettings />
    </div>
  )
}
```

### Breadcrumb with Separators

```tsx
<nav className="flex items-center space-x-2 text-sm">
  <a href="/" className="hover:underline">Home</a>
  <Separator orientation="vertical" className="h-4" />
  <a href="/category" className="hover:underline">Category</a>
  <Separator orientation="vertical" className="h-4" />
  <span className="text-muted-foreground">Current Page</span>
</nav>
```

## Related Components

- [Card](/components/card) - Often used with separators between sections
- [Sidebar](/components/sidebar) - Uses separators to group navigation items
- [Tabs](/components/tabs) - Alternative way to separate content sections
