# Badge

A small count or status indicator that can be added to other elements. Includes extensive color variants for semantic meaning.

## Installation

```bash
bunx shadcn@latest add badge
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Badge } from '@venizia/ardor-admin'

export default function Example() {
  return <Badge>New</Badge>
}
```

## Examples

### Basic Badge

Simple badge with default styling:

```tsx
<Badge>Badge</Badge>
```

### Standard Variants

Core badge variants:

```tsx
<div className="flex gap-2">
  <Badge variant="default">Default</Badge>
  <Badge variant="secondary">Secondary</Badge>
  <Badge variant="outline">Outline</Badge>
  <Badge variant="destructive">Destructive</Badge>
</div>
```

### Color Variants

ARDOR provides 19 color variants for semantic meaning:

```tsx
<div className="flex flex-wrap gap-2">
  <Badge variant="red">Red</Badge>
  <Badge variant="orange">Orange</Badge>
  <Badge variant="amber">Amber</Badge>
  <Badge variant="yellow">Yellow</Badge>
  <Badge variant="lime">Lime</Badge>
  <Badge variant="green">Green</Badge>
  <Badge variant="emerald">Emerald</Badge>
  <Badge variant="teal">Teal</Badge>
  <Badge variant="cyan">Cyan</Badge>
  <Badge variant="sky">Sky</Badge>
  <Badge variant="blue">Blue</Badge>
  <Badge variant="indigo">Indigo</Badge>
  <Badge variant="violet">Violet</Badge>
  <Badge variant="purple">Purple</Badge>
  <Badge variant="fuchsia">Fuchsia</Badge>
  <Badge variant="pink">Pink</Badge>
  <Badge variant="rose">Rose</Badge>
</div>
```

### With Icons

Badges with icon indicators:

```tsx
import { Check, X, AlertTriangle, Info } from 'lucide-react'

<div className="flex gap-2">
  <Badge variant="green">
    <Check className="h-3 w-3" />
    Active
  </Badge>
  <Badge variant="red">
    <X className="h-3 w-3" />
    Inactive
  </Badge>
  <Badge variant="yellow">
    <AlertTriangle className="h-3 w-3" />
    Warning
  </Badge>
  <Badge variant="blue">
    <Info className="h-3 w-3" />
    Info
  </Badge>
</div>
```

### Icon Only

Badges with just icons:

```tsx
import { Star } from 'lucide-react'

<div className="flex gap-2">
  <Badge variant="yellow">
    <Star className="h-3 w-3 fill-current" />
  </Badge>
  <Badge variant="default">
    <Check className="h-3 w-3" />
  </Badge>
</div>
```

### Status Indicators

Common status badge patterns:

```tsx
<div className="flex gap-2">
  <Badge variant="green">Active</Badge>
  <Badge variant="yellow">Pending</Badge>
  <Badge variant="red">Inactive</Badge>
  <Badge variant="blue">Draft</Badge>
  <Badge variant="purple">Archived</Badge>
</div>
```

### Notification Count

Badge showing counts:

```tsx
<div className="flex gap-4">
  <div className="relative">
    <Button variant="outline">
      Messages
    </Button>
    <Badge className="absolute -top-2 -right-2" variant="red">
      3
    </Badge>
  </div>

  <div className="relative">
    <Button variant="outline">
      Notifications
    </Button>
    <Badge className="absolute -top-2 -right-2" variant="default">
      12
    </Badge>
  </div>
</div>
```

### As Link

Badge as clickable link:

```tsx
<Badge asChild variant="blue">
  <a href="/tags/react">React</a>
</Badge>
```

### Badge List

Multiple badges together:

```tsx
<div className="flex flex-wrap gap-2">
  <Badge variant="blue">TypeScript</Badge>
  <Badge variant="cyan">React</Badge>
  <Badge variant="green">Tailwind</Badge>
  <Badge variant="purple">Next.js</Badge>
  <Badge variant="pink">UI/UX</Badge>
</div>
```

## API Reference

### Badge

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `BadgeVariant` | `"default"` | Visual style variant |
| `asChild` | `boolean` | `false` | Merge props into child element |
| `className` | `string` | - | Additional CSS classes |

Extends all HTML span attributes.

### Badge Variants

**Standard Variants:**
- `default` - Primary brand color
- `secondary` - Secondary gray color
- `outline` - Outlined with border
- `destructive` - Red/error state

**Color Variants:**
- `red` - Red (errors, alerts)
- `orange` - Orange (warnings)
- `amber` - Amber (caution)
- `yellow` - Yellow (pending)
- `lime` - Lime (success alt)
- `green` - Green (success, active)
- `emerald` - Emerald (verified)
- `teal` - Teal (info alt)
- `cyan` - Cyan (info)
- `sky` - Sky (info alt)
- `blue` - Blue (primary info)
- `indigo` - Indigo (premium)
- `violet` - Violet (special)
- `purple` - Purple (featured)
- `fuchsia` - Fuchsia (highlight)
- `pink` - Pink (love, favorites)
- `rose` - Rose (romantic)

### Data Attributes

- `data-slot="badge"` - Applied to badge element

## Accessibility

Badges are primarily visual indicators:

### Screen Reader Support

- Use `aria-label` when badge is standalone:
```tsx
<Badge aria-label="3 new notifications">3</Badge>
```

- Provide context for icon-only badges:
```tsx
<Badge aria-label="Active status">
  <Check className="h-3 w-3" />
</Badge>
```

### Best Practices

::: tip
Provide semantic meaning through color:
```tsx
<Badge variant="green">Verified</Badge>
<Badge variant="red">Expired</Badge>
<Badge variant="yellow">Pending</Badge>
```
:::

::: tip
Don't rely solely on color - add text or icons:
```tsx
{/* Good */}
<Badge variant="green">
  <Check /> Active
</Badge>

{/* Less accessible - color only */}
<Badge variant="green" />
```
:::

## Styling

### CSS Variables

Badges use semantic color tokens:

```css
--primary            /* Default variant */
--primary-foreground
--secondary          /* Secondary variant */
--secondary-foreground
--destructive        /* Destructive variant */
--foreground         /* Outline variant */
```

Color variants use Tailwind color scales with dark mode support.

### Visual Design

- **Shape**: Rounded pill (rounded-full)
- **Size**: Compact with `px-1.5 py-px` padding
- **Text**: Small (text-xs) semi-bold
- **Icons**: Auto-sized to 12px (size-3)

### Hover States

When used as links (`[a&]` selector):
- Background opacity changes on hover
- Smooth transition effects

### Customization

```tsx
<Badge className="px-3 py-1 text-sm font-bold rounded-md">
  Custom Badge
</Badge>
```

### Dark Mode

All color variants automatically adapt to dark mode:
- Lighter tints in dark mode
- Proper contrast maintained
- Focus rings adjusted

## Common Patterns

### Product Status

```tsx
function ProductCard({ product }: { product: Product }) {
  const statusColors = {
    available: 'green',
    'low-stock': 'yellow',
    'out-of-stock': 'red',
  } as const

  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start">
        <h3>{product.name}</h3>
        <Badge variant={statusColors[product.status]}>
          {product.status.replace('-', ' ')}
        </Badge>
      </div>
    </div>
  )
}
```

### User Role Badges

```tsx
function UserRole({ role }: { role: string }) {
  const roleConfig = {
    admin: { variant: 'red', label: 'Admin' },
    moderator: { variant: 'orange', label: 'Moderator' },
    member: { variant: 'blue', label: 'Member' },
    guest: { variant: 'secondary', label: 'Guest' },
  } as const

  const config = roleConfig[role as keyof typeof roleConfig]

  return <Badge variant={config.variant}>{config.label}</Badge>
}
```

### Tag System

```tsx
function TagList({ tags }: { tags: string[] }) {
  const colors: BadgeCompVariantsType[] = [
    'blue', 'green', 'purple', 'pink', 'cyan', 'indigo'
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, i) => (
        <Badge
          key={tag}
          variant={colors[i % colors.length]}
          asChild
        >
          <a href={`/tags/${tag}`}>#{tag}</a>
        </Badge>
      ))}
    </div>
  )
}
```

### Notification Badge

```tsx
function NotificationIcon({ count }: { count: number }) {
  return (
    <div className="relative inline-block">
      <Button variant="ghost" size="icon">
        <Bell className="h-5 w-5" />
      </Button>
      {count > 0 && (
        <Badge
          variant="red"
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0"
        >
          {count > 9 ? '9+' : count}
        </Badge>
      )}
    </div>
  )
}
```

### Priority Levels

```tsx
function PriorityBadge({ priority }: { priority: 'low' | 'medium' | 'high' | 'urgent' }) {
  const config = {
    low: { variant: 'blue', label: 'Low' },
    medium: { variant: 'yellow', label: 'Medium' },
    high: { variant: 'orange', label: 'High' },
    urgent: { variant: 'red', label: 'Urgent' },
  } as const

  return (
    <Badge variant={config[priority].variant}>
      {config[priority].label}
    </Badge>
  )
}
```

### Feature Badges

```tsx
<div className="space-y-4">
  <div className="flex items-center gap-2">
    <h3>Premium Features</h3>
    <Badge variant="purple">Pro</Badge>
  </div>

  <div className="flex items-center gap-2">
    <span>New Dashboard</span>
    <Badge variant="blue">New</Badge>
  </div>

  <div className="flex items-center gap-2">
    <span>Beta Feature</span>
    <Badge variant="yellow">Beta</Badge>
  </div>

  <div className="flex items-center gap-2">
    <span>Verified Account</span>
    <Badge variant="green">
      <Check className="h-3 w-3" />
      Verified
    </Badge>
  </div>
</div>
```

### Status Timeline

```tsx
function OrderStatus({ status }: { status: string }) {
  const steps = [
    { label: 'Ordered', status: 'completed', color: 'green' },
    { label: 'Processing', status: 'completed', color: 'green' },
    { label: 'Shipped', status: 'current', color: 'blue' },
    { label: 'Delivered', status: 'pending', color: 'secondary' },
  ] as const

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          <Badge variant={step.color}>{step.label}</Badge>
          {i < steps.length - 1 && (
            <div className="h-px w-4 bg-border" />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
```

## Related Components

- [Button](/components/button) - For interactive actions
- [Alert](/components/alert) - For prominent notifications
- [Tabs](/components/tabs) - For navigation with badges
- [Card](/components/card) - For containers with badge indicators
