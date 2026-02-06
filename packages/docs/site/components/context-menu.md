# Context Menu

A menu that appears on right-click or long-press, providing contextual actions for the selected element. Built on Radix UI Context Menu primitive with support for submenus, checkboxes, radio groups, and keyboard shortcuts.

## Installation

```bash
bunx shadcn@latest add context-menu
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@venizia/ardor-admin'

export default function Example() {
  return (
    <ContextMenu>
      <ContextMenuTrigger>Right click here</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>Copy</ContextMenuItem>
        <ContextMenuItem>Cut</ContextMenuItem>
        <ContextMenuItem>Paste</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

## Examples

### Basic Context Menu

Simple right-click menu:

```tsx
<ContextMenu>
  <ContextMenuTrigger className="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
    Right click here
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>Edit</ContextMenuItem>
    <ContextMenuItem>Duplicate</ContextMenuItem>
    <ContextMenuItem>Delete</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

### With Icons

Menu items with icons:

```tsx
import { Copy, Scissors, Clipboard } from 'lucide-react'

<ContextMenu>
  <ContextMenuTrigger>Right click</ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>
      <Copy className="mr-2 h-4 w-4" />
      Copy
    </ContextMenuItem>
    <ContextMenuItem>
      <Scissors className="mr-2 h-4 w-4" />
      Cut
    </ContextMenuItem>
    <ContextMenuItem>
      <Clipboard className="mr-2 h-4 w-4" />
      Paste
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

### With Keyboard Shortcuts

Display keyboard shortcuts:

```tsx
<ContextMenu>
  <ContextMenuTrigger>Right click</ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>
      Copy
      <ContextMenuShortcut>⌘C</ContextMenuShortcut>
    </ContextMenuItem>
    <ContextMenuItem>
      Cut
      <ContextMenuShortcut>⌘X</ContextMenuShortcut>
    </ContextMenuItem>
    <ContextMenuItem>
      Paste
      <ContextMenuShortcut>⌘V</ContextMenuShortcut>
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem>
      Select All
      <ContextMenuShortcut>⌘A</ContextMenuShortcut>
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

### With Labels and Groups

Organized menu sections:

```tsx
<ContextMenu>
  <ContextMenuTrigger>Right click</ContextMenuTrigger>
  <ContextMenuContent className="w-64">
    <ContextMenuLabel>Actions</ContextMenuLabel>
    <ContextMenuSeparator />
    <ContextMenuGroup>
      <ContextMenuItem>Open</ContextMenuItem>
      <ContextMenuItem>Open in New Tab</ContextMenuItem>
    </ContextMenuGroup>
    <ContextMenuSeparator />
    <ContextMenuGroup>
      <ContextMenuItem>Download</ContextMenuItem>
      <ContextMenuItem>Share</ContextMenuItem>
    </ContextMenuGroup>
    <ContextMenuSeparator />
    <ContextMenuItem variant="destructive">Delete</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

### With Checkbox Items

Menu with toggleable options:

```tsx
import { useState } from 'react'

function CheckboxContextMenu() {
  const [showBookmarks, setShowBookmarks] = useState(true)
  const [showUrls, setShowUrls] = useState(false)

  return (
    <ContextMenu>
      <ContextMenuTrigger>Right click</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuCheckboxItem
          checked={showBookmarks}
          onCheckedChange={setShowBookmarks}
        >
          Show Bookmarks
        </ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem
          checked={showUrls}
          onCheckedChange={setShowUrls}
        >
          Show Full URLs
        </ContextMenuCheckboxItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

### With Radio Group

Single selection menu:

```tsx
import { useState } from 'react'

function RadioContextMenu() {
  const [view, setView] = useState('list')

  return (
    <ContextMenu>
      <ContextMenuTrigger>Right click</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>View Mode</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuRadioGroup value={view} onValueChange={setView}>
          <ContextMenuRadioItem value="list">List</ContextMenuRadioItem>
          <ContextMenuRadioItem value="grid">Grid</ContextMenuRadioItem>
          <ContextMenuRadioItem value="gallery">Gallery</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

### With Submenu

Nested menu structure:

```tsx
<ContextMenu>
  <ContextMenuTrigger>Right click</ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>Back</ContextMenuItem>
    <ContextMenuItem>Forward</ContextMenuItem>
    <ContextMenuItem>Reload</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuSub>
      <ContextMenuSubTrigger>More Tools</ContextMenuSubTrigger>
      <ContextMenuSubContent>
        <ContextMenuItem>Save Page As...</ContextMenuItem>
        <ContextMenuItem>Create Shortcut...</ContextMenuItem>
        <ContextMenuItem>Name Window...</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>Developer Tools</ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
    <ContextMenuSeparator />
    <ContextMenuItem>View Page Source</ContextMenuItem>
    <ContextMenuItem>Inspect</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

### On Image Element

Context menu on image:

```tsx
<ContextMenu>
  <ContextMenuTrigger>
    <img
      src="/example.jpg"
      alt="Example"
      className="h-64 w-64 rounded-md object-cover"
    />
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>Open Image in New Tab</ContextMenuItem>
    <ContextMenuItem>Save Image As...</ContextMenuItem>
    <ContextMenuItem>Copy Image</ContextMenuItem>
    <ContextMenuItem>Copy Image Address</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem>Search Image with Google</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

### On Card Component

Context menu on interactive card:

```tsx
<ContextMenu>
  <ContextMenuTrigger>
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Project Name</CardTitle>
        <CardDescription>Project description</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Right click this card for options</p>
      </CardContent>
    </Card>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>Open</ContextMenuItem>
    <ContextMenuItem>Edit</ContextMenuItem>
    <ContextMenuItem>Duplicate</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem>Share</ContextMenuItem>
    <ContextMenuItem>Export</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem variant="destructive">Delete</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

### Disabled Items

Menu with disabled options:

```tsx
<ContextMenu>
  <ContextMenuTrigger>Right click</ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>Cut</ContextMenuItem>
    <ContextMenuItem>Copy</ContextMenuItem>
    <ContextMenuItem disabled>Paste (Nothing to paste)</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem>Select All</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

## API Reference

### ContextMenu

Root context menu component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onOpenChange` | `(open: boolean) => void` | - | Callback when open state changes |
| `modal` | `boolean` | `true` | Whether menu is modal |

### ContextMenuTrigger

Element that triggers the menu on right-click.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props into child |
| `disabled` | `boolean` | `false` | Disable menu trigger |

### ContextMenuContent

Container for menu items.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### ContextMenuItem

Individual menu item.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"default" \| "destructive"` | `"default"` | Visual variant |
| `inset` | `boolean` | `false` | Add left padding |
| `disabled` | `boolean` | `false` | Disable interaction |
| `onSelect` | `(event: Event) => void` | - | Callback when selected |

### ContextMenuCheckboxItem

Checkbox menu item.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | `boolean \| "indeterminate"` | - | Checked state |
| `onCheckedChange` | `(checked: boolean) => void` | - | Callback when checked changes |

### ContextMenuRadioGroup

Container for radio items.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Selected value |
| `onValueChange` | `(value: string) => void` | - | Callback when value changes |

### ContextMenuRadioItem

Radio menu item.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Item value (required) |

### ContextMenuLabel

Label for menu section.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `inset` | `boolean` | `false` | Add left padding |

### ContextMenuSeparator

Visual separator between items.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### ContextMenuShortcut

Keyboard shortcut display.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### ContextMenuSub

Nested submenu container.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onOpenChange` | `(open: boolean) => void` | - | Callback when open changes |

### ContextMenuSubTrigger

Trigger for opening submenu.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `inset` | `boolean` | `false` | Add left padding |

### ContextMenuSubContent

Content container for submenu.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### Data Attributes

- `data-slot="context-menu"` - Root element
- `data-slot="context-menu-trigger"` - Trigger element
- `data-slot="context-menu-content"` - Content container
- `data-slot="context-menu-item"` - Menu item
- `data-slot="context-menu-checkbox-item"` - Checkbox item
- `data-slot="context-menu-radio-item"` - Radio item
- `data-slot="context-menu-label"` - Label element
- `data-slot="context-menu-separator"` - Separator
- `data-slot="context-menu-shortcut"` - Shortcut display
- `data-state="open|closed"` - Current state
- `data-variant` - Item variant
- `data-disabled` - Present when disabled

## Accessibility

Context Menu follows WAI-ARIA menu pattern:

### Keyboard Interactions

- **Right Click** - Open menu
- **Arrow Down** - Move to next item
- **Arrow Up** - Move to previous item
- **Arrow Right** - Open submenu
- **Arrow Left** - Close submenu
- **Escape** - Close menu
- **Enter/Space** - Activate item
- **Home** - Focus first item
- **End** - Focus last item
- **Type character** - Focus item starting with that character

### Touch Support

- **Long Press** - Opens context menu on touch devices
- Native touch feedback

### Screen Reader Support

- Proper ARIA roles and attributes
- Menu items announced with state
- Keyboard shortcuts announced
- Disabled items properly indicated

### Best Practices

::: tip
Provide clear visual feedback for trigger:
```tsx
<ContextMenuTrigger className="rounded-md border border-dashed p-8 text-center hover:bg-accent">
  Right click here
</ContextMenuTrigger>
```
:::

::: warning
Don't override native browser context menus without good reason:
```tsx
{/* Only use for custom UI elements */}
<ContextMenu>
  <ContextMenuTrigger>
    <div className="custom-element">Custom Element</div>
  </ContextMenuTrigger>
  {/* ... */}
</ContextMenu>
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
- Slide from cursor position

### Customization

```tsx
{/* Custom width */}
<ContextMenuContent className="w-72">
  {/* Items */}
</ContextMenuContent>

{/* Custom styling */}
<ContextMenuItem className="font-semibold">
  Important Action
</ContextMenuItem>
```

### Dark Mode

- Automatically adapts via CSS variables
- Proper contrast in both themes
- Focus states remain visible

## Common Patterns

### File Browser Context Menu

```tsx
<ContextMenu>
  <ContextMenuTrigger>
    <div className="flex items-center gap-2 p-2 rounded hover:bg-accent">
      <FileIcon className="h-4 w-4" />
      <span>document.pdf</span>
    </div>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>
      <Eye className="mr-2 h-4 w-4" />
      Open
    </ContextMenuItem>
    <ContextMenuItem>
      <Download className="mr-2 h-4 w-4" />
      Download
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem>
      <Edit className="mr-2 h-4 w-4" />
      Rename
    </ContextMenuItem>
    <ContextMenuItem>
      <Copy className="mr-2 h-4 w-4" />
      Duplicate
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem>
      <Share className="mr-2 h-4 w-4" />
      Share
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem variant="destructive">
      <Trash className="mr-2 h-4 w-4" />
      Delete
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

### Text Selection Menu

```tsx
<ContextMenu>
  <ContextMenuTrigger>
    <p className="select-text p-4 border rounded">
      Select some text and right-click to see available actions.
      This context menu appears when you right-click on selected text.
    </p>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>
      <Copy className="mr-2 h-4 w-4" />
      Copy
      <ContextMenuShortcut>⌘C</ContextMenuShortcut>
    </ContextMenuItem>
    <ContextMenuItem>
      <Scissors className="mr-2 h-4 w-4" />
      Cut
      <ContextMenuShortcut>⌘X</ContextMenuShortcut>
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <Search className="mr-2 h-4 w-4" />
        Search
      </ContextMenuSubTrigger>
      <ContextMenuSubContent>
        <ContextMenuItem>Search with Google</ContextMenuItem>
        <ContextMenuItem>Search in Page</ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
    <ContextMenuItem>
      <Globe className="mr-2 h-4 w-4" />
      Translate
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

### Canvas/Drawing Context Menu

```tsx
<ContextMenu>
  <ContextMenuTrigger>
    <div className="h-[400px] w-full border rounded-md bg-muted">
      Right click on canvas
    </div>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuLabel>Canvas Actions</ContextMenuLabel>
    <ContextMenuSeparator />
    <ContextMenuItem>
      <Plus className="mr-2 h-4 w-4" />
      Add Shape
    </ContextMenuItem>
    <ContextMenuItem>
      <Type className="mr-2 h-4 w-4" />
      Add Text
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuCheckboxItem checked={showGrid}>
      Show Grid
    </ContextMenuCheckboxItem>
    <ContextMenuCheckboxItem checked={snapToGrid}>
      Snap to Grid
    </ContextMenuCheckboxItem>
    <ContextMenuSeparator />
    <ContextMenuItem>
      <Download className="mr-2 h-4 w-4" />
      Export
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

## Related Components

- [Dropdown Menu](/components/dropdown-menu) - Click-triggered menu
- [Command](/components/command) - Command palette with search
- [Popover](/components/popover) - For richer interactive content
