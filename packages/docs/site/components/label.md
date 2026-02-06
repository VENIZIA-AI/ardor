# Label

A text label component that associates with form controls for improved accessibility. Built on Radix UI Label primitive.

## Installation

```bash
bunx shadcn@latest add label
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Label } from '@venizia/ardor-admin'

export default function Example() {
  return (
    <div className="space-y-2">
      <Label htmlFor="email">Email address</Label>
      <input
        id="email"
        type="email"
        className="w-full rounded-md border px-3 py-2"
      />
    </div>
  )
}
```

## Examples

### Basic Label

A simple label associated with an input:

```tsx
import { Label, Input } from '@venizia/ardor-admin'

<div className="space-y-2">
  <Label htmlFor="username">Username</Label>
  <Input id="username" placeholder="Enter username" />
</div>
```

### Required Field Indicator

Show required fields with an asterisk:

```tsx
<div className="space-y-2">
  <Label htmlFor="password">
    Password <span className="text-destructive">*</span>
  </Label>
  <Input id="password" type="password" required />
</div>
```

### With Helper Text

Add descriptive text below the label:

```tsx
<div className="space-y-2">
  <div>
    <Label htmlFor="bio">Bio</Label>
    <p className="text-xs text-muted-foreground mt-1">
      Tell us a little about yourself
    </p>
  </div>
  <textarea
    id="bio"
    className="w-full rounded-md border px-3 py-2"
    rows={3}
  />
</div>
```

### With Checkbox

Associate labels with checkboxes:

```tsx
import { Label, Checkbox } from '@venizia/ardor-admin'

<div className="flex items-center space-x-2">
  <Checkbox id="terms" />
  <Label htmlFor="terms" className="font-normal">
    I agree to the terms and conditions
  </Label>
</div>
```

### With Radio Button

Use labels with radio buttons:

```tsx
import { Label } from '@venizia/ardor-admin'

<div className="space-y-2">
  <div className="flex items-center space-x-2">
    <input type="radio" id="option1" name="choice" />
    <Label htmlFor="option1">Option 1</Label>
  </div>
  <div className="flex items-center space-x-2">
    <input type="radio" id="option2" name="choice" />
    <Label htmlFor="option2">Option 2</Label>
  </div>
</div>
```

### With Switch

Label for switch components:

```tsx
import { Label, Switch } from '@venizia/ardor-admin'

<div className="flex items-center space-x-2">
  <Switch id="notifications" />
  <Label htmlFor="notifications">Enable notifications</Label>
</div>
```

### Disabled State

Labels automatically style when the associated control is disabled:

```tsx
<div className="space-y-4">
  <div className="flex items-center space-x-2">
    <Checkbox id="enabled" />
    <Label htmlFor="enabled">Enabled option</Label>
  </div>
  <div className="flex items-center space-x-2">
    <Checkbox id="disabled" disabled className="peer" />
    <Label htmlFor="disabled">Disabled option</Label>
  </div>
</div>
```

### With Icons

Add icons to labels for visual context:

```tsx
import { Label } from '@venizia/ardor-admin'
import { Mail } from 'lucide-react'

<div className="space-y-2">
  <Label htmlFor="email" className="flex items-center gap-2">
    <Mail className="h-4 w-4" />
    Email Address
  </Label>
  <Input id="email" type="email" />
</div>
```

### Inline Label and Input

Create horizontal form layouts:

```tsx
<div className="flex items-center gap-4">
  <Label htmlFor="quantity" className="min-w-[100px]">
    Quantity
  </Label>
  <Input id="quantity" type="number" className="w-24" defaultValue="1" />
</div>
```

## API Reference

### Label

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `htmlFor` | `string` | - | ID of the form control this label is for |
| `className` | `string` | - | Additional CSS classes |
| `asChild` | `boolean` | `false` | Merge props into child element |

Extends all HTML label attributes.

### Data Attributes

The Label component uses these data attributes for styling:

- `data-slot="label"` - Applied to label element

## Accessibility

The Label component follows WAI-ARIA Label patterns for full accessibility:

### Label Association

- Uses native `<label>` element with `htmlFor` attribute
- Clicking the label focuses/activates the associated control
- Screen readers announce the label when the control is focused
- Proper semantic markup for form accessibility

### Disabled State Styling

- `peer-disabled:opacity-50` - Automatically styles when peer is disabled
- `peer-disabled:cursor-not-allowed` - Changes cursor for disabled peers
- `group-data-[disabled=true]:opacity-50` - Styles when within disabled group

### Best Practices

::: tip
Always use `htmlFor` to associate labels with form controls:
```tsx
<Label htmlFor="email">Email</Label>
<Input id="email" />
```
This makes the entire label clickable and improves accessibility.
:::

::: tip
Use semantic HTML and proper label association instead of just styling text:
```tsx
{/* Good */}
<Label htmlFor="input">Name</Label>

{/* Bad */}
<span className="text-sm font-medium">Name</span>
```
:::

::: warning
When using the `peer` class pattern, ensure the input comes before the label in the DOM:
```tsx
<Checkbox id="item" className="peer" />
<Label htmlFor="item" className="peer-disabled:opacity-50">
  Label text
</Label>
```
:::

## Styling

### CSS Variables

The Label inherits text color from its parent and uses:

```css
/* Text color inherited from parent/theme */
/* Font size: text-sm (0.875rem) */
/* Font weight: font-medium (500) */
```

### Visual Styles

Default label styles:
- **Font size**: `text-sm` (14px)
- **Font weight**: `font-medium` (500)
- **Line height**: `leading-none`
- **Display**: `flex items-center gap-2` (allows icons/badges)
- **User selection**: `select-none` (prevents text selection)

### Customization

Override styles using className:

```tsx
<Label className="text-base font-bold text-blue-600">
  Custom Label
</Label>

<Label className="text-xs font-normal text-muted-foreground">
  Small Label
</Label>
```

### Dark Mode Support

Labels inherit theme colors and automatically work in dark mode through the theme's text color variables.

## Common Patterns

### Form Field with Label and Error

Complete form field with validation:

```tsx
import { useState } from 'react'
import { Label, Input } from '@venizia/ardor-admin'

function FormField() {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const validate = (val: string) => {
    if (!val) {
      setError('This field is required')
    } else if (val.length < 3) {
      setError('Must be at least 3 characters')
    } else {
      setError('')
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="name">
        Name <span className="text-destructive">*</span>
      </Label>
      <Input
        id="name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => validate(value)}
        aria-invalid={!!error}
        aria-describedby={error ? 'name-error' : undefined}
      />
      {error && (
        <p id="name-error" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
```

### Label with Badge

Add status badges to labels:

```tsx
import { Label, Badge } from '@venizia/ardor-admin'

<div className="space-y-2">
  <div className="flex items-center gap-2">
    <Label htmlFor="premium">Premium Features</Label>
    <Badge variant="secondary">Pro</Badge>
  </div>
  <Input id="premium" />
</div>
```

### Multi-Level Labels

Create hierarchical label structures:

```tsx
<div className="space-y-4">
  <Label className="text-base">Personal Information</Label>
  <div className="space-y-4 pl-4">
    <div className="space-y-2">
      <Label htmlFor="firstName">First Name</Label>
      <Input id="firstName" />
    </div>
    <div className="space-y-2">
      <Label htmlFor="lastName">Last Name</Label>
      <Input id="lastName" />
    </div>
  </div>
</div>
```

### Label with Tooltip

Add helpful information with tooltips:

```tsx
import { Label, Input, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@venizia/ardor-admin'
import { HelpCircle } from 'lucide-react'

function LabelWithTooltip() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="apiKey">API Key</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Find your API key in the dashboard settings</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Input id="apiKey" type="password" />
    </div>
  )
}
```

## Related Components

- [Input](/components/input) - Text input fields that work with labels
- [Checkbox](/components/checkbox) - Checkbox inputs with labels
- [Radio Group](/components/radio-group) - Radio button groups with labels
- [Switch](/components/switch) - Toggle switches with labels
- [Select](/components/select) - Dropdown selects that benefit from labels
- [Field](/components/field) - Complete form field wrapper with label support
