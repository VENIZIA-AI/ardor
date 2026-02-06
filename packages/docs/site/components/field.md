# Field

A comprehensive form field wrapper that provides consistent layout, labels, descriptions, and error handling for form controls. Built with semantic HTML and flexible composition.

## Installation

```bash
bunx shadcn@latest add field
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Field, FieldLabel, FieldDescription, FieldError, Input } from '@venizia/ardor-admin'

export default function Example() {
  return (
    <Field>
      <FieldLabel htmlFor="email">Email</FieldLabel>
      <Input id="email" type="email" />
      <FieldDescription>We'll never share your email.</FieldDescription>
    </Field>
  )
}
```

## Examples

### Basic Field

A simple field with label and input:

```tsx
<Field>
  <FieldLabel htmlFor="name">Name</FieldLabel>
  <Input id="name" placeholder="John Doe" />
</Field>
```

### With Description

Add helpful description text:

```tsx
<Field>
  <FieldLabel htmlFor="username">Username</FieldLabel>
  <Input id="username" placeholder="johndoe" />
  <FieldDescription>
    This will be your public display name.
  </FieldDescription>
</Field>
```

### With Error

Display validation errors:

```tsx
import { useState } from 'react'

function FieldWithError() {
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
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor="name">Name</FieldLabel>
      <Input
        id="name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => validate(value)}
        aria-invalid={!!error}
      />
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}
```

### Horizontal Layout

Arrange field components horizontally:

```tsx
<Field orientation="horizontal">
  <FieldLabel htmlFor="notifications">Email notifications</FieldLabel>
  <Switch id="notifications" />
</Field>
```

### Responsive Layout

Vertical on mobile, horizontal on larger screens:

```tsx
<FieldGroup>
  <Field orientation="responsive">
    <FieldLabel htmlFor="firstName">First name</FieldLabel>
    <Input id="firstName" />
  </Field>
  <Field orientation="responsive">
    <FieldLabel htmlFor="lastName">Last name</FieldLabel>
    <Input id="lastName" />
  </Field>
</FieldGroup>
```

### FieldSet with Legend

Group related fields:

```tsx
<FieldSet>
  <FieldLegend>Personal Information</FieldLegend>
  <Field>
    <FieldLabel htmlFor="firstName">First Name</FieldLabel>
    <Input id="firstName" />
  </Field>
  <Field>
    <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
    <Input id="lastName" />
  </Field>
  <Field>
    <FieldLabel htmlFor="email">Email</FieldLabel>
    <Input id="email" type="email" />
  </Field>
</FieldSet>
```

### Multiple Errors

Display multiple validation errors:

```tsx
const errors = [
  { message: 'Must contain at least 8 characters' },
  { message: 'Must contain an uppercase letter' },
  { message: 'Must contain a number' }
]

<Field data-invalid={!!errors.length}>
  <FieldLabel htmlFor="password">Password</FieldLabel>
  <Input id="password" type="password" />
  <FieldError errors={errors} />
</Field>
```

### With FieldContent

Advanced layout with rich content:

```tsx
<Field orientation="horizontal">
  <FieldLabel htmlFor="marketing">Marketing emails</FieldLabel>
  <FieldContent>
    <Switch id="marketing" />
    <FieldDescription>
      Receive emails about new products, features, and more.
    </FieldDescription>
  </FieldContent>
</Field>
```

### Field Separator

Visual separators between field groups:

```tsx
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="firstName">First Name</FieldLabel>
    <Input id="firstName" />
  </Field>
  <Field>
    <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
    <Input id="lastName" />
  </Field>

  <FieldSeparator>Contact Information</FieldSeparator>

  <Field>
    <FieldLabel htmlFor="email">Email</FieldLabel>
    <Input id="email" type="email" />
  </Field>
  <Field>
    <FieldLabel htmlFor="phone">Phone</FieldLabel>
    <Input id="phone" type="tel" />
  </Field>
</FieldGroup>
```

## API Reference

### Field

Main field container with orientation support.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `orientation` | `"vertical" \| "horizontal" \| "responsive"` | `"vertical"` | Layout direction |
| `data-invalid` | `boolean` | - | Marks field as invalid (applies error styling) |
| `className` | `string` | - | Additional CSS classes |

### FieldLabel

Label component for form controls.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `htmlFor` | `string` | - | ID of the associated form control |
| `className` | `string` | - | Additional CSS classes |

Extends all Label component props.

### FieldDescription

Descriptive text to help users understand the field.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML paragraph attributes.

### FieldError

Error message display for field validation.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `errors` | `Array<{ message?: string }>` | - | Array of error objects to display |
| `children` | `ReactNode` | - | Custom error content (overrides errors prop) |
| `className` | `string` | - | Additional CSS classes |

### FieldContent

Container for complex field content.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### FieldGroup

Groups multiple related fields.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### FieldSet

Semantic fieldset wrapper for field groups.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML fieldset attributes.

### FieldLegend

Legend for field sets.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"legend" \| "label"` | `"legend"` | Style variant |
| `className` | `string` | - | Additional CSS classes |

### FieldSeparator

Visual separator between field groups.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | - | Optional label for the separator |
| `className` | `string` | - | Additional CSS classes |

### FieldTitle

Alternative to FieldLabel for non-control titles.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### Data Attributes

- `data-slot="field"` - Field container
- `data-slot="field-label"` - Field label
- `data-slot="field-description"` - Description text
- `data-slot="field-error"` - Error message
- `data-slot="field-content"` - Content container
- `data-slot="field-group"` - Field group
- `data-slot="field-set"` - Field set
- `data-slot="field-legend"` - Legend element
- `data-slot="field-separator"` - Separator element
- `data-orientation="vertical|horizontal|responsive"` - Layout orientation
- `data-invalid="true"` - Invalid state
- `data-disabled="true"` - Disabled state

## Accessibility

The Field component follows form accessibility best practices:

### Label Association

- Uses proper `htmlFor` and `id` association
- Screen readers announce labels when controls are focused
- Clicking labels focuses associated controls

### Error Messaging

- FieldError has `role="alert"` for screen reader announcements
- Errors are associated with controls via `aria-describedby`
- Invalid state indicated with `aria-invalid`

### Fieldset Semantics

- Proper `<fieldset>` and `<legend>` for grouped fields
- Screen readers announce groups and their legends

### Best Practices

::: tip
Always use FieldLabel with form controls:
```tsx
<Field>
  <FieldLabel htmlFor="email">Email</FieldLabel>
  <Input id="email" />
</Field>
```
:::

::: tip
Associate errors with controls:
```tsx
<Input
  id="name"
  aria-invalid={!!error}
  aria-describedby={error ? "name-error" : undefined}
/>
{error && <FieldError id="name-error">{error}</FieldError>}
```
:::

## Styling

### CSS Variables

The Field component uses theme colors:

```css
--destructive      /* Error text color */
--muted-foreground /* Description text color */
--primary          /* Accent colors */
```

### Orientation Layouts

**Vertical** (default):
- Stacks label, control, and helper text vertically
- Full width for all elements

**Horizontal**:
- Label and control side-by-side
- Label is flex-auto (takes remaining space)
- Useful for switches and checkboxes

**Responsive**:
- Vertical on mobile
- Horizontal on medium screens and up (`@md/field-group`)
- Best of both worlds

### Customization

```tsx
<Field className="bg-muted p-4 rounded-lg">
  <FieldLabel className="text-lg font-bold">
    Custom Styled Field
  </FieldLabel>
  <Input />
</Field>
```

## Common Patterns

### Complete Form Field

Full-featured field with all components:

```tsx
import { useState } from 'react'
import { Field, FieldLabel, FieldDescription, FieldError, Input, Button } from '@venizia/ardor-admin'

function CompleteField() {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const validate = (val: string) => {
    if (!val) {
      setError('Email is required')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      setError('Please enter a valid email')
    } else {
      setError('')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    validate(value)
    if (!error && value) {
      console.log('Submitted:', value)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field data-invalid={!!error}>
        <FieldLabel htmlFor="email">
          Email <span className="text-destructive">*</span>
        </FieldLabel>
        <Input
          id="email"
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => validate(value)}
          aria-invalid={!!error}
          aria-describedby={error ? "email-error" : "email-desc"}
        />
        <FieldDescription id="email-desc">
          We'll never share your email with anyone else.
        </FieldDescription>
        {error && <FieldError id="email-error">{error}</FieldError>}
      </Field>
      <Button type="submit">Submit</Button>
    </form>
  )
}
```

### Multi-Field Form

Complete form with multiple fields:

```tsx
import { useState } from 'react'
import { FieldSet, FieldLegend, Field, FieldLabel, Input, Textarea, Button } from '@venizia/ardor-admin'

function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted:', formData)
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-6">
      <FieldSet>
        <FieldLegend>Contact Us</FieldLegend>

        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="message">Message</FieldLabel>
          <Textarea
            id="message"
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            required
          />
        </Field>
      </FieldSet>

      <Button type="submit" className="w-full">
        Send Message
      </Button>
    </form>
  )
}
```

### Settings Form

Horizontal fields for settings:

```tsx
import { useState } from 'react'
import { FieldGroup, Field, FieldLabel, FieldContent, FieldDescription, Switch } from '@venizia/ardor-admin'

function SettingsForm() {
  const [settings, setSettings] = useState({
    notifications: true,
    marketing: false,
    analytics: true
  })

  return (
    <FieldGroup>
      <Field orientation="horizontal">
        <FieldLabel htmlFor="notifications">Push Notifications</FieldLabel>
        <FieldContent>
          <Switch
            id="notifications"
            checked={settings.notifications}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, notifications: checked })
            }
          />
          <FieldDescription>
            Receive push notifications about updates
          </FieldDescription>
        </FieldContent>
      </Field>

      <Field orientation="horizontal">
        <FieldLabel htmlFor="marketing">Marketing Emails</FieldLabel>
        <FieldContent>
          <Switch
            id="marketing"
            checked={settings.marketing}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, marketing: checked })
            }
          />
          <FieldDescription>
            Receive emails about promotions and offers
          </FieldDescription>
        </FieldContent>
      </Field>

      <Field orientation="horizontal">
        <FieldLabel htmlFor="analytics">Analytics</FieldLabel>
        <FieldContent>
          <Switch
            id="analytics"
            checked={settings.analytics}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, analytics: checked })
            }
          />
          <FieldDescription>
            Help us improve by sharing usage data
          </FieldDescription>
        </FieldContent>
      </Field>
    </FieldGroup>
  )
}
```

## Related Components

- [Input](/components/input) - Text input that works with Field
- [Textarea](/components/textarea) - Multi-line input
- [Select](/components/select) - Dropdown selections
- [Checkbox](/components/checkbox) - Checkbox inputs
- [Radio Group](/components/radio-group) - Radio button groups
- [Switch](/components/switch) - Toggle switches
- [Label](/components/label) - Base label component
