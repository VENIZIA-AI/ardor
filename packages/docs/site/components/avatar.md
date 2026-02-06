# Avatar

A circular component to display user profile pictures, initials, or fallback icons. Built with Radix UI Avatar primitive with automatic fallback handling.

## Installation

```bash
bunx shadcn@latest add avatar
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Avatar, AvatarImage, AvatarFallback } from '@venizia/ardor-admin'

export default function Example() {
  return (
    <Avatar>
      <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  )
}
```

## Examples

### Basic Avatar

Avatar with image and fallback:

```tsx
<Avatar>
  <AvatarImage src="/avatars/user.jpg" alt="User Name" />
  <AvatarFallback>UN</AvatarFallback>
</Avatar>
```

### Fallback Only

Display initials when no image available:

```tsx
<Avatar>
  <AvatarFallback>JD</AvatarFallback>
</Avatar>
```

### With Icon Fallback

Use an icon as fallback:

```tsx
import { User } from 'lucide-react'

<Avatar>
  <AvatarImage src="/avatars/broken-link.jpg" />
  <AvatarFallback>
    <User className="h-4 w-4" />
  </AvatarFallback>
</Avatar>
```

### Different Sizes

Avatars in various sizes:

```tsx
<div className="flex items-center gap-4">
  <Avatar className="size-6">
    <AvatarImage src="/avatar.jpg" />
    <AvatarFallback className="text-xs">SM</AvatarFallback>
  </Avatar>

  <Avatar className="size-7">
    <AvatarImage src="/avatar.jpg" />
    <AvatarFallback>MD</AvatarFallback>
  </Avatar>

  <Avatar className="size-10">
    <AvatarImage src="/avatar.jpg" />
    <AvatarFallback>LG</AvatarFallback>
  </Avatar>

  <Avatar className="size-16">
    <AvatarImage src="/avatar.jpg" />
    <AvatarFallback className="text-xl">XL</AvatarFallback>
  </Avatar>
</div>
```

### Avatar Group

Multiple avatars stacked together:

```tsx
<div className="flex -space-x-4">
  <Avatar className="border-2 border-background">
    <AvatarImage src="/avatars/01.jpg" />
    <AvatarFallback>JD</AvatarFallback>
  </Avatar>
  <Avatar className="border-2 border-background">
    <AvatarImage src="/avatars/02.jpg" />
    <AvatarFallback>AB</AvatarFallback>
  </Avatar>
  <Avatar className="border-2 border-background">
    <AvatarImage src="/avatars/03.jpg" />
    <AvatarFallback>CD</AvatarFallback>
  </Avatar>
  <Avatar className="border-2 border-background">
    <AvatarFallback>+3</AvatarFallback>
  </Avatar>
</div>
```

### With Status Indicator

Avatar with online/offline status:

```tsx
<div className="relative">
  <Avatar>
    <AvatarImage src="/avatar.jpg" />
    <AvatarFallback>JD</AvatarFallback>
  </Avatar>
  <span className="absolute bottom-0 right-0 block size-2.5 rounded-full bg-green-500 ring-2 ring-background" />
</div>
```

### Clickable Avatar

Avatar as button with tooltip:

```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@venizia/ardor-admin'

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <button className="rounded-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
        <Avatar>
          <AvatarImage src="/avatar.jpg" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
      </button>
    </TooltipTrigger>
    <TooltipContent>
      <p>John Doe</p>
      <p className="text-xs text-muted-foreground">john@example.com</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### User Profile Card

Avatar with name and description:

```tsx
<div className="flex items-center gap-3">
  <Avatar className="size-12">
    <AvatarImage src="/avatar.jpg" />
    <AvatarFallback>JD</AvatarFallback>
  </Avatar>
  <div>
    <p className="text-sm font-medium">John Doe</p>
    <p className="text-xs text-muted-foreground">john@example.com</p>
  </div>
</div>
```

### With Badge

Avatar with notification badge:

```tsx
import { Badge } from '@venizia/ardor-admin'

<div className="relative inline-block">
  <Avatar>
    <AvatarImage src="/avatar.jpg" />
    <AvatarFallback>JD</AvatarFallback>
  </Avatar>
  <Badge className="absolute -right-1 -top-1 size-5 items-center justify-center p-0">
    3
  </Badge>
</div>
```

## API Reference

### Avatar

Root avatar container.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML div attributes with `size-7` default size.

### AvatarImage

Image element within avatar.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | - | Image source URL |
| `alt` | `string` | - | Alternative text for image |
| `className` | `string` | - | Additional CSS classes |

Extends Radix UI Avatar.Image. Automatically shows fallback if image fails to load.

### AvatarFallback

Fallback content shown when image unavailable.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `delayMs` | `number` | - | Delay before showing fallback |

Extends Radix UI Avatar.Fallback. Typically contains initials or icon.

### Data Attributes

- `data-slot="avatar"` - Root avatar element
- `data-slot="avatar-image"` - Image element
- `data-slot="avatar-fallback"` - Fallback element
- `data-state="visible"` - Applied when image loads successfully
- `data-state="hidden"` - Applied when image fails to load

## Accessibility

Avatar follows accessibility best practices:

### Image Alternative Text

- Always provide meaningful `alt` text for AvatarImage
- For decorative avatars, use empty alt: `alt=""`
- For user avatars, use descriptive text: `alt="John Doe's profile picture"`

### Screen Reader Support

- Fallback content should be meaningful
- Use semantic HTML for surrounding context
- Provide user information outside avatar when necessary

### Focus Management

- Make avatars focusable when interactive
- Use proper button/link semantics for clickable avatars
- Provide clear focus indicators

### Best Practices

::: tip
Provide meaningful fallback content:
```tsx
{/* Good - Initials from user name */}
<AvatarFallback>JD</AvatarFallback>

{/* Good - Generic icon */}
<AvatarFallback><User /></AvatarFallback>

{/* Bad - No fallback */}
<AvatarFallback></AvatarFallback>
```
:::

::: tip
Always include alt text for images:
```tsx
{/* Good - Descriptive alt text */}
<AvatarImage src="/avatar.jpg" alt="John Doe" />

{/* Bad - Missing alt */}
<AvatarImage src="/avatar.jpg" />
```
:::

## Styling

### CSS Variables

Avatar uses semantic color tokens:

```css
--muted             /* Fallback background */
--background        /* Used in avatar groups for border */
--foreground        /* Fallback text color */
```

### Default Styles

- **Size**: `size-7` (1.75rem / 28px)
- **Shape**: `rounded-full` (circular)
- **Overflow**: `overflow-hidden` (clips image to circle)
- **Aspect Ratio**: `aspect-square` for images

### Customization

```tsx
{/* Custom size */}
<Avatar className="size-16">
  {/* ... */}
</Avatar>

{/* Square avatar */}
<Avatar className="rounded-lg">
  {/* ... */}
</Avatar>

{/* Custom fallback background */}
<AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
  JD
</AvatarFallback>

{/* Custom border */}
<Avatar className="ring-2 ring-primary">
  {/* ... */}
</Avatar>
```

### Dark Mode

- Automatically adapts via CSS variables
- Fallback backgrounds use `bg-muted` for proper contrast
- Custom colors should consider both themes

## Common Patterns

### User List with Avatars

```tsx
function UserList() {
  const users = [
    { id: 1, name: 'John Doe', email: 'john@example.com', avatar: '/avatar1.jpg' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', avatar: null },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', avatar: '/avatar3.jpg' },
  ]

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
  }

  return (
    <div className="space-y-4">
      {users.map((user) => (
        <div key={user.id} className="flex items-center gap-3">
          <Avatar>
            {user.avatar ? (
              <AvatarImage src={user.avatar} alt={user.name} />
            ) : null}
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

### Avatar Upload

```tsx
function AvatarUpload() {
  const [preview, setPreview] = useState<string | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-20">
        {preview ? (
          <AvatarImage src={preview} />
        ) : (
          <AvatarFallback>
            <User className="h-8 w-8" />
          </AvatarFallback>
        )}
      </Avatar>
      <div>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id="avatar-upload"
        />
        <label htmlFor="avatar-upload">
          <Button variant="outline" asChild>
            <span>Upload Avatar</span>
          </Button>
        </label>
        <p className="text-xs text-muted-foreground mt-2">
          JPG, PNG or GIF (MAX. 800x800px)
        </p>
      </div>
    </div>
  )
}
```

### Comment with Avatar

```tsx
function Comment({ author, content, timestamp }: CommentProps) {
  return (
    <div className="flex gap-3">
      <Avatar className="size-10">
        <AvatarImage src={author.avatar} alt={author.name} />
        <AvatarFallback>{author.initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{author.name}</span>
          <span className="text-xs text-muted-foreground">{timestamp}</span>
        </div>
        <p className="text-sm mt-1">{content}</p>
      </div>
    </div>
  )
}
```

## Related Components

- [Badge](/components/badge) - For notification indicators
- [Tooltip](/components/tooltip) - For avatar hover information
- [Dropdown Menu](/components/dropdown-menu) - For avatar action menus
- [Button](/components/button) - For clickable avatars
