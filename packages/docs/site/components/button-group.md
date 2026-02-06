# Button Group

A container component that groups multiple buttons together with shared styling and behavior. Supports both horizontal and vertical orientations for flexible layouts.

## Installation

```bash
bunx shadcn@latest add button-group
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { ButtonGroup, Button } from '@venizia/ardor-admin'

export default function Example() {
  return (
    <ButtonGroup>
      <Button variant="outline">Left</Button>
      <Button variant="outline">Middle</Button>
      <Button variant="outline">Right</Button>
    </ButtonGroup>
  )
}
```

## Examples

### Basic Button Group

Horizontal group of buttons:

```tsx
<ButtonGroup>
  <Button variant="outline">First</Button>
  <Button variant="outline">Second</Button>
  <Button variant="outline">Third</Button>
</ButtonGroup>
```

### Vertical Orientation

Stacked button group:

```tsx
<ButtonGroup orientation="vertical">
  <Button variant="outline">Top</Button>
  <Button variant="outline">Middle</Button>
  <Button variant="outline">Bottom</Button>
</ButtonGroup>
```

### With Separators

Add visual separators between buttons:

```tsx
import { ButtonGroup, ButtonGroupSeparator } from '@venizia/ardor-admin'

<ButtonGroup>
  <Button variant="outline">Copy</Button>
  <ButtonGroupSeparator />
  <Button variant="outline">Cut</Button>
  <ButtonGroupSeparator />
  <Button variant="outline">Paste</Button>
</ButtonGroup>
```

### Mixed Button Variants

Different button styles in a group:

```tsx
<ButtonGroup>
  <Button variant="default">Save</Button>
  <Button variant="outline">Cancel</Button>
  <Button variant="ghost">Reset</Button>
</ButtonGroup>
```

### With Icons

Icon-only button groups:

```tsx
import { Bold, Italic, Underline } from 'lucide-react'

<ButtonGroup>
  <Button variant="outline" size="icon">
    <Bold className="h-4 w-4" />
  </Button>
  <Button variant="outline" size="icon">
    <Italic className="h-4 w-4" />
  </Button>
  <Button variant="outline" size="icon">
    <Underline className="h-4 w-4" />
  </Button>
</ButtonGroup>
```

### Toolbar Group

Multiple button groups in a toolbar:

```tsx
<div className="flex gap-2">
  <ButtonGroup>
    <Button variant="outline" size="icon">
      <Undo className="h-4 w-4" />
    </Button>
    <Button variant="outline" size="icon">
      <Redo className="h-4 w-4" />
    </Button>
  </ButtonGroup>

  <ButtonGroup>
    <Button variant="outline" size="icon">
      <AlignLeft className="h-4 w-4" />
    </Button>
    <Button variant="outline" size="icon">
      <AlignCenter className="h-4 w-4" />
    </Button>
    <Button variant="outline" size="icon">
      <AlignRight className="h-4 w-4" />
    </Button>
  </ButtonGroup>

  <ButtonGroup>
    <Button variant="outline" size="icon">
      <Link className="h-4 w-4" />
    </Button>
    <Button variant="outline" size="icon">
      <Image className="h-4 w-4" />
    </Button>
  </ButtonGroup>
</div>
```

### With Input

Combine button with input field:

```tsx
<ButtonGroup>
  <Input placeholder="Search..." className="rounded-r-none" />
  <Button variant="outline">
    <Search className="h-4 w-4" />
  </Button>
</ButtonGroup>
```

### With Select

Combine with select dropdown:

```tsx
<ButtonGroup>
  <Select>
    <SelectTrigger className="w-32">
      <SelectValue placeholder="Action" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="copy">Copy</SelectItem>
      <SelectItem value="move">Move</SelectItem>
      <SelectItem value="delete">Delete</SelectItem>
    </SelectContent>
  </Select>
  <Button variant="outline">Apply</Button>
</ButtonGroup>
```

### Segmented Control

Toggle between options:

```tsx
import { useState } from 'react'

function SegmentedControl() {
  const [value, setValue] = useState('list')

  return (
    <ButtonGroup>
      <Button
        variant={value === 'list' ? 'default' : 'outline'}
        onClick={() => setValue('list')}
      >
        <List className="h-4 w-4 mr-2" />
        List
      </Button>
      <Button
        variant={value === 'grid' ? 'default' : 'outline'}
        onClick={() => setValue('grid')}
      >
        <Grid className="h-4 w-4 mr-2" />
        Grid
      </Button>
      <Button
        variant={value === 'table' ? 'default' : 'outline'}
        onClick={() => setValue('table')}
      >
        <Table className="h-4 w-4 mr-2" />
        Table
      </Button>
    </ButtonGroup>
  )
}
```

### With ButtonGroupText

Add text labels between buttons:

```tsx
import { ButtonGroupText } from '@venizia/ardor-admin'

<ButtonGroup>
  <Button variant="outline">-</Button>
  <ButtonGroupText>0</ButtonGroupText>
  <Button variant="outline">+</Button>
</ButtonGroup>
```

### Pagination Controls

Page navigation buttons:

```tsx
<ButtonGroup>
  <Button variant="outline" disabled>
    <ChevronLeft className="h-4 w-4" />
  </Button>
  <Button variant="outline">1</Button>
  <Button variant="default">2</Button>
  <Button variant="outline">3</Button>
  <Button variant="outline">4</Button>
  <Button variant="outline">5</Button>
  <Button variant="outline">
    <ChevronRight className="h-4 w-4" />
  </Button>
</ButtonGroup>
```

## API Reference

### ButtonGroup

Root container for grouped buttons.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Button group layout direction |
| `className` | `string` | - | Additional CSS classes |

Extends all HTML div attributes with `role="group"`.

### ButtonGroupSeparator

Visual separator between buttons.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `orientation` | `"horizontal" \| "vertical"` | `"vertical"` | Separator orientation |
| `className` | `string` | - | Additional CSS classes |

Extends all Separator component props.

### ButtonGroupText

Text label element within button group.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props into child element |
| `className` | `string` | - | Additional CSS classes |

Extends all HTML div attributes.

### Data Attributes

- `data-slot="button-group"` - Root group element
- `data-slot="button-group-separator"` - Separator element
- `data-orientation` - Current orientation (horizontal/vertical)

## Accessibility

Button Group maintains proper button semantics:

### Group Semantics

- Uses `role="group"` for semantic grouping
- Individual buttons maintain button semantics
- Clear visual grouping

### Keyboard Navigation

- **Tab** - Move focus between buttons
- **Enter/Space** - Activate focused button
- **Arrow Keys** - Navigate between buttons (browser default)

### Screen Reader Support

- Buttons announced individually
- Group context conveyed through ARIA
- Disabled state properly announced

### Best Practices

::: tip
Use consistent button variants:
```tsx
{/* Good - consistent styling */}
<ButtonGroup>
  <Button variant="outline">A</Button>
  <Button variant="outline">B</Button>
  <Button variant="outline">C</Button>
</ButtonGroup>

{/* Mixed - use intentionally */}
<ButtonGroup>
  <Button variant="default">Save</Button>
  <Button variant="outline">Cancel</Button>
</ButtonGroup>
```
:::

::: tip
Provide clear labels for icon-only buttons:
```tsx
<ButtonGroup>
  <Button variant="outline" size="icon" aria-label="Bold">
    <Bold className="h-4 w-4" />
  </Button>
  <Button variant="outline" size="icon" aria-label="Italic">
    <Italic className="h-4 w-4" />
  </Button>
</ButtonGroup>
```
:::

## Styling

### CSS Variables

Button Group uses button component CSS variables:

```css
--border            /* Button borders (shared edges removed) */
--ring              /* Focus ring on individual buttons */
```

### Orientation Styling

**Horizontal** (default):
- Buttons side-by-side
- Shared vertical borders removed
- First button: left corners rounded
- Last button: right corners rounded
- Middle buttons: no rounded corners

**Vertical**:
- Buttons stacked
- Shared horizontal borders removed
- First button: top corners rounded
- Last button: bottom corners rounded
- Middle buttons: no rounded corners

### Focus Management

- Individual buttons maintain focus rings
- Focused button appears above siblings (z-index)
- Focus ring not clipped by adjacent buttons

### Customization

```tsx
{/* Larger spacing */}
<ButtonGroup className="gap-px">
  <Button variant="outline">A</Button>
  <Button variant="outline">B</Button>
</ButtonGroup>

{/* Full width buttons */}
<ButtonGroup className="w-full [&>*]:flex-1">
  <Button variant="outline">Left</Button>
  <Button variant="outline">Right</Button>
</ButtonGroup>

{/* Custom colors */}
<ButtonGroup>
  <Button className="bg-blue-500 hover:bg-blue-600">Blue</Button>
  <Button className="bg-green-500 hover:bg-green-600">Green</Button>
  <Button className="bg-red-500 hover:bg-red-600">Red</Button>
</ButtonGroup>
```

### Dark Mode

- Automatically adapts with button variants
- Border colors adjust for proper contrast
- Focus rings remain visible

## Common Patterns

### Editor Toolbar

```tsx
function EditorToolbar() {
  return (
    <div className="flex flex-wrap gap-2 p-2 border-b">
      <ButtonGroup>
        <Button variant="outline" size="icon">
          <Bold className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon">
          <Italic className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon">
          <Underline className="h-4 w-4" />
        </Button>
      </ButtonGroup>

      <ButtonGroup>
        <Button variant="outline" size="icon">
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon">
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon">
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon">
          <AlignJustify className="h-4 w-4" />
        </Button>
      </ButtonGroup>

      <ButtonGroup>
        <Button variant="outline" size="icon">
          <List className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon">
          <ListOrdered className="h-4 w-4" />
        </Button>
      </ButtonGroup>
    </div>
  )
}
```

### Quantity Selector

```tsx
import { useState } from 'react'

function QuantitySelector() {
  const [quantity, setQuantity] = useState(1)

  return (
    <ButtonGroup>
      <Button
        variant="outline"
        onClick={() => setQuantity(Math.max(1, quantity - 1))}
        disabled={quantity <= 1}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <ButtonGroupText className="min-w-[3rem] justify-center">
        {quantity}
      </ButtonGroupText>
      <Button
        variant="outline"
        onClick={() => setQuantity(quantity + 1)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </ButtonGroup>
  )
}
```

### Date Range Selector

```tsx
function DateRangeSelector() {
  const [range, setRange] = useState('week')

  return (
    <ButtonGroup>
      <Button
        variant={range === 'day' ? 'default' : 'outline'}
        onClick={() => setRange('day')}
      >
        Day
      </Button>
      <Button
        variant={range === 'week' ? 'default' : 'outline'}
        onClick={() => setRange('week')}
      >
        Week
      </Button>
      <Button
        variant={range === 'month' ? 'default' : 'outline'}
        onClick={() => setRange('month')}
      >
        Month
      </Button>
      <Button
        variant={range === 'year' ? 'default' : 'outline'}
        onClick={() => setRange('year')}
      >
        Year
      </Button>
    </ButtonGroup>
  )
}
```

### Split Button

```tsx
<ButtonGroup>
  <Button>Save</Button>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="icon" className="rounded-l-none">
        <ChevronDown className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem>Save and close</DropdownMenuItem>
      <DropdownMenuItem>Save and new</DropdownMenuItem>
      <DropdownMenuItem>Save as template</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</ButtonGroup>
```

## Related Components

- [Button](/components/button) - Individual button component
- [Separator](/components/separator) - For visual separation
- [Tabs](/components/tabs) - Alternative navigation pattern
- [Radio Group](/components/radio-group) - For single-selection groups
