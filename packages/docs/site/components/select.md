# Select

A dropdown selection component that displays a list of options for the user to choose from. Built on Radix UI Select primitive.

## Installation

```bash
bunx shadcn@latest add select
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@venizia/ardor-admin'

export default function Example() {
  return (
    <Select>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="orange">Orange</SelectItem>
      </SelectContent>
    </Select>
  )
}
```

## Examples

### Basic Select

A simple select with basic options:

```tsx
<Select>
  <SelectTrigger className="w-[200px]">
    <SelectValue placeholder="Choose an option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
    <SelectItem value="option3">Option 3</SelectItem>
  </SelectContent>
</Select>
```

### Grouped Options

Organize options into labeled groups:

```tsx
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@venizia/ardor-admin'

<Select>
  <SelectTrigger className="w-[200px]">
    <SelectValue placeholder="Select a timezone" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>North America</SelectLabel>
      <SelectItem value="est">Eastern Standard Time (EST)</SelectItem>
      <SelectItem value="cst">Central Standard Time (CST)</SelectItem>
      <SelectItem value="pst">Pacific Standard Time (PST)</SelectItem>
    </SelectGroup>
    <SelectGroup>
      <SelectLabel>Europe</SelectLabel>
      <SelectItem value="gmt">Greenwich Mean Time (GMT)</SelectItem>
      <SelectItem value="cet">Central European Time (CET)</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

### With Separators

Use separators to visually divide option groups:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@venizia/ardor-admin'

<Select>
  <SelectTrigger className="w-[200px]">
    <SelectValue placeholder="Select action" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="save">Save</SelectItem>
    <SelectItem value="save-as">Save As</SelectItem>
    <SelectSeparator />
    <SelectItem value="export">Export</SelectItem>
    <SelectItem value="print">Print</SelectItem>
    <SelectSeparator />
    <SelectItem value="close">Close</SelectItem>
  </SelectContent>
</Select>
```

### Controlled Select

Control the select value with state:

```tsx
import { useState } from 'react'

function ControlledSelect() {
  const [value, setValue] = useState('apple')

  return (
    <div className="space-y-4">
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="orange">Orange</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-sm text-muted-foreground">
        Selected: {value}
      </p>
    </div>
  )
}
```

### With Icons

Add icons to select options for better visual context:

```tsx
import { Mail, User, Settings } from 'lucide-react'

<Select>
  <SelectTrigger className="w-[200px]">
    <SelectValue placeholder="Select an item" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="profile">
      <User className="mr-2 h-4 w-4" />
      Profile
    </SelectItem>
    <SelectItem value="mail">
      <Mail className="mr-2 h-4 w-4" />
      Messages
    </SelectItem>
    <SelectItem value="settings">
      <Settings className="mr-2 h-4 w-4" />
      Settings
    </SelectItem>
  </SelectContent>
</Select>
```

### Disabled Options

Disable specific options to prevent selection:

```tsx
<Select>
  <SelectTrigger className="w-[200px]">
    <SelectValue placeholder="Select a plan" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="free">Free</SelectItem>
    <SelectItem value="pro">Pro</SelectItem>
    <SelectItem value="enterprise" disabled>
      Enterprise (Coming Soon)
    </SelectItem>
  </SelectContent>
</Select>
```

### Small Size Variant

Use the `sm` size for compact forms:

```tsx
<Select>
  <SelectTrigger size="sm" className="w-[180px]">
    <SelectValue placeholder="Choose..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">Option 1</SelectItem>
    <SelectItem value="2">Option 2</SelectItem>
    <SelectItem value="3">Option 3</SelectItem>
  </SelectContent>
</Select>
```

### Form Integration

Integrate select with form handling:

```tsx
import { useState } from 'react'
import { Button } from '@venizia/ardor-admin'

function FormExample() {
  const [country, setCountry] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Selected country:', country)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Country</label>
        <Select value={country} onValueChange={setCountry} required>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select a country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="us">United States</SelectItem>
            <SelectItem value="uk">United Kingdom</SelectItem>
            <SelectItem value="ca">Canada</SelectItem>
            <SelectItem value="au">Australia</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit">Submit</Button>
    </form>
  )
}
```

## API Reference

### Select

Root component that manages select state.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Controlled selected value |
| `defaultValue` | `string` | - | Uncontrolled default value |
| `onValueChange` | `(value: string) => void` | - | Callback when value changes |
| `open` | `boolean` | - | Controlled open state |
| `defaultOpen` | `boolean` | - | Uncontrolled default open state |
| `onOpenChange` | `(open: boolean) => void` | - | Callback when open state changes |
| `disabled` | `boolean` | `false` | Whether the select is disabled |
| `required` | `boolean` | `false` | Whether the select is required |
| `name` | `string` | - | Name attribute for form submission |

### SelectTrigger

The button that opens the select dropdown.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `"sm" \| "default"` | `"default"` | Size variant of the trigger |
| `className` | `string` | - | Additional CSS classes |

Extends all HTML button attributes.

### SelectValue

Displays the selected value or placeholder.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `placeholder` | `string` | - | Text to display when no value selected |
| `className` | `string` | - | Additional CSS classes |

### SelectContent

The dropdown panel containing the options.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `"popper" \| "item-aligned"` | `"popper"` | Positioning strategy |
| `align` | `"start" \| "center" \| "end"` | `"center"` | Alignment relative to trigger |
| `side` | `"top" \| "right" \| "bottom" \| "left"` | `"bottom"` | Side of the trigger to position |
| `sideOffset` | `number` | `0` | Offset from the trigger |
| `className` | `string` | - | Additional CSS classes |

### SelectItem

An individual option in the select dropdown.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | The value of the option (required) |
| `disabled` | `boolean` | `false` | Whether the option is disabled |
| `className` | `string` | - | Additional CSS classes |

### SelectGroup

Groups related options together.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### SelectLabel

A label for a group of options.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### SelectSeparator

A visual separator between options.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### Data Attributes

The Select component uses these data attributes for styling:

- `data-slot="select"` - Applied to root element
- `data-slot="select-trigger"` - Applied to trigger button
- `data-slot="select-value"` - Applied to value display
- `data-slot="select-content"` - Applied to dropdown panel
- `data-slot="select-item"` - Applied to each option
- `data-slot="select-group"` - Applied to option groups
- `data-slot="select-label"` - Applied to group labels
- `data-slot="select-separator"` - Applied to separators
- `data-size="sm|default"` - Applied to trigger for size variants
- `data-state="open|closed"` - Applied to content for animation
- `data-disabled` - Applied when disabled
- `data-placeholder` - Applied to trigger when showing placeholder

## Accessibility

The Select component follows WAI-ARIA Select patterns for full accessibility:

### Keyboard Interactions

- **Space/Enter** - Opens the select dropdown
- **Arrow Down** - Moves focus to next option (opens if closed)
- **Arrow Up** - Moves focus to previous option (opens if closed)
- **Home** - Moves focus to first option
- **End** - Moves focus to last option
- **Escape** - Closes the dropdown
- **A-Z** - Jumps to options starting with typed letters
- **Tab** - Closes dropdown and moves focus to next element

### Screen Reader Support

- Select trigger has `role="combobox"` with proper ARIA attributes
- Options have `role="option"` with selection state
- Selected option indicated with `aria-selected="true"`
- Disabled state communicated via `aria-disabled`
- Groups and labels properly associated

### Focus Management

- Focus returns to trigger after selection
- Visual focus indicator on trigger and options
- Focus trapped within content when open

### Best Practices

::: tip
Always provide a meaningful placeholder:
```tsx
<SelectValue placeholder="Select a country" />
```
This helps users understand what they're selecting.
:::

::: tip
Use SelectLabel with SelectGroup for better organization:
```tsx
<SelectGroup>
  <SelectLabel>North America</SelectLabel>
  {/* options */}
</SelectGroup>
```
:::

::: warning
Avoid excessively long option lists. For 20+ options, consider using a searchable combobox instead.
:::

## Styling

### CSS Variables

The Select component uses these CSS variables from your theme:

```css
--input           /* Border color */
--ring            /* Focus ring color */
--muted-foreground /* Placeholder and icon colors */
--destructive     /* Invalid state color */
--popover         /* Dropdown background */
--popover-foreground /* Dropdown text */
--accent          /* Focused item background */
--accent-foreground /* Focused item text */
--primary         /* Selected indicator color */
```

### Customization

Override styles using className:

```tsx
<SelectTrigger className="bg-blue-50 dark:bg-blue-950">
  <SelectValue placeholder="Custom styled" />
</SelectTrigger>

<SelectContent className="max-h-[300px]">
  <SelectItem className="text-lg" value="large">
    Large Text Option
  </SelectItem>
</SelectContent>
```

### Dark Mode Support

The Select component automatically adapts to dark mode using CSS variables:
- Darker input backgrounds with `dark:bg-input/30`
- Adjusted hover states with `dark:hover:bg-input/50`
- Proper contrast for text and borders

### Size Variants

The trigger supports two size variants:

```tsx
<SelectTrigger size="sm" />      {/* height: 32px (h-8) */}
<SelectTrigger size="default" /> {/* height: 36px (h-9) */}
```

## Common Patterns

### Select with Label and Error State

Complete form field with validation:

```tsx
import { useState } from 'react'
import { Label } from '@venizia/ardor-admin'

function SelectWithValidation() {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const handleChange = (newValue: string) => {
    setValue(newValue)
    setError('')
  }

  const handleBlur = () => {
    if (!value) {
      setError('Please select an option')
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="category">Category *</Label>
      <Select
        value={value}
        onValueChange={handleChange}
        onOpenChange={(open) => !open && handleBlur()}
      >
        <SelectTrigger
          id="category"
          className="w-[200px]"
          aria-invalid={!!error}
        >
          <SelectValue placeholder="Select category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="electronics">Electronics</SelectItem>
          <SelectItem value="clothing">Clothing</SelectItem>
          <SelectItem value="food">Food</SelectItem>
        </SelectContent>
      </Select>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
```

### Multi-Level Grouped Select

Complex categorization with multiple groups:

```tsx
<Select>
  <SelectTrigger className="w-[250px]">
    <SelectValue placeholder="Select a product" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Laptops</SelectLabel>
      <SelectItem value="macbook-pro">MacBook Pro</SelectItem>
      <SelectItem value="macbook-air">MacBook Air</SelectItem>
      <SelectItem value="thinkpad">ThinkPad X1</SelectItem>
    </SelectGroup>
    <SelectSeparator />
    <SelectGroup>
      <SelectLabel>Phones</SelectLabel>
      <SelectItem value="iphone-15">iPhone 15 Pro</SelectItem>
      <SelectItem value="pixel-8">Pixel 8 Pro</SelectItem>
      <SelectItem value="galaxy-s24">Galaxy S24 Ultra</SelectItem>
    </SelectGroup>
    <SelectSeparator />
    <SelectGroup>
      <SelectLabel>Tablets</SelectLabel>
      <SelectItem value="ipad-pro">iPad Pro</SelectItem>
      <SelectItem value="surface-pro">Surface Pro</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

### Dynamic Options from API

Load select options from an API:

```tsx
import { useEffect, useState } from 'react'

interface Country {
  code: string
  name: string
}

function DynamicSelect() {
  const [countries, setCountries] = useState<Country[]>([])
  const [loading, setLoading] = useState(true)
  const [value, setValue] = useState('')

  useEffect(() => {
    fetch('/api/countries')
      .then(res => res.json())
      .then(data => {
        setCountries(data)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select country" />
      </SelectTrigger>
      <SelectContent>
        {countries.map(country => (
          <SelectItem key={country.code} value={country.code}>
            {country.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

### Searchable Select Pattern

While Select doesn't have built-in search, you can implement it:

```tsx
import { useState, useMemo } from 'react'
import { Input } from '@venizia/ardor-admin'

function SearchableSelect() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [search, setSearch] = useState('')

  const options = [
    'JavaScript', 'TypeScript', 'Python', 'Java',
    'C++', 'Go', 'Rust', 'Swift', 'Kotlin'
  ]

  const filteredOptions = useMemo(() => {
    return options.filter(option =>
      option.toLowerCase().includes(search.toLowerCase())
    )
  }, [search])

  return (
    <Select
      value={value}
      onValueChange={setValue}
      open={open}
      onOpenChange={setOpen}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select language" />
      </SelectTrigger>
      <SelectContent>
        <div className="p-2">
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        {filteredOptions.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No results found
          </div>
        ) : (
          filteredOptions.map(option => (
            <SelectItem key={option} value={option.toLowerCase()}>
              {option}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}
```

## Related Components

- [Input](/components/input) - For free-form text input
- [Checkbox](/components/checkbox) - For multiple selections
- [Radio Group](/components/radio-group) - For single selection with visible options
- [Command](/components/command) - For searchable command menu with keyboard navigation
- [Label](/components/label) - For accessible form labels
