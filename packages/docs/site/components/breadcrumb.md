# Breadcrumb

A navigation component that displays the current location within a hierarchy. Shows the path from the root to the current page with customizable separators and styles.

## Installation

```bash
bunx shadcn@latest add breadcrumb
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@venizia/ardor-admin'

export default function Example() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="/docs">Docs</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
```

## Examples

### Basic Breadcrumb

Simple breadcrumb navigation:

```tsx
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">Home</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href="/products">Products</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Current Page</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

### With Icons

Breadcrumb with icon separators:

```tsx
import { Home, ChevronRight } from 'lucide-react'

<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">
        <Home className="h-4 w-4" />
      </BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator>
      <ChevronRight className="h-4 w-4" />
    </BreadcrumbSeparator>
    <BreadcrumbItem>
      <BreadcrumbLink href="/docs">Documentation</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator>
      <ChevronRight className="h-4 w-4" />
    </BreadcrumbSeparator>
    <BreadcrumbItem>
      <BreadcrumbPage>Components</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

### With Dropdown Menu

Breadcrumb with collapsed items in dropdown:

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@venizia/ardor-admin'
import { ChevronDown } from 'lucide-react'

<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">Home</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1">
          <BreadcrumbEllipsis className="h-4 w-4" />
          <ChevronDown className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem>
            <a href="/docs">Documentation</a>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <a href="/components">Components</a>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <a href="/examples">Examples</a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Current Page</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

### With Custom Separator

Use custom separator character:

```tsx
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">Home</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator>/</BreadcrumbSeparator>
    <BreadcrumbItem>
      <BreadcrumbLink href="/blog">Blog</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator>/</BreadcrumbSeparator>
    <BreadcrumbItem>
      <BreadcrumbPage>Post Title</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

### Responsive Breadcrumb

Breadcrumb that collapses on mobile:

```tsx
import { useMediaQuery } from '@/hooks/use-media-query'

function ResponsiveBreadcrumb() {
  const isMobile = useMediaQuery('(max-width: 768px)')

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {!isMobile && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}
        <BreadcrumbItem>
          <BreadcrumbLink href="/products">Products</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Current Item</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
```

### With Ellipsis

Breadcrumb with collapsed middle items:

```tsx
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">Home</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbEllipsis />
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href="/components">Components</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

### Multi-level Navigation

Deep navigation hierarchy:

```tsx
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href="/settings">Settings</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href="/settings/profile">Profile</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href="/settings/profile/security">
        Security
      </BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Two-Factor Auth</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

### With Next.js Link

Integration with Next.js routing:

```tsx
import Link from 'next/link'

<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink asChild>
        <Link href="/">Home</Link>
      </BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink asChild>
        <Link href="/products">Products</Link>
      </BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Current Product</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

## API Reference

### Breadcrumb

Root breadcrumb container.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML nav attributes.

### BreadcrumbList

Ordered list containing breadcrumb items.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML ol attributes.

### BreadcrumbItem

Individual breadcrumb item container.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML li attributes.

### BreadcrumbLink

Clickable breadcrumb link.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props into child element |
| `className` | `string` | - | Additional CSS classes |

Extends all HTML anchor attributes.

### BreadcrumbPage

Current page indicator (non-clickable).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML span attributes.

### BreadcrumbSeparator

Visual separator between breadcrumb items.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | `<ChevronRight />` | Custom separator content |
| `className` | `string` | - | Additional CSS classes |

Extends all HTML li attributes.

### BreadcrumbEllipsis

Ellipsis indicator for collapsed items.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML span attributes.

### Data Attributes

- `data-slot="breadcrumb"` - Root breadcrumb element
- `data-slot="breadcrumb-list"` - List container
- `data-slot="breadcrumb-item"` - Individual item
- `data-slot="breadcrumb-link"` - Link element
- `data-slot="breadcrumb-page"` - Current page
- `data-slot="breadcrumb-separator"` - Separator element
- `data-slot="breadcrumb-ellipsis"` - Ellipsis element

## Accessibility

Breadcrumb follows WAI-ARIA breadcrumb pattern:

### Semantic HTML

- Uses `<nav>` with `aria-label="breadcrumb"`
- Ordered list (`<ol>`) for items
- Proper link hierarchy

### Screen Reader Support

```tsx
<Breadcrumb aria-label="Breadcrumb navigation">
  <BreadcrumbList>
    {/* Items */}
  </BreadcrumbList>
</Breadcrumb>
```

### Current Page Indication

- `BreadcrumbPage` has `aria-current="page"`
- Visual distinction from links
- Not clickable

### Keyboard Navigation

- **Tab** - Navigate through links
- **Enter** - Activate focused link
- **Shift + Tab** - Navigate backwards

### Best Practices

::: tip
Always use `BreadcrumbPage` for the current page:
```tsx
{/* Good - current page not clickable */}
<BreadcrumbItem>
  <BreadcrumbPage>Current</BreadcrumbPage>
</BreadcrumbItem>

{/* Bad - current page as link */}
<BreadcrumbItem>
  <BreadcrumbLink href="/current">Current</BreadcrumbLink>
</BreadcrumbItem>
```
:::

::: tip
Provide meaningful link text:
```tsx
{/* Good - descriptive */}
<BreadcrumbLink href="/products">All Products</BreadcrumbLink>

{/* Bad - generic */}
<BreadcrumbLink href="/products">Click Here</BreadcrumbLink>
```
:::

## Styling

### CSS Variables

Breadcrumb uses semantic color tokens:

```css
--foreground         /* Link text color */
--muted-foreground   /* Separator color */
```

### Component Structure

- **Breadcrumb**: Semantic nav wrapper
- **BreadcrumbList**: Flexbox layout with gaps
- **BreadcrumbItem**: Inline flex items
- **BreadcrumbLink**: Underline on hover, transition effects
- **BreadcrumbPage**: Disabled appearance, normal font weight
- **BreadcrumbSeparator**: Muted color, hidden from screen readers

### Customization

```tsx
{/* Custom separator color */}
<BreadcrumbSeparator className="text-primary" />

{/* Custom link styling */}
<BreadcrumbLink className="font-bold" href="/">
  Home
</BreadcrumbLink>

{/* Custom spacing */}
<BreadcrumbList className="gap-4">
  {/* Items */}
</BreadcrumbList>
```

### Dark Mode

- Automatically adapts using CSS variables
- Separator color adjusts for contrast
- Link hover states maintain visibility

## Common Patterns

### Dynamic Breadcrumb from Route

```tsx
import { usePathname } from 'next/navigation'

function DynamicBreadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join('/')}`
          const isLast = index === segments.length - 1
          const label = segment.charAt(0).toUpperCase() + segment.slice(1)

          return (
            <React.Fragment key={href}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
```

### E-commerce Product Navigation

```tsx
function ProductBreadcrumb({ category, subcategory, product }: {
  category: string
  subcategory: string
  product: string
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="/shop">Shop</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href={`/shop/${category}`}>
            {category}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href={`/shop/${category}/${subcategory}`}>
            {subcategory}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{product}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
```

### Breadcrumb with SEO Metadata

```tsx
import Head from 'next/head'

function SEOBreadcrumb({ items }: { items: Array<{ name: string; href?: string }> }) {
  // Build structured data for SEO
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.href ? `https://example.com${item.href}` : undefined,
    })),
  }

  return (
    <>
      <Head>
        <script
          type="application/ld+json"
        >
          {JSON.stringify(structuredData)}
        </script>
      </Head>
      <Breadcrumb>
        <BreadcrumbList>
          {items.map((item, index) => {
            const isLast = index === items.length - 1
            return (
              <React.Fragment key={index}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {isLast || !item.href ? (
                    <BreadcrumbPage>{item.name}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={item.href}>
                      {item.name}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  )
}
```

## Related Components

- [Tabs](/components/tabs) - For alternative navigation patterns
- [Sidebar](/components/sidebar) - For persistent navigation
- [Dropdown Menu](/components/dropdown-menu) - For collapsed breadcrumb items
