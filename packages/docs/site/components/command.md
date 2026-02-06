# Command

A fast, composable command menu for React. Built with cmdk library, providing keyboard-first navigation with fuzzy search.

## Installation

```bash
bunx shadcn@latest add command
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@venizia/ardor-admin'

export default function Example() {
  return (
    <Command>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem>Calendar</CommandItem>
          <CommandItem>Search Emoji</CommandItem>
          <CommandItem>Calculator</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
```

## Examples

### Basic Command

Simple command menu:

```tsx
<Command className="rounded-lg border shadow-md">
  <CommandInput placeholder="Search..." />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Commands">
      <CommandItem>Home</CommandItem>
      <CommandItem>Search</CommandItem>
      <CommandItem>Settings</CommandItem>
    </CommandGroup>
  </CommandList>
</Command>
```

### Command Dialog (Modal)

Command palette as modal dialog:

```tsx
import { useState, useEffect } from 'react'
import { CommandDialog } from '@venizia/ardor-admin'

function CommandMenu() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Press{' '}
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </p>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem>Calendar</CommandItem>
            <CommandItem>Search Emoji</CommandItem>
            <CommandItem>Calculator</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
```

### With Icons

Command items with icons:

```tsx
import { Calendar, Smile, Calculator, User, CreditCard, Settings } from 'lucide-react'

<Command>
  <CommandInput placeholder="Type a command..." />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Suggestions">
      <CommandItem>
        <Calendar className="mr-2 h-4 w-4" />
        <span>Calendar</span>
      </CommandItem>
      <CommandItem>
        <Smile className="mr-2 h-4 w-4" />
        <span>Search Emoji</span>
      </CommandItem>
      <CommandItem>
        <Calculator className="mr-2 h-4 w-4" />
        <span>Calculator</span>
      </CommandItem>
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading="Settings">
      <CommandItem>
        <User className="mr-2 h-4 w-4" />
        <span>Profile</span>
      </CommandItem>
      <CommandItem>
        <CreditCard className="mr-2 h-4 w-4" />
        <span>Billing</span>
      </CommandItem>
      <CommandItem>
        <Settings className="mr-2 h-4 w-4" />
        <span>Settings</span>
      </CommandItem>
    </CommandGroup>
  </CommandList>
</Command>
```

### With Keyboard Shortcuts

Display keyboard shortcuts:

```tsx
<Command>
  <CommandInput placeholder="Search..." />
  <CommandList>
    <CommandGroup heading="Actions">
      <CommandItem>
        <span>New File</span>
        <CommandShortcut>⌘N</CommandShortcut>
      </CommandItem>
      <CommandItem>
        <span>Open File</span>
        <CommandShortcut>⌘O</CommandShortcut>
      </CommandItem>
      <CommandItem>
        <span>Save</span>
        <CommandShortcut>⌘S</CommandShortcut>
      </CommandItem>
    </CommandGroup>
  </CommandList>
</Command>
```

### Grouped Commands

Multiple command groups:

```tsx
<Command>
  <CommandInput placeholder="Search commands..." />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Pages">
      <CommandItem>Dashboard</CommandItem>
      <CommandItem>Projects</CommandItem>
      <CommandItem>Team</CommandItem>
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading="Actions">
      <CommandItem>New Project</CommandItem>
      <CommandItem>Invite Team Member</CommandItem>
      <CommandItem>Export Data</CommandItem>
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading="Settings">
      <CommandItem>Profile</CommandItem>
      <CommandItem>Preferences</CommandItem>
      <CommandItem>Security</CommandItem>
    </CommandGroup>
  </CommandList>
</Command>
```

### With onSelect Handler

Handle command selection:

```tsx
function CommandWithActions() {
  const handleSelect = (value: string) => {
    console.log('Selected:', value)
    // Navigate or perform action
  }

  return (
    <Command>
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => handleSelect('dashboard')}>
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => handleSelect('settings')}>
            Settings
          </CommandItem>
          <CommandItem onSelect={() => handleSelect('logout')}>
            Logout
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
```

### Search/Filter Pattern

Command as searchable list:

```tsx
import { useState } from 'react'

function SearchableList() {
  const items = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry']
  const [selectedItem, setSelectedItem] = useState('')

  return (
    <Command>
      <CommandInput placeholder="Search fruits..." />
      <CommandList>
        <CommandEmpty>No fruits found.</CommandEmpty>
        <CommandGroup>
          {items.map((item) => (
            <CommandItem
              key={item}
              onSelect={() => setSelectedItem(item)}
            >
              {item}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      {selectedItem && (
        <div className="p-2 border-t">
          Selected: {selectedItem}
        </div>
      )}
    </Command>
  )
}
```

### Navigation Command Menu

Navigate between pages:

```tsx
import { useRouter } from 'next/navigation'

function NavigationMenu() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Go to..." />
      <CommandList>
        <CommandGroup heading="Pages">
          <CommandItem
            onSelect={() => {
              router.push('/')
              setOpen(false)
            }}
          >
            <Home className="mr-2 h-4 w-4" />
            Home
          </CommandItem>
          <CommandItem
            onSelect={() => {
              router.push('/dashboard')
              setOpen(false)
            }}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          <CommandItem
            onSelect={() => {
              router.push('/settings')
              setOpen(false)
            }}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

### Empty State

Custom empty state message:

```tsx
<Command>
  <CommandInput placeholder="Search..." />
  <CommandList>
    <CommandEmpty>
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground">
          No results found.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Try different keywords
        </p>
      </div>
    </CommandEmpty>
    <CommandGroup>
      <CommandItem>Item 1</CommandItem>
      <CommandItem>Item 2</CommandItem>
    </CommandGroup>
  </CommandList>
</Command>
```

## API Reference

### Command

Root command component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Controlled selected value |
| `onValueChange` | `(value: string) => void` | - | Callback when value changes |
| `filter` | `(value: string, search: string) => number` | - | Custom filter function |
| `shouldFilter` | `boolean` | `true` | Enable/disable filtering |
| `className` | `string` | - | Additional CSS classes |

### CommandDialog

Modal command palette.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | - | Controlled open state |
| `onOpenChange` | `(open: boolean) => void` | - | Callback when open changes |
| `title` | `string` | `"Command Palette"` | Dialog title (screen reader only) |
| `description` | `string` | - | Dialog description |
| `showCloseButton` | `boolean` | `true` | Show close button |

### CommandInput

Search input field.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Controlled input value |
| `onValueChange` | `(value: string) => void` | - | Callback when value changes |
| `placeholder` | `string` | - | Input placeholder text |

### CommandList

Container for command items (scrollable).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### CommandEmpty

Displayed when no results found.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | - | Custom empty state content |

### CommandGroup

Group of related commands.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `heading` | `string` | - | Group heading text |
| `className` | `string` | - | Additional CSS classes |

### CommandItem

Individual command item.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Search value (defaults to children text) |
| `onSelect` | `(value: string) => void` | - | Callback when item selected |
| `disabled` | `boolean` | `false` | Disable item |
| `className` | `string` | - | Additional CSS classes |

### CommandSeparator

Visual separator between groups.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### CommandShortcut

Keyboard shortcut display.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### Data Attributes

- `data-slot="command"` - Root element
- `data-slot="command-input-wrapper"` - Input wrapper
- `data-slot="command-input"` - Input field
- `data-slot="command-list"` - List container
- `data-slot="command-empty"` - Empty state
- `data-slot="command-group"` - Group container
- `data-slot="command-item"` - Command item
- `data-slot="command-separator"` - Separator
- `data-slot="command-shortcut"` - Shortcut display
- `data-selected="true"` - Currently selected item
- `data-disabled="true"` - Disabled item

## Accessibility

Command follows accessibility best practices:

### Keyboard Interactions

- **Arrow Down** - Select next item
- **Arrow Up** - Select previous item
- **Home** - Select first item
- **End** - Select last item
- **Enter** - Activate selected item
- **Escape** - Close command dialog
- **Type** - Filter items (fuzzy search)

### Screen Reader Support

- Proper ARIA attributes
- Search results announced
- Selected item announced
- Group headings announced

### Focus Management

- Focus trapped in command dialog
- Clear visual focus indicators
- Keyboard navigation throughout

### Best Practices

::: tip
Use CommandDialog for modal command palettes:
```tsx
<CommandDialog open={open} onOpenChange={setOpen}>
  {/* Command content */}
</CommandDialog>
```
:::

::: tip
Provide meaningful empty state:
```tsx
<CommandEmpty>
  <p>No results found for your search.</p>
</CommandEmpty>
```
:::

## Styling

### CSS Variables

```css
--popover            /* Background color */
--popover-foreground /* Text color */
--accent             /* Selected item background */
--accent-foreground  /* Selected item text */
--muted-foreground   /* Icons and shortcuts */
--border             /* Separators and borders */
```

### Component Structure

- **Command**: Full-width flex column container
- **CommandInput**: Search input with search icon
- **CommandList**: Scrollable list (max-height: 300px)
- **CommandItem**: Clickable item with hover/focus states

### Customization

```tsx
{/* Custom max height */}
<CommandList className="max-h-[400px]">
  {/* Items */}
</CommandList>

{/* Custom width */}
<Command className="w-[600px]">
  {/* Content */}
</Command>

{/* Custom styling */}
<CommandItem className="text-lg font-semibold">
  Custom Item
</CommandItem>
```

### Dark Mode

- Automatically adapts via CSS variables
- Proper contrast in both themes
- Focus states remain visible

## Common Patterns

### Application Command Palette

```tsx
function AppCommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push('/'))}>
            <Home className="mr-2 h-4 w-4" />
            Home
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/dashboard'))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(() => console.log('New'))}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => console.log('Search'))}>
            <Search className="mr-2 h-4 w-4" />
            Search Files
            <CommandShortcut>⌘F</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => runCommand(() => router.push('/settings'))}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

### Combobox Pattern

```tsx
function Combobox() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  const frameworks = [
    { value: 'next', label: 'Next.js' },
    { value: 'react', label: 'React' },
    { value: 'vue', label: 'Vue' },
  ]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox">
          {value ? frameworks.find(f => f.value === value)?.label : 'Select framework...'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search framework..." />
          <CommandList>
            <CommandEmpty>No framework found.</CommandEmpty>
            <CommandGroup>
              {frameworks.map((framework) => (
                <CommandItem
                  key={framework.value}
                  value={framework.value}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? '' : currentValue)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === framework.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {framework.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

## Related Components

- [Dropdown Menu](/components/dropdown-menu) - Click-triggered menu
- [Context Menu](/components/context-menu) - Right-click triggered menu
- [Dialog](/components/dialog) - CommandDialog uses Dialog
- [Popover](/components/popover) - For combobox pattern
