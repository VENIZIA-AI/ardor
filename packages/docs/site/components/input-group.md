# Input Group

A flexible component for grouping input fields with addons, buttons, and text. Supports multiple alignment options and integrates seamlessly with other form components.

## Installation

```bash
bunx shadcn@latest add input-group
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@venizia/ardor-admin'

export default function Example() {
  return (
    <InputGroup>
      <InputGroupAddon>https://</InputGroupAddon>
      <InputGroupInput placeholder="example.com" />
    </InputGroup>
  )
}
```

## Examples

### Basic Input Group

Input with leading addon:

```tsx
<InputGroup>
  <InputGroupAddon>@</InputGroupAddon>
  <InputGroupInput placeholder="username" />
</InputGroup>
```

### With Trailing Addon

Addon at the end of input:

```tsx
<InputGroup>
  <InputGroupInput placeholder="Enter amount" type="number" />
  <InputGroupAddon align="inline-end">USD</InputGroupAddon>
</InputGroup>
```

### With Both Addons

Addons on both sides:

```tsx
<InputGroup>
  <InputGroupAddon>$</InputGroupAddon>
  <InputGroupInput placeholder="0.00" type="number" />
  <InputGroupAddon align="inline-end">.00</InputGroupAddon>
</InputGroup>
```

### With Icon

Input with icon addon:

```tsx
import { Search, Mail, Phone } from 'lucide-react'

<div className="space-y-4">
  <InputGroup>
    <InputGroupAddon>
      <Search className="h-4 w-4" />
    </InputGroupAddon>
    <InputGroupInput placeholder="Search..." />
  </InputGroup>

  <InputGroup>
    <InputGroupAddon>
      <Mail className="h-4 w-4" />
    </InputGroupAddon>
    <InputGroupInput type="email" placeholder="Email" />
  </InputGroup>

  <InputGroup>
    <InputGroupAddon>
      <Phone className="h-4 w-4" />
    </InputGroupAddon>
    <InputGroupInput type="tel" placeholder="Phone" />
  </InputGroup>
</div>
```

### With Button

Input with action button:

```tsx
import { Send, Copy } from 'lucide-react'

<div className="space-y-4">
  <InputGroup>
    <InputGroupInput placeholder="Enter message" />
    <InputGroupAddon align="inline-end">
      <InputGroupButton size="icon-sm">
        <Send className="h-4 w-4" />
      </InputGroupButton>
    </InputGroupAddon>
  </InputGroup>

  <InputGroup>
    <InputGroupInput value="https://example.com/share" readOnly />
    <InputGroupAddon align="inline-end">
      <InputGroupButton size="icon-sm">
        <Copy className="h-4 w-4" />
      </InputGroupButton>
    </InputGroupAddon>
  </InputGroup>
</div>
```

### Search Input

Search field with button:

```tsx
import { Search } from 'lucide-react'

<InputGroup>
  <InputGroupInput placeholder="Search..." />
  <InputGroupAddon align="inline-end">
    <InputGroupButton>
      <Search className="h-4 w-4" />
      Search
    </InputGroupButton>
  </InputGroupAddon>
</InputGroup>
```

### Price Input

Currency input with formatting:

```tsx
<InputGroup>
  <InputGroupAddon>$</InputGroupAddon>
  <InputGroupInput
    type="number"
    placeholder="0.00"
    step="0.01"
    min="0"
  />
  <InputGroupAddon align="inline-end">USD</InputGroupAddon>
</InputGroup>
```

### URL Input

URL input with protocol prefix:

```tsx
<InputGroup>
  <InputGroupAddon>https://</InputGroupAddon>
  <InputGroupInput placeholder="www.example.com" />
  <InputGroupAddon align="inline-end">.com</InputGroupAddon>
</InputGroup>
```

### Block Addons

Addons displayed above/below input:

```tsx
<div className="space-y-4">
  <InputGroup>
    <InputGroupAddon align="block-start">
      <span>Email Address</span>
    </InputGroupAddon>
    <InputGroupInput type="email" placeholder="you@example.com" />
  </InputGroup>

  <InputGroup>
    <InputGroupInput type="password" placeholder="Enter password" />
    <InputGroupAddon align="block-end">
      <span className="text-xs">Must be at least 8 characters</span>
    </InputGroupAddon>
  </InputGroup>
</div>
```

### With Textarea

Input group with textarea:

```tsx
import { InputGroupTextarea } from '@venizia/ardor-admin'

<InputGroup>
  <InputGroupAddon align="block-start">
    <span>Description</span>
  </InputGroupAddon>
  <InputGroupTextarea placeholder="Enter description..." rows={4} />
  <InputGroupAddon align="block-end">
    <span className="text-xs text-muted-foreground">0/500 characters</span>
  </InputGroupAddon>
</InputGroup>
```

### With Dropdown

Input with dropdown button:

```tsx
import { ChevronDown } from 'lucide-react'

<InputGroup>
  <InputGroupAddon>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <InputGroupButton size="sm">
          USD
          <ChevronDown className="h-3 w-3" />
        </InputGroupButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>USD</DropdownMenuItem>
        <DropdownMenuItem>EUR</DropdownMenuItem>
        <DropdownMenuItem>GBP</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </InputGroupAddon>
  <InputGroupInput type="number" placeholder="0.00" />
</InputGroup>
```

### With Text Label

Custom text inside addon:

```tsx
<InputGroup>
  <InputGroupAddon>
    <InputGroupText>@</InputGroupText>
  </InputGroupAddon>
  <InputGroupInput placeholder="Username" />
  <InputGroupAddon align="inline-end">
    <InputGroupText>.com</InputGroupText>
  </InputGroupAddon>
</InputGroup>
```

## API Reference

### InputGroup

Root container for input group.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML div attributes with `role="group"`.

### InputGroupInput

Input field within group.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML input attributes.

### InputGroupTextarea

Textarea field within group.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML textarea attributes.

### InputGroupAddon

Container for addons (text, icons, buttons).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `align` | `"inline-start" \| "inline-end" \| "block-start" \| "block-end"` | `"inline-start"` | Addon position |
| `className` | `string` | - | Additional CSS classes |

**Alignment Options:**
- `inline-start` - Left side (default)
- `inline-end` - Right side
- `block-start` - Top (above input)
- `block-end` - Bottom (below input)

### InputGroupButton

Button within addon.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `"xs" \| "sm" \| "icon-xs" \| "icon-sm"` | `"xs"` | Button size |
| `variant` | `ButtonVariant` | `"ghost"` | Button variant |
| `className` | `string` | - | Additional CSS classes |

Extends all Button component props except standard size prop.

### InputGroupText

Text content within addon.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML span attributes.

### Data Attributes

- `data-slot="input-group"` - Root element
- `data-slot="input-group-addon"` - Addon container
- `data-slot="input-group-control"` - Input/textarea element
- `data-align` - Addon alignment
- `data-disabled` - Present when disabled

## Accessibility

Input Group maintains form accessibility:

### Focus Management

- Focus border applies to entire group
- Clear focus indicators
- Keyboard navigation works naturally

### Screen Reader Support

- `role="group"` for semantic grouping
- Addons properly associated with input
- Error states announced

### Best Practices

::: tip
Provide labels for input groups:
```tsx
<div>
  <Label htmlFor="username">Username</Label>
  <InputGroup>
    <InputGroupAddon>@</InputGroupAddon>
    <InputGroupInput id="username" placeholder="username" />
  </InputGroup>
</div>
```
:::

::: tip
Use appropriate input types:
```tsx
{/* Good - semantic types */}
<InputGroupInput type="email" />
<InputGroupInput type="tel" />
<InputGroupInput type="number" />

{/* Bad - generic text for everything */}
<InputGroupInput type="text" />
```
:::

## Styling

### CSS Variables

Input Group uses semantic color tokens:

```css
--input              /* Border color */
--ring               /* Focus ring */
--destructive        /* Error state */
--muted-foreground   /* Addon text */
```

### States

**Focus State:**
- Border color changes to ring color
- 3px focus ring appears
- Applies to entire group, not individual elements

**Error State:**
- Red border and ring
- Applied via `aria-invalid` on input

**Disabled State:**
- Reduced opacity
- Pointer events disabled

### Customization

```tsx
{/* Custom border */}
<InputGroup className="border-2 border-primary">
  {/* ... */}
</InputGroup>

{/* Custom addon styling */}
<InputGroupAddon className="bg-primary text-primary-foreground">
  $
</InputGroupAddon>

{/* Custom input styling */}
<InputGroupInput className="font-mono" />
```

### Dark Mode

- Automatically adapts via CSS variables
- Proper contrast in both themes
- Focus states remain visible

## Common Patterns

### Form Field with Validation

```tsx
function ValidatedField() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const validate = (value: string) => {
    if (!value.includes('@')) {
      setError('Please enter a valid email')
    } else {
      setError('')
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="email">Email</Label>
      <InputGroup>
        <InputGroupAddon>
          <Mail className="h-4 w-4" />
        </InputGroupAddon>
        <InputGroupInput
          id="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            validate(e.target.value)
          }}
          aria-invalid={!!error}
          placeholder="you@example.com"
        />
      </InputGroup>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
```

### Search with Suggestions

```tsx
function SearchWithSuggestions() {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async () => {
    setIsSearching(true)
    // Perform search
    setTimeout(() => setIsSearching(false), 1000)
  }

  return (
    <InputGroup>
      <InputGroupAddon>
        <Search className="h-4 w-4" />
      </InputGroupAddon>
      <InputGroupInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          onClick={handleSearch}
          disabled={isSearching}
        >
          {isSearching ? (
            <Spinner className="h-3 w-3" />
          ) : (
            'Search'
          )}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
```

### Amount Input with Currency Converter

```tsx
function CurrencyInput() {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')

  return (
    <InputGroup>
      <InputGroupAddon>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className="border-0 shadow-none h-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USD">USD $</SelectItem>
            <SelectItem value="EUR">EUR €</SelectItem>
            <SelectItem value="GBP">GBP £</SelectItem>
          </SelectContent>
        </Select>
      </InputGroupAddon>
      <InputGroupInput
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0.00"
        step="0.01"
      />
    </InputGroup>
  )
}
```

### Tags Input

```tsx
function TagsInput() {
  const [tags, setTags] = useState<string[]>([])
  const [input, setInput] = useState('')

  const addTag = () => {
    if (input.trim()) {
      setTags([...tags, input.trim()])
      setInput('')
    }
  }

  return (
    <div className="space-y-2">
      <InputGroup>
        <InputGroupAddon align="block-start">
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, i) => (
              <Badge key={i} variant="secondary">
                {tag}
                <button
                  onClick={() => setTags(tags.filter((_, idx) => idx !== i))}
                  className="ml-1"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        </InputGroupAddon>
        <InputGroupInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
          placeholder="Add tags..."
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton onClick={addTag}>Add</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
```

## Related Components

- [Input](/components/input) - Standard input field
- [Textarea](/components/textarea) - Multi-line text input
- [Button](/components/button) - Used within addons
- [Field](/components/field) - Complete form field wrapper
