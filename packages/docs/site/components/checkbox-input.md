# Checkbox Input

::: tip ARDOR Feature
Checkbox Input is an ARDOR form component that wraps the Checkbox with integrated label, error handling, and flexible orientation. Simplifies checkbox field creation with built-in Field integration.
:::

A complete checkbox field component combining checkbox with label and error messages. Supports vertical and horizontal orientations.

## Installation

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { CheckboxInput } from '@venizia/ardor-admin'

export default function Example() {
  return (
    <CheckboxInput
      label="Accept terms and conditions"
    />
  )
}
```

## Examples

### Basic Checkbox

Simple checkbox with label:

```tsx
<CheckboxInput
  id="terms"
  label="I agree to the terms and conditions"
/>
```

### Horizontal Orientation

Checkbox on the left, label on the right (default):

```tsx
<CheckboxInput
  label="Subscribe to newsletter"
  orientation="vertical"
/>
```

### Vertical Orientation

Label above checkbox:

```tsx
<CheckboxInput
  label="Enable notifications"
  orientation="horizontal"
/>
```

### With Error

Display validation error:

```tsx
<CheckboxInput
  label="Accept privacy policy"
  error
  errorText={[{ message: 'You must accept the privacy policy' }]}
/>
```

### Controlled Checkbox

Controlled checkbox with state:

```tsx
function ControlledExample() {
  const [checked, setChecked] = useState(false)

  return (
    <div className="space-y-4">
      <CheckboxInput
        label="Marketing emails"
        checked={checked}
        onCheckedChange={setChecked}
      />
      <p className="text-sm text-muted-foreground">
        Status: {checked ? 'Enabled' : 'Disabled'}
      </p>
    </div>
  )
}
```

### Disabled Checkbox

Disabled state:

```tsx
<div className="space-y-2">
  <CheckboxInput
    label="Disabled unchecked"
    disabled
  />
  <CheckboxInput
    label="Disabled checked"
    disabled
    checked
  />
</div>
```

### Indeterminate State

Checkbox with indeterminate state:

```tsx
function IndeterminateExample() {
  const [checked, setChecked] = useState<boolean | 'indeterminate'>('indeterminate')

  return (
    <CheckboxInput
      label="Select all items"
      checked={checked}
      onCheckedChange={setChecked}
    />
  )
}
```

### Multiple Checkboxes

Group of related checkboxes:

```tsx
function PreferencesForm() {
  const [preferences, setPreferences] = useState({
    email: false,
    sms: false,
    push: false,
  })

  return (
    <div className="space-y-3">
      <h3 className="font-medium mb-2">Notification Preferences</h3>
      <CheckboxInput
        label="Email notifications"
        checked={preferences.email}
        onCheckedChange={(checked) =>
          setPreferences({ ...preferences, email: checked as boolean })
        }
      />
      <CheckboxInput
        label="SMS notifications"
        checked={preferences.sms}
        onCheckedChange={(checked) =>
          setPreferences({ ...preferences, sms: checked as boolean })
        }
      />
      <CheckboxInput
        label="Push notifications"
        checked={preferences.push}
        onCheckedChange={(checked) =>
          setPreferences({ ...preferences, push: checked as boolean })
        }
      />
    </div>
  )
}
```

### Select All Pattern

Parent checkbox controlling children:

```tsx
function SelectAllCheckboxes() {
  const [items, setItems] = useState([
    { id: 1, label: 'Item 1', checked: false },
    { id: 2, label: 'Item 2', checked: false },
    { id: 3, label: 'Item 3', checked: false },
  ])

  const allChecked = items.every(item => item.checked)
  const someChecked = items.some(item => item.checked)
  const selectAllState = allChecked ? true : someChecked ? 'indeterminate' : false

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    const newChecked = checked === true
    setItems(items.map(item => ({ ...item, checked: newChecked })))
  }

  const handleItemChange = (id: number, checked: boolean) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, checked } : item
    ))
  }

  return (
    <div className="space-y-3">
      <CheckboxInput
        label="Select all"
        checked={selectAllState}
        onCheckedChange={handleSelectAll}
      />
      <div className="pl-6 space-y-2 border-l-2">
        {items.map(item => (
          <CheckboxInput
            key={item.id}
            label={item.label}
            checked={item.checked}
            onCheckedChange={(checked) => handleItemChange(item.id, checked as boolean)}
          />
        ))}
      </div>
    </div>
  )
}
```

### Form with Validation

Checkbox in validated form:

```tsx
function FormWithCheckbox() {
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!accepted) {
      setError(true)
      return
    }
    setError(false)
    // Submit form
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextField
        label="Email"
        type="email"
        required
      />
      <CheckboxInput
        label={
          <span>
            I accept the{' '}
            <a href="/terms" className="underline">
              terms and conditions
            </a>
          </span>
        }
        checked={accepted}
        onCheckedChange={(checked) => {
          setAccepted(checked as boolean)
          setError(false)
        }}
        error={error}
        errorText={error ? [{ message: 'You must accept the terms to continue' }] : undefined}
      />
      <Button type="submit">Submit</Button>
    </form>
  )
}
```

### Rich Label Content

Checkbox with complex label:

```tsx
<CheckboxInput
  label={
    <div>
      <div className="font-medium">Premium Plan</div>
      <div className="text-xs text-muted-foreground">
        Includes all features plus priority support
      </div>
    </div>
  }
/>
```

## API Reference

### CheckboxInput

Complete checkbox field component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `string` | - | Checkbox element ID |
| `label` | `ReactNode` | - | Label text or content |
| `checked` | `boolean \| "indeterminate"` | - | Controlled checked state |
| `onCheckedChange` | `(checked: boolean \| "indeterminate") => void` | - | Change handler |
| `disabled` | `boolean` | `false` | Disable checkbox |
| `required` | `boolean` | `false` | Mark as required |
| `orientation` | `"vertical" \| "horizontal"` | `"vertical"` | Label/checkbox layout |
| `error` | `boolean` | `false` | Show error state |
| `errorText` | `Array<{message?: string}>` | - | Error messages to display |
| `className` | `string` | - | Additional CSS classes |

Extends all Radix UI Checkbox.Root props.

### Orientation Values

- **`"vertical"`** (default) - Checkbox on left, label on right (horizontal layout)
- **`"horizontal"`** - Label above checkbox (vertical layout)

Note: The naming is based on the direction of the layout flow, which may seem counter-intuitive.

### Error Text Format

```tsx
errorText={[
  { message: 'This field is required' },
]}
```

## Accessibility

CheckboxInput maintains full accessibility:

### Checkbox Accessibility

- Proper label association via `htmlFor`
- Keyboard accessible (Space to toggle)
- ARIA attributes for state
- Error messages linked

### Screen Reader Support

- Label announced with checkbox
- Checked/unchecked state announced
- Indeterminate state announced
- Error messages announced

### Keyboard Interactions

- **Space** - Toggle checked state
- **Tab** - Navigate to/from checkbox
- Standard checkbox keyboard behavior

### Best Practices

::: tip
Always provide meaningful labels:
```tsx
{/* Good - Clear, specific */}
<CheckboxInput
  label="Send me weekly newsletter updates"
/>

{/* Bad - Vague */}
<CheckboxInput
  label="Subscribe"
/>
```
:::

::: tip
Use for boolean choices, not exclusive selections:
```tsx
{/* Good - Independent choices */}
<CheckboxInput label="Email notifications" />
<CheckboxInput label="SMS notifications" />
<CheckboxInput label="Push notifications" />

{/* Bad - Use RadioGroup instead */}
<CheckboxInput label="Option A" />
<CheckboxInput label="Option B" />
```
:::

## Styling

### CSS Variables

CheckboxInput uses semantic color tokens from Checkbox and Field:

```css
--primary            /* Checked background */
--primary-foreground /* Check icon color */
--ring               /* Focus ring */
--destructive        /* Error state */
```

### Customization

```tsx
{/* Horizontal layout with left-aligned label */}
<CheckboxInput
  label="Option"
  orientation="horizontal"
  className="items-start"
/>

{/* Custom label styling */}
<CheckboxInput
  label={<span className="font-semibold">Important option</span>}
/>

{/* Custom spacing */}
<div className="space-y-4">
  <CheckboxInput label="Option 1" />
  <CheckboxInput label="Option 2" />
</div>
```

### Dark Mode

- Automatically adapts via CSS variables
- Checkbox state visible in both themes
- Error states maintain contrast

## Common Patterns

### Terms Acceptance

```tsx
function TermsCheckbox() {
  const [accepted, setAccepted] = useState(false)

  return (
    <CheckboxInput
      required
      label={
        <span className="text-sm">
          I have read and agree to the{' '}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-primary hover:no-underline"
          >
            Terms of Service
          </a>
          {' '}and{' '}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-primary hover:no-underline"
          >
            Privacy Policy
          </a>
        </span>
      }
      checked={accepted}
      onCheckedChange={(checked) => setAccepted(checked as boolean)}
    />
  )
}
```

### Conditional Field Display

```tsx
function ConditionalForm() {
  const [showAddress, setShowAddress] = useState(false)

  return (
    <div className="space-y-4">
      <CheckboxInput
        label="Billing address is different from shipping"
        checked={showAddress}
        onCheckedChange={(checked) => setShowAddress(checked as boolean)}
      />

      {showAddress && (
        <div className="pl-6 space-y-3 border-l-2">
          <TextField label="Billing Address" />
          <TextField label="City" />
          <TextField label="Postal Code" />
        </div>
      )}
    </div>
  )
}
```

### Permissions Matrix

```tsx
function PermissionsMatrix() {
  const [permissions, setPermissions] = useState({
    read: false,
    write: false,
    delete: false,
    admin: false,
  })

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">User Permissions</h3>
      <CheckboxInput
        label="Read access"
        checked={permissions.read}
        onCheckedChange={(checked) =>
          setPermissions({ ...permissions, read: checked as boolean })
        }
      />
      <CheckboxInput
        label="Write access"
        checked={permissions.write}
        disabled={!permissions.read}
        onCheckedChange={(checked) =>
          setPermissions({ ...permissions, write: checked as boolean })
        }
      />
      <CheckboxInput
        label="Delete access"
        checked={permissions.delete}
        disabled={!permissions.write}
        onCheckedChange={(checked) =>
          setPermissions({ ...permissions, delete: checked as boolean })
        }
      />
      <Separator />
      <CheckboxInput
        label="Administrator (all permissions)"
        checked={permissions.admin}
        onCheckedChange={(checked) => {
          const isAdmin = checked as boolean
          setPermissions({
            read: isAdmin,
            write: isAdmin,
            delete: isAdmin,
            admin: isAdmin,
          })
        }}
      />
    </div>
  )
}
```

## Related Components

- [Checkbox](/components/checkbox) - Base checkbox component
- [Field](/components/field) - Field wrapper component
- [Radio Group](/components/radio-group) - For exclusive selections
- [Switch Input](/components/switch-input) - Alternative toggle input
