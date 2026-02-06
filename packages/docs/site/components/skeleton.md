# Skeleton

A placeholder component that displays a loading state while content is being fetched. Uses a subtle pulse animation to indicate loading.

## Installation

```bash
bunx shadcn@latest add skeleton
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Skeleton } from '@venizia/ardor-admin'

export default function Example() {
  return <Skeleton className="h-4 w-full" />
}
```

## Examples

### Basic Skeleton

Simple loading placeholder:

```tsx
<Skeleton className="h-12 w-12 rounded-full" />
```

### Text Lines

Skeleton for text content:

```tsx
<div className="space-y-2">
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-3/4" />
</div>
```

### Card Skeleton

Loading state for card component:

```tsx
<div className="flex flex-col space-y-3">
  <Skeleton className="h-[125px] w-[250px] rounded-xl" />
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </div>
</div>
```

### Avatar with Text

User profile loading state:

```tsx
<div className="flex items-center space-x-4">
  <Skeleton className="h-12 w-12 rounded-full" />
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </div>
</div>
```

### List Items

Loading list with multiple items:

```tsx
<div className="space-y-4">
  {Array.from({ length: 5 }).map((_, i) => (
    <div key={i} className="flex items-center space-x-4">
      <Skeleton className="h-12 w-12 rounded-md" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  ))}
</div>
```

### Table Skeleton

Loading state for data table:

```tsx
<div className="space-y-2">
  <div className="flex gap-4">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
  </div>
  {Array.from({ length: 5 }).map((_, i) => (
    <div key={i} className="flex gap-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  ))}
</div>
```

### Image Skeleton

Placeholder for images:

```tsx
<div className="space-y-4">
  <Skeleton className="h-64 w-full rounded-lg" />
  <div className="space-y-2">
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-2/3" />
  </div>
</div>
```

### Form Skeleton

Loading state for form fields:

```tsx
<div className="space-y-4">
  <div className="space-y-2">
    <Skeleton className="h-4 w-20" />
    <Skeleton className="h-10 w-full" />
  </div>
  <div className="space-y-2">
    <Skeleton className="h-4 w-20" />
    <Skeleton className="h-10 w-full" />
  </div>
  <div className="space-y-2">
    <Skeleton className="h-4 w-20" />
    <Skeleton className="h-24 w-full" />
  </div>
  <Skeleton className="h-10 w-24" />
</div>
```

### Dashboard Widget

Loading state for dashboard card:

```tsx
<div className="border rounded-lg p-6 space-y-4">
  <div className="flex justify-between items-start">
    <Skeleton className="h-6 w-32" />
    <Skeleton className="h-8 w-8 rounded-full" />
  </div>
  <Skeleton className="h-12 w-24" />
  <div className="space-y-2">
    <Skeleton className="h-2 w-full" />
    <Skeleton className="h-3 w-20" />
  </div>
</div>
```

## API Reference

### Skeleton

Loading placeholder component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML div attributes.

### Data Attributes

- `data-slot="skeleton"` - Applied to skeleton element

## Accessibility

Skeleton is primarily a visual loading indicator:

### Screen Reader Support

For accessibility, consider adding ARIA attributes:

```tsx
<div role="status" aria-label="Loading content">
  <Skeleton className="h-4 w-full" />
  <span className="sr-only">Loading...</span>
</div>
```

### Best Practices

::: tip
Match skeleton dimensions to actual content:
```tsx
{/* Good - matches expected content size */}
<Skeleton className="h-[200px] w-full" />

{/* Bad - arbitrary size */}
<Skeleton className="h-20 w-20" />
```
:::

::: tip
Use multiple skeletons for complex layouts:
```tsx
<div className="space-y-4">
  <Skeleton className="h-12 w-12 rounded-full" />
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-3/4" />
</div>
```
:::

## Styling

### CSS Variables

Skeleton uses semantic color tokens:

```css
--accent       /* Background color */
```

### Animations

- **animate-pulse**: Built-in Tailwind CSS pulse animation
- Smooth opacity changes create loading effect

### Customization

```tsx
{/* Custom color */}
<Skeleton className="bg-primary/20" />

{/* No animation */}
<Skeleton className="animate-none bg-muted" />

{/* Custom shape */}
<Skeleton className="h-16 w-16 rounded-lg" />

{/* Gradient effect */}
<Skeleton className="bg-gradient-to-r from-muted to-muted-foreground/20" />
```

### Dark Mode

- Automatically adapts via `--accent` CSS variable
- Maintains subtle appearance in both modes

## Common Patterns

### Blog Post Skeleton

```tsx
function BlogPostSkeleton() {
  return (
    <article className="space-y-4">
      <Skeleton className="h-64 w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-3/4" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </article>
  )
}
```

### Product Card Skeleton

```tsx
function ProductCardSkeleton() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Skeleton className="h-48 w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
    </div>
  )
}
```

### Data Table Skeleton

```tsx
function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex gap-4 p-4 bg-muted rounded-t-lg">
        <Skeleton className="h-5 w-1/4" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-5 w-1/4" />
        <Skeleton className="h-5 w-1/6" />
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border-b">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/6" />
        </div>
      ))}
    </div>
  )
}
```

### Conditional Rendering

```tsx
function UserProfile({ user, isLoading }: { user?: User; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[150px]" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-4">
      <Avatar>
        <AvatarImage src={user?.avatar} />
        <AvatarFallback>{user?.initials}</AvatarFallback>
      </Avatar>
      <div>
        <p className="font-medium">{user?.name}</p>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>
    </div>
  )
}
```

### Suspense Boundary

```tsx
import { Suspense } from 'react'

function DataDisplay() {
  return (
    <Suspense fallback={<DataSkeleton />}>
      <AsyncDataComponent />
    </Suspense>
  )
}

function DataSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  )
}
```

## Related Components

- [Spinner](/components/spinner) - For inline loading indicators
- [Card](/components/card) - Often used with skeleton loading states
- [Avatar](/components/avatar) - Frequently needs skeleton placeholder
