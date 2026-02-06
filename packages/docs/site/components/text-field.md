# Text Field

::: tip ARDOR Feature
Text Field is a comprehensive ARDOR form component that wraps Input/Textarea with integrated label, helper text, error handling, and icon support. It simplifies form creation with built-in Field integration.
:::

A complete form field component combining input/textarea with label, icons, helper text, and error messages. Supports both single-line and multiline text entry.

## Installation

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { TextField } from '@venizia/ardor-admin'

export default function Example() {
  return (
    <TextField
      label="Email"
      type="email"
      placeholder="Enter your email"
      helperText="We'll never share your email"
    />
  )
}
```

## Examples

### Basic Text Field

Simple text input with label:

```tsx
<TextField
  id="username"
  label="Username"
  placeholder="Enter username"
/>
```

### With Helper Text

Field with descriptive helper text:

```tsx
<TextField
  label="Password"
  type="password"
  helperText="Must be at least 8 characters long"
/>
```

### Required Field

Mark field as required:

```tsx
<TextField
  label="Full Name"
  required
  placeholder="John Doe"
/>
```

### With Error

Display validation error:

```tsx
<TextField
  label="Email"
  type="email"
  error
  errorText={[{ message: 'Invalid email address' }]}
/>
```

### With Start Icon

Icon at the beginning of input:

```tsx
import { Mail } from 'lucide-react'

<TextField
  label="Email"
  type="email"
  placeholder="you@example.com"
  startIcon={<Mail className="h-4 w-4" />}
/>
```

### With End Icon

Icon at the end of input:

```tsx
import { Search } from 'lucide-react'

<TextField
  label="Search"
  placeholder="Search..."
  endIcon={<Search className="h-4 w-4" />}
/>
```

### Multiline Text Field

Textarea for longer text:

```tsx
<TextField
  label="Description"
  placeholder="Enter description..."
  multiline
  rows={4}
/>
```

### Multiline with Block Icons

Icons above and below textarea:

```tsx
<TextField
  label="Bio"
  placeholder="Tell us about yourself..."
  multiline
  rows={5}
  startBlockIcon={<span className="text-xs font-medium">Start writing</span>}
  endBlockIcon={<span className="text-xs text-muted-foreground">0/500 characters</span>}
/>
```

### Controlled Field

Controlled text field with state:

```tsx
function ControlledExample() {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setValue(newValue)
    setError(newValue.length < 3)
  }

  return (
    <TextField
      label="Name"
      value={value}
      onChange={handleChange}
      error={error}
      errorText={error ? [{ message: 'Name must be at least 3 characters' }] : undefined}
      helperText="Enter your full name"
    />
  )
}
```

### Password Field with Toggle

Password field with show/hide:

```tsx
function PasswordField() {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <TextField
      label="Password"
      type={showPassword ? 'text' : 'password'}
      placeholder="Enter password"
      endIcon={
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="text-muted-foreground hover:text-foreground"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      }
    />
  )
}
```

### Form with Multiple Fields

Complete form example:

```tsx
function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Validate and submit
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextField
        label="Name"
        required
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        error={!!errors.name}
        errorText={errors.name ? [{ message: errors.name }] : undefined}
      />

      <TextField
        label="Email"
        type="email"
        required
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        startIcon={<Mail className="h-4 w-4" />}
        error={!!errors.email}
        errorText={errors.email ? [{ message: errors.email }] : undefined}
      />

      <TextField
        label="Message"
        multiline
        rows={5}
        required
        value={formData.message}
        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
        helperText="Tell us how we can help"
        error={!!errors.message}
        errorText={errors.message ? [{ message: errors.message }] : undefined}
      />

      <Button type="submit">Submit</Button>
    </form>
  )
}
```

## API Reference

### TextField

Complete form field component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `string` | - | Input element ID |
| `label` | `ReactNode` | - | Field label text |
| `required` | `boolean` | `false` | Mark field as required |
| `placeholder` | `string` | - | Input placeholder text |
| `type` | `string` | `"text"` | Input type (text, email, password, etc.) |
| `value` | `string` | - | Controlled value |
| `onChange` | `(e) => void` | - | Change handler |
| `disabled` | `boolean` | `false` | Disable field |
| `multiline` | `boolean` | `false` | Use textarea instead of input |
| `rows` | `number` | - | Textarea rows (when multiline) |
| `startIcon` | `ReactNode` | - | Icon at input start (inline) |
| `endIcon` | `ReactNode` | - | Icon at input end (inline) |
| `startBlockIcon` | `ReactNode` | - | Content above input/textarea |
| `endBlockIcon` | `ReactNode` | - | Content below input/textarea |
| `helperText` | `ReactNode` | - | Helper text below field |
| `error` | `boolean` | `false` | Show error state |
| `errorText` | `Array<{message?: string}>` | - | Error messages to display |
| `className` | `string` | - | Input/textarea CSS classes |
| `fieldClassName` | `string` | - | Field wrapper CSS classes |
| `inputGroupClassName` | `string` | - | InputGroup CSS classes |
| `fieldRef` | `Ref<HTMLDivElement>` | - | Ref to Field wrapper |

Extends all HTML input and textarea attributes.

### Icon Props Behavior

- **No icons**: Renders plain Input or Textarea
- **startIcon or endIcon**: Wraps in InputGroup with inline addons
- **startBlockIcon or endBlockIcon**: Wraps in InputGroup with block addons
- **Multiple icons**: Can combine inline and block icons

### Error Text Format

```tsx
errorText={[
  { message: 'Field is required' },
  { message: 'Must be at least 3 characters' },
]}
```

## Accessibility

TextField maintains full accessibility:

### Form Accessibility

- Proper label association via `htmlFor`
- Required fields marked with asterisk
- Error messages linked via `aria-invalid`
- Helper text provides additional context

### Screen Reader Support

- Labels announced before input
- Required state announced
- Error messages announced
- Helper text readable

### Keyboard Navigation

- Tab to navigate between fields
- Standard input keyboard interactions
- Textarea supports multi-line editing

### Best Practices

::: tip
Always provide labels:
```tsx
{/* Good - Label provided */}
<TextField
  id="email"
  label="Email"
  type="email"
/>

{/* Bad - No label */}
<TextField
  type="email"
  placeholder="Email"
/>
```
:::

::: tip
Use helper text for requirements:
```tsx
<TextField
  label="Password"
  type="password"
  required
  helperText="Must be 8-20 characters with at least one number"
/>
```
:::

## Styling

### CSS Variables

TextField uses semantic color tokens from Field, Input, and InputGroup:

```css
--input              /* Input border */
--ring               /* Focus ring */
--destructive        /* Error state */
--muted-foreground   /* Helper text, icons */
```

### Customization

```tsx
{/* Custom input styling */}
<TextField
  label="Custom"
  className="font-mono text-lg"
/>

{/* Custom field wrapper */}
<TextField
  label="Spaced"
  fieldClassName="mb-6"
/>

{/* Custom InputGroup styling */}
<TextField
  label="Bordered"
  inputGroupClassName="border-2 border-primary"
  startIcon={<Search />}
/>

{/* Large textarea */}
<TextField
  label="Notes"
  multiline
  rows={10}
  className="min-h-[200px]"
/>
```

### Dark Mode

- Automatically adapts via CSS variables
- All states work in both themes
- Icon colors adjust appropriately

## Common Patterns

### Search Field

```tsx
function SearchField() {
  const [query, setQuery] = useState('')

  return (
    <TextField
      placeholder="Search..."
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      startIcon={<Search className="h-4 w-4" />}
      endIcon={
        query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )
      }
    />
  )
}
```

### Character Counter

```tsx
function CharacterCountedField() {
  const [value, setValue] = useState('')
  const maxLength = 500

  return (
    <TextField
      label="Description"
      multiline
      rows={4}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      maxLength={maxLength}
      endBlockIcon={
        <span className="text-xs text-muted-foreground">
          {value.length}/{maxLength} characters
        </span>
      }
    />
  )
}
```

### Validation with React Hook Form

```tsx
import { useForm } from 'react-hook-form'

function FormWithValidation() {
  const { register, handleSubmit, formState: { errors } } = useForm()

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <TextField
        label="Email"
        type="email"
        {...register('email', {
          required: 'Email is required',
          pattern: {
            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
            message: 'Invalid email address'
          }
        })}
        error={!!errors.email}
        errorText={errors.email ? [{ message: errors.email.message as string }] : undefined}
      />
    </form>
  )
}
```

## Related Components

- [Input](/components/input) - Base input component
- [Textarea](/components/textarea) - Base textarea component
- [Field](/components/field) - Field wrapper component
- [Input Group](/components/input-group) - Input with addons
- [Label](/components/label) - Form label component
