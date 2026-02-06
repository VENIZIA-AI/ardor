# Checkbox

A checkbox control that allows users to toggle between checked and unchecked states, with support for an indeterminate state. Built on Radix UI Checkbox primitive.

## Installation

```bash
bunx shadcn@latest add checkbox
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Checkbox } from '@venizia/ardor-admin'

export default function Example() {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox id="terms" />
      <label
        htmlFor="terms"
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        Accept terms and conditions
      </label>
    </div>
  )
}
```

## Examples

### Basic Checkbox

A simple checkbox with label:

```tsx
<div className="flex items-center space-x-2">
  <Checkbox id="marketing" />
  <label htmlFor="marketing" className="text-sm">
    Send me marketing emails
  </label>
</div>
```

### Controlled Checkbox

Control the checkbox state with React state:

```tsx
import { useState } from 'react'
import { Checkbox } from '@venizia/ardor-admin'

function ControlledCheckbox() {
  const [checked, setChecked] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="controlled"
          checked={checked}
          onCheckedChange={setChecked}
        />
        <label htmlFor="controlled" className="text-sm">
          Subscribe to newsletter
        </label>
      </div>
      <p className="text-sm text-muted-foreground">
        Status: {checked ? 'Checked' : 'Unchecked'}
      </p>
    </div>
  )
}
```

### Indeterminate State

Use the indeterminate state for partial selections:

```tsx
import { useState, useEffect } from 'react'
import { Checkbox } from '@venizia/ardor-admin'

function IndeterminateExample() {
  const [items, setItems] = useState([
    { id: '1', label: 'Item 1', checked: false },
    { id: '2', label: 'Item 2', checked: true },
    { id: '3', label: 'Item 3', checked: false },
  ])

  const allChecked = items.every(item => item.checked)
  const someChecked = items.some(item => item.checked) && !allChecked

  const handleSelectAll = (checked: boolean) => {
    setItems(items.map(item => ({ ...item, checked: !!checked })))
  }

  const handleToggleItem = (id: string) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2 border-b pb-2">
        <Checkbox
          checked={allChecked ? true : someChecked ? 'indeterminate' : false}
          onCheckedChange={handleSelectAll}
          id="select-all"
        />
        <label htmlFor="select-all" className="text-sm font-medium">
          Select all items
        </label>
      </div>
      {items.map(item => (
        <div key={item.id} className="flex items-center space-x-2 pl-6">
          <Checkbox
            id={item.id}
            checked={item.checked}
            onCheckedChange={() => handleToggleItem(item.id)}
          />
          <label htmlFor={item.id} className="text-sm">
            {item.label}
          </label>
        </div>
      ))}
    </div>
  )
}
```

### Disabled State

Disable checkboxes to prevent interaction:

```tsx
<div className="space-y-2">
  <div className="flex items-center space-x-2">
    <Checkbox id="disabled-unchecked" disabled />
    <label htmlFor="disabled-unchecked" className="text-sm opacity-50">
      Disabled unchecked
    </label>
  </div>
  <div className="flex items-center space-x-2">
    <Checkbox id="disabled-checked" disabled checked />
    <label htmlFor="disabled-checked" className="text-sm opacity-50">
      Disabled checked
    </label>
  </div>
</div>
```

### With Form Validation

Integrate with forms and show validation errors:

```tsx
import { useState } from 'react'
import { Checkbox } from '@venizia/ardor-admin'
import { Button } from '@venizia/ardor-admin'

function CheckboxWithValidation() {
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!accepted) {
      setError('You must accept the terms and conditions')
      return
    }
    setError('')
    console.log('Form submitted')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-start space-x-2">
          <Checkbox
            id="terms"
            checked={accepted}
            onCheckedChange={(checked) => {
              setAccepted(!!checked)
              setError('')
            }}
            aria-invalid={!!error}
          />
          <label htmlFor="terms" className="text-sm leading-tight">
            I accept the terms and conditions
          </label>
        </div>
        {error && (
          <p className="text-sm text-destructive pl-6">{error}</p>
        )}
      </div>
      <Button type="submit">Submit</Button>
    </form>
  )
}
```

### Multiple Checkboxes in a Form

Handle multiple independent checkboxes:

```tsx
import { useState } from 'react'

function MultipleCheckboxes() {
  const [preferences, setPreferences] = useState({
    email: false,
    sms: false,
    push: false,
  })

  const handleChange = (key: keyof typeof preferences) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Notification Preferences</h3>
        <div className="space-y-2 pl-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="email"
              checked={preferences.email}
              onCheckedChange={() => handleChange('email')}
            />
            <label htmlFor="email" className="text-sm">
              Email notifications
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sms"
              checked={preferences.sms}
              onCheckedChange={() => handleChange('sms')}
            />
            <label htmlFor="sms" className="text-sm">
              SMS notifications
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="push"
              checked={preferences.push}
              onCheckedChange={() => handleChange('push')}
            />
            <label htmlFor="push" className="text-sm">
              Push notifications
            </label>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Active: {Object.entries(preferences)
          .filter(([_, v]) => v)
          .map(([k]) => k)
          .join(', ') || 'None'}
      </p>
    </div>
  )
}
```

### With Description Text

Add descriptive text for better context:

```tsx
<div className="space-y-4">
  <div className="flex items-start space-x-3">
    <Checkbox id="analytics" className="mt-0.5" />
    <div className="grid gap-1.5 leading-none">
      <label
        htmlFor="analytics"
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        Analytics cookies
      </label>
      <p className="text-sm text-muted-foreground">
        Help us improve our service by allowing analytics tracking
      </p>
    </div>
  </div>
</div>
```

### Checkbox Group with Label

Organize related checkboxes under a group label:

```tsx
import { Label } from '@venizia/ardor-admin'

<div className="space-y-3">
  <Label className="text-base">Select features</Label>
  <div className="space-y-2 pl-2">
    <div className="flex items-center space-x-2">
      <Checkbox id="feature1" />
      <label htmlFor="feature1" className="text-sm">
        Advanced analytics
      </label>
    </div>
    <div className="flex items-center space-x-2">
      <Checkbox id="feature2" />
      <label htmlFor="feature2" className="text-sm">
        Team collaboration
      </label>
    </div>
    <div className="flex items-center space-x-2">
      <Checkbox id="feature3" />
      <label htmlFor="feature3" className="text-sm">
        Priority support
      </label>
    </div>
  </div>
</div>
```

## API Reference

### Checkbox

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | `boolean \| "indeterminate"` | - | Controlled checked state |
| `defaultChecked` | `boolean` | - | Uncontrolled default checked state |
| `onCheckedChange` | `(checked: boolean \| "indeterminate") => void` | - | Callback when checked state changes |
| `disabled` | `boolean` | `false` | Whether the checkbox is disabled |
| `required` | `boolean` | `false` | Whether the checkbox is required |
| `name` | `string` | - | Name attribute for form submission |
| `value` | `string` | `"on"` | Value submitted with form |
| `id` | `string` | - | ID for label association |
| `className` | `string` | - | Additional CSS classes |

Extends all HTML button attributes.

### Data Attributes

The Checkbox component uses these data attributes for styling:

- `data-slot="checkbox"` - Applied to checkbox element
- `data-slot="checkbox-indicator"` - Applied to check icon container
- `data-state="checked|unchecked|indeterminate"` - Current checkbox state
- `data-disabled` - Applied when disabled

## Accessibility

The Checkbox component follows WAI-ARIA Checkbox patterns for full accessibility:

### Keyboard Interactions

- **Space** - Toggles the checkbox between checked and unchecked
- **Tab** - Moves focus to/from the checkbox
- **Enter** - Submits form if checkbox is within a form (native behavior)

### Screen Reader Support

- Checkbox has `role="checkbox"` with proper ARIA attributes
- State communicated via `aria-checked="true|false|mixed"`
- Disabled state indicated with `aria-disabled="true"`
- Works with `aria-describedby` for error messages
- Label association via `htmlFor` and `id`

### Focus Management

- Visible focus ring via `focus-visible:ring-[3px]`
- Focus indicator uses theme's `--ring` color
- Keyboard-only focus (no focus on mouse click)

### Best Practices

::: tip
Always associate checkboxes with labels using `id` and `htmlFor`:
```tsx
<Checkbox id="subscribe" />
<label htmlFor="subscribe">Subscribe</label>
```
This improves accessibility and makes the entire label clickable.
:::

::: tip
Use `aria-invalid` for form validation:
```tsx
<Checkbox aria-invalid={!!error} />
{error && <span className="text-destructive">{error}</span>}
```
:::

::: warning
The `peer` class on the label enables styling based on checkbox state. Ensure proper HTML structure:
```tsx
<Checkbox id="item" className="peer" />
<label className="peer-disabled:opacity-50">Label</label>
```
:::

## Styling

### CSS Variables

The Checkbox component uses these CSS variables from your theme:

```css
--input              /* Border color */
--ring               /* Focus ring color */
--primary            /* Checked background color */
--primary-foreground /* Check icon color */
--destructive        /* Invalid state color */
```

### Visual States

The checkbox has distinct visual states:

- **Unchecked**: Border only, transparent background
- **Checked**: Primary background with check icon
- **Indeterminate**: Primary background with minus icon
- **Hover**: Subtle primary tint (`hover:bg-primary/10`)
- **Focus**: 3px ring around checkbox
- **Disabled**: Reduced opacity, no interaction
- **Invalid**: Destructive border and ring colors

### Customization

Override styles using className:

```tsx
<Checkbox
  className="size-5 rounded-full border-2 data-[state=checked]:bg-blue-600"
/>
```

### Dark Mode Support

The checkbox automatically adapts to dark mode:
- Darker background for unchecked state: `dark:bg-input/30`
- Adjusted hover states
- Proper contrast for borders and icons

## Common Patterns

### Terms and Conditions Checkbox

Standard pattern for accepting terms:

```tsx
import { useState } from 'react'
import { Checkbox } from '@venizia/ardor-admin'
import { Button } from '@venizia/ardor-admin'

function TermsCheckbox() {
  const [accepted, setAccepted] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-start space-x-2">
        <Checkbox
          id="terms"
          checked={accepted}
          onCheckedChange={(checked) => setAccepted(!!checked)}
          className="mt-0.5"
        />
        <label htmlFor="terms" className="text-sm leading-tight">
          I agree to the{' '}
          <a href="/terms" className="underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="underline">
            Privacy Policy
          </a>
        </label>
      </div>
      <Button disabled={!accepted}>Continue</Button>
    </div>
  )
}
```

### Checkbox List with Select All

Manage a list of checkboxes with a select-all option:

```tsx
import { useState } from 'react'

function CheckboxList() {
  const [selected, setSelected] = useState<string[]>([])

  const items = [
    { id: '1', name: 'Apple' },
    { id: '2', name: 'Banana' },
    { id: '3', name: 'Orange' },
    { id: '4', name: 'Grape' },
  ]

  const allSelected = selected.length === items.length
  const someSelected = selected.length > 0 && !allSelected

  const handleSelectAll = (checked: boolean) => {
    setSelected(checked ? items.map(i => i.id) : [])
  }

  const handleToggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2 font-medium border-b pb-2">
        <Checkbox
          checked={allSelected ? true : someSelected ? 'indeterminate' : false}
          onCheckedChange={handleSelectAll}
          id="select-all"
        />
        <label htmlFor="select-all" className="text-sm">
          Select all ({selected.length}/{items.length})
        </label>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center space-x-2 pl-6">
            <Checkbox
              id={item.id}
              checked={selected.includes(item.id)}
              onCheckedChange={() => handleToggle(item.id)}
            />
            <label htmlFor={item.id} className="text-sm">
              {item.name}
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Checkbox with Field Component

Integrate with the Field component for complete form control:

```tsx
import { useState } from 'react'
import { Checkbox, Field } from '@venizia/ardor-admin'

function CheckboxField() {
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (checked: boolean) => {
    setAgreed(checked)
    if (checked) setError('')
  }

  const validate = () => {
    if (!agreed) {
      setError('You must agree to continue')
      return false
    }
    return true
  }

  return (
    <Field error={error}>
      <div className="flex items-start space-x-2">
        <Checkbox
          id="agreement"
          checked={agreed}
          onCheckedChange={handleChange}
          aria-invalid={!!error}
        />
        <label htmlFor="agreement" className="text-sm">
          I understand and agree to the data processing terms
        </label>
      </div>
    </Field>
  )
}
```

### Nested Checkbox Groups

Create hierarchical checkbox selections:

```tsx
import { useState } from 'react'

function NestedCheckboxes() {
  const [parent, setParent] = useState(false)
  const [children, setChildren] = useState([false, false, false])

  const allChildrenChecked = children.every(c => c)
  const someChildrenChecked = children.some(c => c) && !allChildrenChecked

  const handleParent = (checked: boolean) => {
    setParent(!!checked)
    setChildren(children.map(() => !!checked))
  }

  const handleChild = (index: number) => {
    const newChildren = [...children]
    newChildren[index] = !newChildren[index]
    setChildren(newChildren)
    setParent(newChildren.every(c => c))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2 font-medium">
        <Checkbox
          id="parent"
          checked={allChildrenChecked ? true : someChildrenChecked ? 'indeterminate' : false}
          onCheckedChange={handleParent}
        />
        <label htmlFor="parent" className="text-sm">
          All permissions
        </label>
      </div>
      <div className="space-y-1 pl-6">
        {['Read', 'Write', 'Delete'].map((label, index) => (
          <div key={label} className="flex items-center space-x-2">
            <Checkbox
              id={`child-${index}`}
              checked={children[index]}
              onCheckedChange={() => handleChild(index)}
            />
            <label htmlFor={`child-${index}`} className="text-sm">
              {label}
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Related Components

- [Radio Group](/components/radio-group) - For single selection from multiple options
- [Switch](/components/switch) - For binary on/off toggles
- [Select](/components/select) - For dropdown selections
- [Label](/components/label) - For accessible form labels
- [Field](/components/field) - For complete form field with error handling
