# Empty

A flexible component for displaying empty states with icons, titles, descriptions, and actions. Perfect for showing no data, empty search results, or prompting user actions.

## Installation

```bash
bunx shadcn@latest add empty
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@venizia/ardor-admin'
import { Inbox } from 'lucide-react'

export default function Example() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <Inbox className="size-12" />
        </EmptyMedia>
        <EmptyTitle>No messages</EmptyTitle>
        <EmptyDescription>
          You don't have any messages yet.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
```

## Examples

### Basic Empty State

Simple empty state with icon and text:

```tsx
import { FileX } from 'lucide-react'

<Empty>
  <EmptyHeader>
    <EmptyMedia>
      <FileX className="size-12" />
    </EmptyMedia>
    <EmptyTitle>No files found</EmptyTitle>
    <EmptyDescription>
      Upload your first file to get started.
    </EmptyDescription>
  </EmptyHeader>
</Empty>
```

### With Action Button

Empty state with call-to-action:

```tsx
import { Plus, Folder } from 'lucide-react'
import { Button } from '@venizia/ardor-admin'

<Empty>
  <EmptyHeader>
    <EmptyMedia>
      <Folder className="size-12" />
    </EmptyMedia>
    <EmptyTitle>No projects yet</EmptyTitle>
    <EmptyDescription>
      Get started by creating your first project.
    </EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button>
      <Plus className="h-4 w-4" />
      Create Project
    </Button>
  </EmptyContent>
</Empty>
```

### Icon Variant

Empty state with icon background:

```tsx
import { Database } from 'lucide-react'

<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon">
      <Database />
    </EmptyMedia>
    <EmptyTitle>No data available</EmptyTitle>
    <EmptyDescription>
      There is currently no data to display.
    </EmptyDescription>
  </EmptyHeader>
</Empty>
```

### Search Results Empty

Empty state for search with no results:

```tsx
import { SearchX } from 'lucide-react'

<Empty>
  <EmptyHeader>
    <EmptyMedia>
      <SearchX className="size-12" />
    </EmptyMedia>
    <EmptyTitle>No results found</EmptyTitle>
    <EmptyDescription>
      We couldn't find anything matching your search. Try different keywords.
    </EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button variant="outline">Clear search</Button>
  </EmptyContent>
</Empty>
```

### Multiple Actions

Empty state with multiple action buttons:

```tsx
import { PackageOpen } from 'lucide-react'

<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon">
      <PackageOpen />
    </EmptyMedia>
    <EmptyTitle>No items in cart</EmptyTitle>
    <EmptyDescription>
      Add some products to your cart to continue shopping.
    </EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <div className="flex gap-2">
      <Button>Browse Products</Button>
      <Button variant="outline">View Wishlist</Button>
    </div>
  </EmptyContent>
</Empty>
```

### With Link in Description

Empty state with inline link:

```tsx
import { Users } from 'lucide-react'

<Empty>
  <EmptyHeader>
    <EmptyMedia>
      <Users className="size-12" />
    </EmptyMedia>
    <EmptyTitle>No team members</EmptyTitle>
    <EmptyDescription>
      Invite team members to collaborate on this project.{' '}
      <a href="/help/invitations" className="underline">Learn more</a>
    </EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button>Invite Members</Button>
  </EmptyContent>
</Empty>
```

### Error State

Empty state for errors:

```tsx
import { AlertCircle } from 'lucide-react'

<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon">
      <AlertCircle className="text-destructive" />
    </EmptyMedia>
    <EmptyTitle>Failed to load data</EmptyTitle>
    <EmptyDescription>
      There was an error loading your data. Please try again.
    </EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button variant="outline">Retry</Button>
  </EmptyContent>
</Empty>
```

### Illustration Empty State

Empty state with custom illustration:

```tsx
<Empty>
  <EmptyHeader>
    <EmptyMedia>
      <img src="/illustrations/empty-inbox.svg" alt="" className="size-32" />
    </EmptyMedia>
    <EmptyTitle>All caught up!</EmptyTitle>
    <EmptyDescription>
      You've read all your notifications. Check back later for updates.
    </EmptyDescription>
  </EmptyHeader>
</Empty>
```

## API Reference

### Empty

Root container for empty state.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML div attributes with flex layout and centered content.

### EmptyHeader

Container for icon, title, and description.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Groups primary empty state messaging.

### EmptyMedia

Container for icon or illustration.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"default" \| "icon"` | `"default"` | Media display style |
| `className` | `string` | - | Additional CSS classes |

**Variants:**
- `default` - Transparent background, for large icons/illustrations
- `icon` - Muted background, 40px container for smaller icons

### EmptyTitle

Title text for empty state.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML div attributes with large font styling.

### EmptyDescription

Description text with optional inline links.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML p attributes. Links inside are automatically styled.

### EmptyContent

Container for action buttons or additional content.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Typically contains Button components or other interactive elements.

### Data Attributes

- `data-slot="empty"` - Root container
- `data-slot="empty-header"` - Header section
- `data-slot="empty-icon"` - Media container
- `data-slot="empty-title"` - Title element
- `data-slot="empty-description"` - Description element
- `data-slot="empty-content"` - Content section
- `data-variant` - Media variant value

## Accessibility

Empty maintains accessibility best practices:

### Semantic Structure

- Uses semantic HTML elements
- Logical heading hierarchy
- Descriptive text content

### Screen Reader Support

- Meaningful icon alternative text when needed
- Clear, concise messaging
- Action buttons properly labeled

### Focus Management

- Interactive elements are focusable
- Keyboard navigation works naturally
- Clear focus indicators on buttons

### Best Practices

::: tip
Provide clear, actionable messaging:
```tsx
{/* Good - Specific and actionable */}
<EmptyTitle>No products in your store</EmptyTitle>
<EmptyDescription>
  Add your first product to start selling.
</EmptyDescription>

{/* Bad - Vague */}
<EmptyTitle>Empty</EmptyTitle>
<EmptyDescription>
  Nothing here.
</EmptyDescription>
```
:::

::: tip
Use appropriate icons:
```tsx
{/* Good - Related to content */}
<EmptyMedia><Inbox /></EmptyMedia> {/* For messages */}
<EmptyMedia><FolderX /></EmptyMedia> {/* For files */}
<EmptyMedia><ShoppingCart /></EmptyMedia> {/* For cart */}

{/* Bad - Generic or confusing */}
<EmptyMedia><AlertTriangle /></EmptyMedia> {/* Implies error */}
```
:::

## Styling

### CSS Variables

Empty uses semantic color tokens:

```css
--muted             /* Icon background (icon variant) */
--foreground        /* Title and icon color */
--muted-foreground  /* Description text */
--primary           /* Links in description */
```

### Layout

- **Container**: Full width, flex column, centered
- **Header**: Max width 448px (28rem), centered text
- **Media**: Flexible sizing, shrink-0
- **Content**: Max width 448px (28rem), gap-4

### Customization

```tsx
{/* Custom container styling */}
<Empty className="min-h-[400px] bg-muted/20">
  {/* ... */}
</Empty>

{/* Custom media size */}
<EmptyMedia className="mb-6">
  <Icon className="size-20" />
</EmptyMedia>

{/* Custom title styling */}
<EmptyTitle className="text-2xl">
  Custom Title
</EmptyTitle>

{/* Custom description width */}
<EmptyDescription className="max-w-lg">
  Longer description text with more context...
</EmptyDescription>
```

### Dark Mode

- Automatically adapts via CSS variables
- Muted backgrounds adjust for proper contrast
- Link colors remain accessible

## Common Patterns

### Conditional Empty State

```tsx
function ProductList({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Package />
          </EmptyMedia>
          <EmptyTitle>No products found</EmptyTitle>
          <EmptyDescription>
            Add your first product to get started.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => navigate('/products/new')}>
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
```

### Search Empty State with Filter Reset

```tsx
function SearchResults({ query, results, onClearFilters }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <SearchX className="size-12" />
          </EmptyMedia>
          <EmptyTitle>No results for "{query}"</EmptyTitle>
          <EmptyDescription>
            We couldn't find any matches. Try adjusting your search or filters.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClearFilters}>
              Clear Filters
            </Button>
            <Button variant="ghost" onClick={() => navigate('/search')}>
              View All
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    )
  }

  return <ResultsList results={results} />
}
```

### Permission-Based Empty State

```tsx
function TeamMembers({ canInvite }: { canInvite: boolean }) {
  const [members, setMembers] = useState([])

  if (members.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>No team members</EmptyTitle>
          <EmptyDescription>
            {canInvite
              ? 'Invite team members to collaborate on this project.'
              : 'Ask your admin to invite team members.'}
          </EmptyDescription>
        </EmptyHeader>
        {canInvite && (
          <EmptyContent>
            <Button>
              <UserPlus className="h-4 w-4" />
              Invite Members
            </Button>
          </EmptyContent>
        )}
      </Empty>
    )
  }

  return <MemberList members={members} />
}
```

## Related Components

- [Button](/components/button) - For empty state actions
- [Card](/components/card) - Can contain empty states
- [Alert](/components/alert) - For error empty states
- [Spinner](/components/spinner) - For loading states before empty
