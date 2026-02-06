# Dropdown Menu

A menu that displays a list of actions or options when triggered. Built on Radix UI Dropdown Menu primitive with support for submenus, checkboxes, radio groups, and keyboard shortcuts.

## Installation

```bash
bunx shadcn@latest add dropdown-menu
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@venizia/ardor-admin'

export default function Example() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuItem>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

## Examples

### Basic Dropdown

Simple dropdown menu:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Actions</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Edit</DropdownMenuItem>
    <DropdownMenuItem>Duplicate</DropdownMenuItem>
    <DropdownMenuItem>Archive</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### With Icons

Menu items with leading icons:

```tsx
import { User, Settings, LogOut } from 'lucide-react'

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>Menu</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>
      <User className="mr-2 h-4 w-4" />
      Profile
    </DropdownMenuItem>
    <DropdownMenuItem>
      <Settings className="mr-2 h-4 w-4" />
      Settings
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem>
      <LogOut className="mr-2 h-4 w-4" />
      Logout
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### With Keyboard Shortcuts

Display keyboard shortcuts:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Edit</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>
      Undo
      <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
    </DropdownMenuItem>
    <DropdownMenuItem>
      Redo
      <DropdownMenuShortcut>⇧⌘Z</DropdownMenuShortcut>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem>
      Cut
      <DropdownMenuShortcut>⌘X</DropdownMenuShortcut>
    </DropdownMenuItem>
    <DropdownMenuItem>
      Copy
      <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
    </DropdownMenuItem>
    <DropdownMenuItem>
      Paste
      <DropdownMenuShortcut>⌘V</DropdownMenuShortcut>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### With Labels and Groups

Organized menu with labels:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>Account</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    <DropdownMenuLabel>My Account</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuGroup>
      <DropdownMenuItem>Profile</DropdownMenuItem>
      <DropdownMenuItem>Billing</DropdownMenuItem>
      <DropdownMenuItem>Settings</DropdownMenuItem>
    </DropdownMenuGroup>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Team</DropdownMenuItem>
    <DropdownMenuItem>Invite users</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Support</DropdownMenuItem>
    <DropdownMenuItem>API</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### With Checkbox Items

Menu with checkbox selection:

```tsx
import { useState } from 'react'

function CheckboxMenu() {
  const [showStatusBar, setShowStatusBar] = useState(true)
  const [showActivityBar, setShowActivityBar] = useState(false)
  const [showPanel, setShowPanel] = useState(false)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">View</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={showStatusBar}
          onCheckedChange={setShowStatusBar}
        >
          Status Bar
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={showActivityBar}
          onCheckedChange={setShowActivityBar}
        >
          Activity Bar
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={showPanel}
          onCheckedChange={setShowPanel}
        >
          Panel
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### With Radio Group

Single selection menu:

```tsx
import { useState } from 'react'

function RadioMenu() {
  const [position, setPosition] = useState('bottom')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Panel Position</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Position</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={position} onValueChange={setPosition}>
          <DropdownMenuRadioItem value="top">Top</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="bottom">Bottom</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="right">Right</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### With Submenu

Nested menu structure:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>File</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>New File</DropdownMenuItem>
    <DropdownMenuItem>New Window</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Open Recent</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem>project-1.tsx</DropdownMenuItem>
        <DropdownMenuItem>project-2.tsx</DropdownMenuItem>
        <DropdownMenuItem>project-3.tsx</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>More...</DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Save</DropdownMenuItem>
    <DropdownMenuItem>Save As...</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Destructive Action

Menu item with destructive variant:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Options</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Edit</DropdownMenuItem>
    <DropdownMenuItem>Duplicate</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive">
      <Trash className="mr-2 h-4 w-4" />
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Disabled Items

Menu with disabled options:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Actions</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Enabled Action</DropdownMenuItem>
    <DropdownMenuItem disabled>
      Disabled Action
    </DropdownMenuItem>
    <DropdownMenuItem>Another Action</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## API Reference

### DropdownMenu

Root dropdown menu component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | - | Controlled open state |
| `defaultOpen` | `boolean` | - | Default open state |
| `onOpenChange` | `(open: boolean) => void` | - | Callback when open changes |
| `modal` | `boolean` | `true` | Whether menu is modal |

### DropdownMenuTrigger

Button that opens the dropdown.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props into child |

### DropdownMenuContent

Container for menu items.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `align` | `"start" \| "center" \| "end"` | `"center"` | Alignment relative to trigger |
| `sideOffset` | `number` | `4` | Distance from trigger in pixels |
| `className` | `string` | - | Additional CSS classes |

### DropdownMenuItem

Individual menu item.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"default" \| "destructive"` | `"default"` | Visual variant |
| `inset` | `boolean` | `false` | Add left padding (for alignment) |
| `disabled` | `boolean` | `false` | Disable interaction |
| `onSelect` | `(event: Event) => void` | - | Callback when selected |

### DropdownMenuCheckboxItem

Checkbox menu item.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | `boolean \| "indeterminate"` | - | Checked state |
| `onCheckedChange` | `(checked: boolean) => void` | - | Callback when checked changes |

### DropdownMenuRadioGroup

Container for radio items.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Selected value |
| `onValueChange` | `(value: string) => void` | - | Callback when value changes |

### DropdownMenuRadioItem

Radio menu item.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Item value (required) |

### DropdownMenuLabel

Label for menu section.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `inset` | `boolean` | `false` | Add left padding |

### DropdownMenuSeparator

Visual separator between items.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### DropdownMenuShortcut

Keyboard shortcut display.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### DropdownMenuSub

Nested submenu container.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | - | Controlled open state |
| `defaultOpen` | `boolean` | - | Default open state |
| `onOpenChange` | `(open: boolean) => void` | - | Callback when open changes |

### DropdownMenuSubTrigger

Trigger for opening submenu.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `inset` | `boolean` | `false` | Add left padding |

### DropdownMenuSubContent

Content container for submenu.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### Data Attributes

- `data-slot="dropdown-menu"` - Root element
- `data-slot="dropdown-menu-trigger"` - Trigger button
- `data-slot="dropdown-menu-content"` - Content container
- `data-slot="dropdown-menu-item"` - Menu item
- `data-slot="dropdown-menu-checkbox-item"` - Checkbox item
- `data-slot="dropdown-menu-radio-item"` - Radio item
- `data-slot="dropdown-menu-label"` - Label element
- `data-slot="dropdown-menu-separator"` - Separator
- `data-slot="dropdown-menu-shortcut"` - Shortcut display
- `data-state="open|closed"` - Current state
- `data-variant` - Item variant
- `data-disabled` - Present when disabled

## Accessibility

Dropdown Menu follows WAI-ARIA menu pattern:

### Keyboard Interactions

- **Space/Enter** - Open menu, activate item
- **Arrow Down** - Move to next item
- **Arrow Up** - Move to previous item
- **Arrow Right** - Open submenu
- **Arrow Left** - Close submenu
- **Escape** - Close menu
- **Tab** - Close menu and move to next focusable element
- **Home** - Focus first item
- **End** - Focus last item
- **Type character** - Focus item starting with that character

### Screen Reader Support

- Proper ARIA roles and attributes
- Menu items announced with state
- Keyboard shortcuts announced
- Disabled items properly indicated

### Focus Management

- Focus trapped within open menu
- Returns focus to trigger on close
- Submenu focus management

### Best Practices

::: tip
Use asChild for custom trigger buttons:
```tsx
<DropdownMenuTrigger asChild>
  <Button variant="outline">Open</Button>
</DropdownMenuTrigger>
```
:::

::: tip
Provide clear labels for actions:
```tsx
{/* Good - descriptive */}
<DropdownMenuItem>Edit Profile</DropdownMenuItem>

{/* Bad - vague */}
<DropdownMenuItem>Edit</DropdownMenuItem>
```
:::

## Styling

### CSS Variables

```css
--popover            /* Menu background */
--popover-foreground /* Menu text color */
--accent             /* Hover/focus background */
--accent-foreground  /* Hover/focus text */
--destructive        /* Destructive variant */
--muted-foreground   /* Icons and shortcuts */
--border             /* Separator color */
```

### Animations

Built-in entrance/exit animations:
- Fade in/out
- Zoom in/out (95%)
- Slide from trigger side

### Customization

```tsx
{/* Custom width */}
<DropdownMenuContent className="w-72">
  {/* Items */}
</DropdownMenuContent>

{/* Custom alignment */}
<DropdownMenuContent align="start">
  {/* Items */}
</DropdownMenuContent>

{/* Custom offset */}
<DropdownMenuContent sideOffset={8}>
  {/* Items */}
</DropdownMenuContent>
```

### Dark Mode

- Automatically adapts via CSS variables
- Proper contrast in both themes
- Focus states remain visible

## Common Patterns

### User Account Menu

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
      <Avatar className="h-8 w-8">
        <AvatarImage src="/avatar.jpg" alt="User" />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56" align="end">
    <DropdownMenuLabel className="font-normal">
      <div className="flex flex-col space-y-1">
        <p className="text-sm font-medium">John Doe</p>
        <p className="text-xs text-muted-foreground">
          john@example.com
        </p>
      </div>
    </DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuGroup>
      <DropdownMenuItem>
        <User className="mr-2 h-4 w-4" />
        Profile
      </DropdownMenuItem>
      <DropdownMenuItem>
        <CreditCard className="mr-2 h-4 w-4" />
        Billing
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Settings className="mr-2 h-4 w-4" />
        Settings
      </DropdownMenuItem>
    </DropdownMenuGroup>
    <DropdownMenuSeparator />
    <DropdownMenuItem>
      <LogOut className="mr-2 h-4 w-4" />
      Log out
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Table Row Actions

```tsx
function DataTableRow({ row }: { row: any }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(row.id)}>
          Copy ID
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>View details</DropdownMenuItem>
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### Settings Menu

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">
      <Settings className="mr-2 h-4 w-4" />
      Preferences
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    <DropdownMenuLabel>Display</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuCheckboxItem checked={theme === 'dark'}>
      Dark Mode
    </DropdownMenuCheckboxItem>
    <DropdownMenuCheckboxItem checked={compactView}>
      Compact View
    </DropdownMenuCheckboxItem>
    <DropdownMenuSeparator />
    <DropdownMenuLabel>Language</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
      <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="es">Español</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="fr">Français</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  </DropdownMenuContent>
</DropdownMenu>
```

## Related Components

- [Context Menu](/components/context-menu) - Right-click triggered menu
- [Command](/components/command) - Command palette with search
- [Popover](/components/popover) - For richer interactive content
- [Select](/components/select) - For form selection inputs

