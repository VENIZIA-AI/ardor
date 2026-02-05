# Input

A styled input component for forms and user input.

## Installation

```bash
bunx shadcn@latest add input
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Input } from '@venizia/ardor-admin';

export default function Example() {
  return <Input placeholder='Enter your email' />;
}
```

## Examples

### Basic Input

```tsx
<Input placeholder='Enter your name' />
```

### Input Types

The Input component supports all HTML input types:

```tsx
<Input type="email" placeholder="Email address" />
<Input type="password" placeholder="Password" />
<Input type="number" placeholder="Age" />
<Input type="tel" placeholder="Phone number" />
<Input type="url" placeholder="Website URL" />
<Input type="search" placeholder="Search..." />
```

### Date and Time Inputs

```tsx
<Input type="date" />
<Input type="time" />
<Input type="datetime-local" />
<Input type="month" />
<Input type="week" />
```

### File Input

The Input component includes special styling for file inputs:

```tsx
<Input type="file" />
<Input type="file" multiple />
<Input type="file" accept="image/*" />
<Input type="file" accept=".pdf,.doc,.docx" />
```

### With Labels and Form Fields

Use with the Field component for complete form controls:

```tsx
import { Field } from '@venizia/ardor-admin';

<Field>
  <Label>Email</Label>
  <Input type='email' placeholder='Enter your email' />
</Field>;
```

### Controlled Input

```tsx
import { useState } from 'react';

function ContactForm() {
  const [email, setEmail] = useState('');

  return (
    <Input
      type='email'
      value={email}
      onChange={e => setEmail(e.target.value)}
      placeholder='Enter your email'
    />
  );
}
```

### Validation States

The Input automatically styles validation states:

```tsx
// Valid input (custom styling via your form library)
<Input value="valid@email.com" className="border-green-500" />

// Invalid input (uses aria-invalid for automatic destructive styling)
<Input
  type="email"
  value="invalid-email"
  aria-invalid="true"
  placeholder="Enter a valid email"
/>
```

### Disabled State

```tsx
<Input placeholder="Disabled input" disabled />
<Input value="Read only value" disabled />
```

### Custom Styling

```tsx
<Input
  placeholder='Custom styled input'
  className='border-purple-300 focus-visible:ring-purple-500'
/>
```

## API Reference

### Input

| Prop          | Type               | Default     | Description                                                   |
| ------------- | ------------------ | ----------- | ------------------------------------------------------------- |
| `type`        | `string`           | `"text"`    | HTML input type (`text`, `email`, `password`, `number`, etc.) |
| `className`   | `string`           | `undefined` | Additional CSS classes to apply                               |
| `placeholder` | `string`           | `undefined` | Placeholder text                                              |
| `disabled`    | `boolean`          | `false`     | Whether the input is disabled                                 |
| `value`       | `string \| number` | `undefined` | Controlled input value                                        |
| `onChange`    | `function`         | `undefined` | Change event handler                                          |

Extends all standard HTML `<input>` attributes including:

- `id`, `name`, `required`, `maxLength`, `minLength`
- `min`, `max`, `step` (for number inputs)
- `accept`, `multiple` (for file inputs)
- `pattern`, `autoComplete`, `autoFocus`

### Data Attributes

The Input component uses these data attributes for styling:

- `data-slot="input"` - Applied to input element for styling context

## Accessibility

- **Role**: `textbox` (native HTML input)
- **Keyboard**: Standard text input navigation
- **Focus**: Visible focus ring via Tailwind's `focus-visible` utilities with 3px ring
- **Labels**: Always associate with a `<label>` element
- **Validation**: Use `aria-invalid="true"` for error states
- **Descriptions**: Use `aria-describedby` to reference help text or error messages

### Best Practices

::: tip
Always provide labels for inputs:

```tsx
<label htmlFor="email">Email</label>
<Input id="email" type="email" placeholder="Enter your email" />
```

Or use the Field component for automatic associations:

```tsx
<Field>
  <Label>Email</Label>
  <Input type='email' placeholder='Enter your email' />
</Field>
```

:::

::: warning
For file inputs, consider accessibility:

```tsx
<label htmlFor="documents">Upload documents</label>
<Input
  id="documents"
  type="file"
  accept=".pdf,.doc,.docx"
  aria-describedby="file-help"
/>
<p id="file-help">Accepted formats: PDF, DOC, DOCX</p>
```

:::

## Styling

### CSS Variables

The Input uses these CSS variables from your theme:

```css
--foreground
--muted-foreground
--primary
--primary-foreground
--input
--ring
--destructive
--border
```

### Focus Ring Behavior

ARDOR inputs feature a consistent focus system:

- **Focus**: 3px ring with `focus-visible:ring-[3px]` and semi-transparent ring color
- **Border**: Focus changes border color to ring color
- **Invalid State**: Destructive-colored ring and border for validation errors

### Dark Mode Support

The Input component includes built-in dark mode styling:

- `dark:bg-input/30` for subtle background in dark mode
- `dark:aria-invalid:ring-destructive/40` for enhanced error visibility

### File Input Styling

Special styling for file inputs includes:

- Custom file button appearance
- Consistent typography and spacing
- Integration with the overall design system

### Customization

To customize the Input styling, override classes:

```tsx
<Input
  className='
    h-12 
    border-2 
    border-purple-300 
    focus-visible:border-purple-500 
    focus-visible:ring-purple-500/30
  '
  placeholder='Custom input'
/>
```

For global customization, modify the component directly or use CSS variables.

## Form Integration

### With React Hook Form

```tsx
import { useForm } from 'react-hook-form';
import { Input } from '@venizia/ardor-admin';

function MyForm() {
  const {
    register,
    formState: { errors },
  } = useForm();

  return (
    <form>
      <Input
        {...register('email', { required: true })}
        type='email'
        placeholder='Email'
        aria-invalid={errors.email ? 'true' : 'false'}
      />
    </form>
  );
}
```

### With Validation Libraries

```tsx
import { Field, FieldError } from '@venizia/ardor-admin';

<Field>
  <Label>Email</Label>
  <Input type='email' placeholder='Enter your email' aria-invalid={hasError ? 'true' : 'false'} />
  {hasError && <FieldError>Please enter a valid email address</FieldError>}
</Field>;
```

## Related Components

- [Field](/components/field) - Complete form field with label and validation
- [Label](/components/label) - Accessible labels for form controls
- [Button](/components/button) - Submit buttons for forms
- [Textarea](/components/textarea) - Multi-line text input
- [Select](/components/select) - Dropdown selection input
