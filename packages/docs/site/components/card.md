# Card

A flexible container component for grouping related content with consistent styling and structure.

## Installation

```bash
bunx shadcn@latest add card
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@venizia/ardor-admin';

export default function Example() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
      </CardHeader>
      <CardContent>Your content goes here</CardContent>
    </Card>
  );
}
```

## Examples

### Basic Card

```tsx
<Card>
  <CardHeader>
    <CardTitle>Welcome</CardTitle>
  </CardHeader>
  <CardContent>This is a simple card with a title and content.</CardContent>
</Card>
```

### Card with Description

```tsx
<Card>
  <CardHeader>
    <CardTitle>Profile</CardTitle>
    <CardDescription>Manage your profile settings</CardDescription>
  </CardHeader>
  <CardContent>Your profile information goes here.</CardContent>
</Card>
```

### Card with Action

Place action buttons or icons in the top-right corner of the card:

```tsx
import { Button } from '@venizia/ardor-admin';
import { MoreVertical } from 'lucide-react';

<Card>
  <CardHeader>
    <CardTitle>Posts</CardTitle>
    <CardAction>
      <Button size='icon' variant='ghost'>
        <MoreVertical className='h-4 w-4' />
      </Button>
    </CardAction>
  </CardHeader>
  <CardContent>Your latest posts appear here.</CardContent>
</Card>;
```

### Card with Footer

```tsx
import { Button } from '@venizia/ardor-admin';

<Card>
  <CardHeader>
    <CardTitle>Confirm Action</CardTitle>
  </CardHeader>
  <CardContent>Are you sure you want to proceed?</CardContent>
  <CardFooter className='gap-2'>
    <Button variant='outline'>Cancel</Button>
    <Button>Confirm</Button>
  </CardFooter>
</Card>;
```

### Complete Card Example

```tsx
<Card>
  <CardHeader>
    <CardTitle>User Settings</CardTitle>
    <CardDescription>Update your account preferences</CardDescription>
    <CardAction>
      <Button size='icon' variant='ghost'>
        <Settings className='h-4 w-4' />
      </Button>
    </CardAction>
  </CardHeader>
  <CardContent className='space-y-4'>
    <div>
      <Label>Email</Label>
      <Input type='email' defaultValue='user@example.com' />
    </div>
  </CardContent>
  <CardFooter className='gap-2'>
    <Button variant='outline'>Cancel</Button>
    <Button>Save Changes</Button>
  </CardFooter>
</Card>
```

### With Dividers

Use `className` with border utilities to add dividers:

```tsx
<Card>
  <CardHeader className='border-b'>
    <CardTitle>Stats</CardTitle>
  </CardHeader>
  <CardContent>
    <div className='grid grid-cols-3 gap-4'>
      <div>
        <p className='text-muted-foreground text-sm'>Users</p>
        <p className='text-2xl font-bold'>1,234</p>
      </div>
      <div>
        <p className='text-muted-foreground text-sm'>Posts</p>
        <p className='text-2xl font-bold'>567</p>
      </div>
      <div>
        <p className='text-muted-foreground text-sm'>Comments</p>
        <p className='text-2xl font-bold'>890</p>
      </div>
    </div>
  </CardContent>
  <CardFooter className='border-t'>
    <p className='text-muted-foreground text-sm'>Updated 2 minutes ago</p>
  </CardFooter>
</Card>
```

### Custom Layouts

```tsx
<Card>
  <CardHeader>
    <CardTitle>Team Members</CardTitle>
  </CardHeader>
  <CardContent className='space-y-3'>
    {members.map(member => (
      <div key={member.id} className='flex items-center justify-between'>
        <div>
          <p className='font-medium'>{member.name}</p>
          <p className='text-muted-foreground text-sm'>{member.role}</p>
        </div>
        <Badge variant='secondary'>{member.status}</Badge>
      </div>
    ))}
  </CardContent>
</Card>
```

## API Reference

### Card

The main container component for card content.

| Prop        | Type     | Default     | Description                     |
| ----------- | -------- | ----------- | ------------------------------- |
| `className` | `string` | `undefined` | Additional CSS classes to apply |

Extends all standard HTML `<div>` attributes.

### CardHeader

Container for the card's header content (title, description, and actions).

| Prop        | Type     | Default     | Description                     |
| ----------- | -------- | ----------- | ------------------------------- |
| `className` | `string` | `undefined` | Additional CSS classes to apply |

### CardTitle

The main heading for the card.

| Prop        | Type     | Default     | Description                     |
| ----------- | -------- | ----------- | ------------------------------- |
| `className` | `string` | `undefined` | Additional CSS classes to apply |

### CardDescription

Secondary text describing the card's purpose.

| Prop        | Type     | Default     | Description                     |
| ----------- | -------- | ----------- | ------------------------------- |
| `className` | `string` | `undefined` | Additional CSS classes to apply |

### CardAction

Container for action elements (buttons, icons) positioned in the top-right of the header.

| Prop        | Type     | Default     | Description                     |
| ----------- | -------- | ----------- | ------------------------------- |
| `className` | `string` | `undefined` | Additional CSS classes to apply |

### CardContent

Main content area of the card.

| Prop        | Type     | Default     | Description                     |
| ----------- | -------- | ----------- | ------------------------------- |
| `className` | `string` | `undefined` | Additional CSS classes to apply |

### CardFooter

Footer area, typically for actions or additional information.

| Prop        | Type     | Default     | Description                     |
| ----------- | -------- | ----------- | ------------------------------- |
| `className` | `string` | `undefined` | Additional CSS classes to apply |

### Data Attributes

The Card component uses these data attributes for styling:

- `data-slot="card"` - Applied to Card element
- `data-slot="card-header"` - Applied to CardHeader element
- `data-slot="card-title"` - Applied to CardTitle element
- `data-slot="card-description"` - Applied to CardDescription element
- `data-slot="card-action"` - Applied to CardAction element
- `data-slot="card-content"` - Applied to CardContent element
- `data-slot="card-footer"` - Applied to CardFooter element

## Spacing & Layout

The Card component uses a consistent spacing system:

- **Gap between sections**: 24px (6 units)
- **Padding**: 24px (6 units) horizontal, 24px vertical
- **Header border**: Automatic spacing adjustment with `pb-6` when border-b applied
- **Footer border**: Automatic spacing adjustment with `pt-6` when border-t applied

### Grid-Based Header

The CardHeader uses CSS Grid with container queries for responsive layouts:

```tsx
// Automatically adjusts grid columns when CardAction is present
<CardHeader>
  <CardTitle>Title</CardTitle>
  <CardAction>
    <Button>Action</Button>
  </CardAction>
</CardHeader>
```

## Accessibility

- **Semantic Structure**: Use semantic heading tags within CardTitle when appropriate
- **Header Hierarchy**: CardTitle should use appropriate heading levels (h1-h6)
- **Descriptions**: Use CardDescription for additional context
- **Actions**: Ensure action buttons have proper labels and aria attributes

### Best Practices

::: tip
Use semantic HTML for better accessibility:

```tsx
<Card>
  <CardHeader>
    <h2 className='data-slot-title'>My Title</h2>
    <p className='text-muted-foreground text-sm'>Description</p>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

:::

::: warning
Ensure interactive elements within cards have clear labels:

```tsx
<CardAction>
  <Button size='icon' aria-label='More options' variant='ghost'>
    <MoreVertical className='h-4 w-4' />
  </Button>
</CardAction>
```

:::

## Styling

### CSS Variables

The Card uses these CSS variables from your theme:

```css
--card
--card-foreground
--border
--muted-foreground
```

### Border and Dividers

Add borders between sections for visual separation:

```tsx
<Card>
  <CardHeader className='border-b'>
    <CardTitle>Header with bottom border</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter className='border-t'>
    <p>Footer with top border</p>
  </CardFooter>
</Card>
```

When borders are applied, automatic padding adjustments apply:

- `pb-6` on CardHeader with `border-b`
- `pt-6` on CardFooter with `border-t`

### Dark Mode Support

Cards automatically adapt to dark mode:

- Background color changes via CSS variables
- Text color switches to appropriate foreground color
- Border visibility maintained

### Customization

Override or extend card styling:

```tsx
<Card className='border-2 border-purple-300 shadow-lg'>
  <CardHeader className='bg-purple-50'>
    <CardTitle>Custom styled card</CardTitle>
  </CardHeader>
  <CardContent>Content with custom background</CardContent>
</Card>
```

## Common Patterns

### Statistics Card

```tsx
<Card>
  <CardHeader>
    <CardTitle className='text-sm font-medium text-muted-foreground'>Total Users</CardTitle>
  </CardHeader>
  <CardContent>
    <div className='text-3xl font-bold'>12,345</div>
    <p className='text-xs text-muted-foreground mt-2'>+2.5% from last month</p>
  </CardContent>
</Card>
```

### Form Card

```tsx
<Card>
  <CardHeader>
    <CardTitle>Add New Item</CardTitle>
    <CardDescription>Fill in the details below</CardDescription>
  </CardHeader>
  <CardContent className='space-y-4'>
    <Field>
      <Label>Name</Label>
      <Input placeholder='Enter name' />
    </Field>
    <Field>
      <Label>Description</Label>
      <Textarea placeholder='Enter description' />
    </Field>
  </CardContent>
  <CardFooter className='gap-2'>
    <Button variant='outline'>Cancel</Button>
    <Button>Add Item</Button>
  </CardFooter>
</Card>
```

### Information Card

```tsx
<Card>
  <CardHeader>
    <CardTitle>Important Notice</CardTitle>
  </CardHeader>
  <CardContent>
    <Alert>
      <AlertCircle className='h-4 w-4' />
      <AlertTitle>Heads up!</AlertTitle>
      <AlertDescription>Something important you should know about.</AlertDescription>
    </Alert>
  </CardContent>
</Card>
```

### List Card

```tsx
<Card>
  <CardHeader>
    <CardTitle>Recent Activity</CardTitle>
  </CardHeader>
  <CardContent>
    <div className='space-y-4'>
      {activities.map(activity => (
        <ActivityItem key={activity.id} item={activity} />
      ))}
    </div>
  </CardContent>
</Card>
```

## Related Components

- [Button](/components/button) - Interactive actions on cards
- [Field](/components/field) - Form inputs within card content
- [Dialog](/components/dialog) - Use cards for dialog content
- [Sheet](/components/sheet) - Animated card overlays
- [Badge](/components/badge) - Status indicators for card content
- [Alert](/components/alert) - Alert messages within cards
