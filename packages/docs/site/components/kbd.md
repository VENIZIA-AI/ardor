# Kbd

A component to display keyboard shortcuts and key combinations with proper styling. Useful for documenting hotkeys and keyboard interactions.

## Installation

```bash
bunx shadcn@latest add kbd
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Kbd } from '@venizia/ardor-admin'

export default function Example() {
  return <Kbd>⌘K</Kbd>
}
```

## Examples

### Basic Kbd

Single key display:

```tsx
<div className="space-x-2">
  <Kbd>Esc</Kbd>
  <Kbd>Enter</Kbd>
  <Kbd>Tab</Kbd>
  <Kbd>Space</Kbd>
</div>
```

### Modifier Keys

Display modifier keys:

```tsx
<div className="flex flex-wrap gap-2">
  <Kbd>⌘</Kbd>
  <Kbd>⌥</Kbd>
  <Kbd>⇧</Kbd>
  <Kbd>⌃</Kbd>
  <Kbd>Ctrl</Kbd>
  <Kbd>Alt</Kbd>
  <Kbd>Shift</Kbd>
</div>
```

### Key Combinations

Use KbdGroup for key combinations:

```tsx
import { Kbd, KbdGroup } from '@venizia/ardor-admin'

<div className="space-y-2">
  <KbdGroup>
    <Kbd>⌘</Kbd>
    <Kbd>K</Kbd>
  </KbdGroup>

  <KbdGroup>
    <Kbd>Ctrl</Kbd>
    <Kbd>Shift</Kbd>
    <Kbd>P</Kbd>
  </KbdGroup>

  <KbdGroup>
    <Kbd>⌘</Kbd>
    <Kbd>⇧</Kbd>
    <Kbd>F</Kbd>
  </KbdGroup>
</div>
```

### With Icons

Icons inside Kbd elements:

```tsx
import { Command, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react'

<div className="flex gap-2">
  <Kbd>
    <Command className="size-3" />
    K
  </Kbd>

  <Kbd>
    <ArrowUp className="size-3" />
  </Kbd>

  <Kbd>
    <ArrowDown className="size-3" />
  </Kbd>

  <Kbd>
    <ArrowLeft className="size-3" />
  </Kbd>

  <Kbd>
    <ArrowRight className="size-3" />
  </Kbd>
</div>
```

### In Documentation

Document keyboard shortcuts:

```tsx
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <span className="text-sm">Open command palette</span>
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  </div>

  <div className="flex items-center justify-between">
    <span className="text-sm">Search files</span>
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>P</Kbd>
    </KbdGroup>
  </div>

  <div className="flex items-center justify-between">
    <span className="text-sm">Toggle sidebar</span>
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>B</Kbd>
    </KbdGroup>
  </div>

  <div className="flex items-center justify-between">
    <span className="text-sm">Save document</span>
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>S</Kbd>
    </KbdGroup>
  </div>
</div>
```

### In Tooltips

Keyboard shortcuts in tooltip content:

```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@venizia/ardor-admin'
import { Search } from 'lucide-react'

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline" size="icon">
        <Search className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <div className="flex items-center gap-2">
        <span>Search</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </div>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Platform-Specific Keys

Show different keys for different platforms:

```tsx
function PlatformKbd({ mac, windows }: { mac: string; windows: string }) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  return <Kbd>{isMac ? mac : windows}</Kbd>
}

// Usage
<KbdGroup>
  <PlatformKbd mac="⌘" windows="Ctrl" />
  <Kbd>K</Kbd>
</KbdGroup>
```

### Arrow Keys

Display arrow navigation:

```tsx
<div className="grid grid-cols-3 gap-1 w-fit">
  <div />
  <Kbd className="justify-center">↑</Kbd>
  <div />

  <Kbd className="justify-center">←</Kbd>
  <Kbd className="justify-center">↓</Kbd>
  <Kbd className="justify-center">→</Kbd>
</div>
```

### Function Keys

Display function keys:

```tsx
<div className="flex flex-wrap gap-2">
  {Array.from({ length: 12 }, (_, i) => (
    <Kbd key={i}>F{i + 1}</Kbd>
  ))}
</div>
```

## API Reference

### Kbd

Single keyboard key display.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML kbd attributes.

### KbdGroup

Container for multiple Kbd elements showing combinations.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Renders as `kbd` element with flex layout for spacing.

### Data Attributes

- `data-slot="kbd"` - Single key element
- `data-slot="kbd-group"` - Key combination group

### Special Styling

Kbd automatically adjusts styling when inside tooltips:
- Uses `bg-background/20` in light tooltips
- Uses `bg-background/10` in dark tooltips
- Adapts text color for better contrast

## Accessibility

Kbd enhances keyboard shortcut communication:

### Semantic HTML

- Uses native `<kbd>` HTML element
- Semantic meaning for keyboard input
- Screen readers announce as keyboard shortcut

### Visual Clarity

- Clear, monospace-friendly styling
- Adequate spacing in groups
- Consistent sizing across keys

### Best Practices

::: tip
Use semantic symbols for modifiers:
```tsx
{/* Good - Platform-specific symbols */}
<KbdGroup>
  <Kbd>⌘</Kbd>
  <Kbd>K</Kbd>
</KbdGroup>

{/* Also good - Text labels */}
<KbdGroup>
  <Kbd>Ctrl</Kbd>
  <Kbd>K</Kbd>
</KbdGroup>

{/* Bad - Inconsistent naming */}
<KbdGroup>
  <Kbd>Command</Kbd>
  <Kbd>k</Kbd>
</KbdGroup>
```
:::

::: tip
Document shortcuts in accessible ways:
```tsx
{/* Good - Clear description */}
<div>
  <p>Press <KbdGroup><Kbd>⌘</Kbd><Kbd>K</Kbd></KbdGroup> to open search</p>
</div>

{/* Also good - Labeled list */}
<dl>
  <dt>Search</dt>
  <dd><KbdGroup><Kbd>⌘</Kbd><Kbd>K</Kbd></KbdGroup></dd>
</dl>
```
:::

## Styling

### CSS Variables

Kbd uses semantic color tokens:

```css
--muted             /* Background color */
--muted-foreground  /* Text color */
--background        /* Tooltip background adjustments */
```

### Default Styles

- **Background**: `bg-muted`
- **Text**: `text-muted-foreground`
- **Height**: `h-5` (1.25rem / 20px)
- **Padding**: `px-1` horizontal
- **Font**: `font-sans` with `text-xs`
- **Border Radius**: `rounded-sm`
- **Min Width**: `min-w-5` (prevents collapse)

### Customization

```tsx
{/* Larger keys */}
<Kbd className="h-6 min-w-6 text-sm">Esc</Kbd>

{/* Custom colors */}
<Kbd className="bg-primary text-primary-foreground">Enter</Kbd>

{/* Full width in grid */}
<Kbd className="w-full justify-center">Space</Kbd>

{/* With shadow */}
<Kbd className="shadow-sm">Tab</Kbd>
```

### Dark Mode

- Automatically adapts via CSS variables
- Special handling in tooltip contexts
- Maintains readability in both themes

## Common Patterns

### Shortcut Documentation Table

```tsx
function ShortcutTable() {
  const shortcuts = [
    { action: 'Open command palette', keys: ['⌘', 'K'] },
    { action: 'Quick file search', keys: ['⌘', 'P'] },
    { action: 'Toggle sidebar', keys: ['⌘', 'B'] },
    { action: 'Save file', keys: ['⌘', 'S'] },
    { action: 'Find in file', keys: ['⌘', 'F'] },
    { action: 'Replace in file', keys: ['⌘', '⌥', 'F'] },
  ]

  return (
    <div className="space-y-2">
      {shortcuts.map((shortcut, i) => (
        <div key={i} className="flex items-center justify-between py-2">
          <span className="text-sm">{shortcut.action}</span>
          <KbdGroup>
            {shortcut.keys.map((key, j) => (
              <Kbd key={j}>{key}</Kbd>
            ))}
          </KbdGroup>
        </div>
      ))}
    </div>
  )
}
```

### Keyboard Shortcut Hint

```tsx
function ActionButton() {
  return (
    <Button variant="outline" className="justify-between w-full">
      <span>Search files...</span>
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    </Button>
  )
}
```

### Help Modal with Shortcuts

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@venizia/ardor-admin'

function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === '?' && e.shiftKey) {
        e.preventDefault()
        setOpen(true)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <h3 className="font-semibold mb-2">Navigation</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Go to Dashboard</span>
                <KbdGroup><Kbd>G</Kbd><Kbd>D</Kbd></KbdGroup>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Go to Settings</span>
                <KbdGroup><Kbd>G</Kbd><Kbd>S</Kbd></KbdGroup>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Actions</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Create New</span>
                <KbdGroup><Kbd>⌘</Kbd><Kbd>N</Kbd></KbdGroup>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Save</span>
                <KbdGroup><Kbd>⌘</Kbd><Kbd>S</Kbd></KbdGroup>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

## Related Components

- [Command](/components/command) - Command palette with keyboard navigation
- [Tooltip](/components/tooltip) - Show shortcuts in tooltips
- [Button](/components/button) - Buttons with keyboard hints
- [Dialog](/components/dialog) - Shortcut help modals
