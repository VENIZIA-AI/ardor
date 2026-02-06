# Radio Group

A set of radio buttons that allows users to select a single option from multiple choices. Built on Radix UI Radio Group primitive.

## Installation

```bash
bunx shadcn@latest add radio-group
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { RadioGroup, RadioGroupItem } from '@venizia/ardor-admin'

export default function Example() {
  return (
    <RadioGroup defaultValue="option1">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option1" id="option1" />
        <label htmlFor="option1">Option 1</label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option2" id="option2" />
        <label htmlFor="option2">Option 2</label>
      </div>
    </RadioGroup>
  )
}
```

## Examples

### Basic Radio Group

A simple radio group with labels:

```tsx
import { RadioGroup, RadioGroupItem, Label } from '@venizia/ardor-admin'

<RadioGroup defaultValue="comfortable">
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="default" id="r1" />
    <Label htmlFor="r1">Default</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="comfortable" id="r2" />
    <Label htmlFor="r2">Comfortable</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="compact" id="r3" />
    <Label htmlFor="r3">Compact</Label>
  </div>
</RadioGroup>
```

### Controlled Radio Group

Control the selected value with state:

```tsx
import { useState } from 'react'
import { RadioGroup, RadioGroupItem, Label } from '@venizia/ardor-admin'

function ControlledRadioGroup() {
  const [value, setValue] = useState('card')

  return (
    <div className="space-y-4">
      <RadioGroup value={value} onValueChange={setValue}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="card" id="card" />
          <Label htmlFor="card">Credit Card</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="paypal" id="paypal" />
          <Label htmlFor="paypal">PayPal</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="crypto" id="crypto" />
          <Label htmlFor="crypto">Cryptocurrency</Label>
        </div>
      </RadioGroup>
      <p className="text-sm text-muted-foreground">
        Selected: {value}
      </p>
    </div>
  )
}
```

### With Descriptions

Add descriptive text to each option:

```tsx
<RadioGroup defaultValue="standard">
  <div className="flex items-start space-x-3">
    <RadioGroupItem value="standard" id="standard" className="mt-0.5" />
    <div className="grid gap-1.5 leading-none">
      <Label htmlFor="standard">Standard Shipping</Label>
      <p className="text-sm text-muted-foreground">
        3-5 business days • Free
      </p>
    </div>
  </div>
  <div className="flex items-start space-x-3">
    <RadioGroupItem value="express" id="express" className="mt-0.5" />
    <div className="grid gap-1.5 leading-none">
      <Label htmlFor="express">Express Shipping</Label>
      <p className="text-sm text-muted-foreground">
        1-2 business days • $9.99
      </p>
    </div>
  </div>
  <div className="flex items-start space-x-3">
    <RadioGroupItem value="overnight" id="overnight" className="mt-0.5" />
    <div className="grid gap-1.5 leading-none">
      <Label htmlFor="overnight">Overnight Shipping</Label>
      <p className="text-sm text-muted-foreground">
        Next business day • $19.99
      </p>
    </div>
  </div>
</RadioGroup>
```

### Disabled Options

Disable specific options to prevent selection:

```tsx
<RadioGroup defaultValue="option1">
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option1" id="opt1" />
    <Label htmlFor="opt1">Available option</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option2" id="opt2" disabled />
    <Label htmlFor="opt2">Disabled option</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option3" id="opt3" />
    <Label htmlFor="opt3">Another available option</Label>
  </div>
</RadioGroup>
```

### With Icons

Add visual indicators with icons:

```tsx
import { CreditCard, DollarSign, Smartphone } from 'lucide-react'

<RadioGroup defaultValue="card">
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="card" id="card-payment" />
    <Label htmlFor="card-payment" className="flex items-center gap-2">
      <CreditCard className="h-4 w-4" />
      Credit Card
    </Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="bank" id="bank-payment" />
    <Label htmlFor="bank-payment" className="flex items-center gap-2">
      <DollarSign className="h-4 w-4" />
      Bank Transfer
    </Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="mobile" id="mobile-payment" />
    <Label htmlFor="mobile-payment" className="flex items-center gap-2">
      <Smartphone className="h-4 w-4" />
      Mobile Wallet
    </Label>
  </div>
</RadioGroup>
```

### Card-Style Options

Create card-like selectable options:

```tsx
<RadioGroup defaultValue="pro" className="gap-4">
  <div className="relative">
    <RadioGroupItem value="free" id="free" className="peer sr-only" />
    <Label
      htmlFor="free"
      className="flex flex-col gap-2 p-4 border rounded-lg cursor-pointer hover:bg-accent peer-data-[state=checked]:border-primary"
    >
      <span className="font-semibold">Free Plan</span>
      <span className="text-sm text-muted-foreground">
        Basic features for individuals
      </span>
      <span className="text-2xl font-bold">$0/mo</span>
    </Label>
  </div>
  <div className="relative">
    <RadioGroupItem value="pro" id="pro" className="peer sr-only" />
    <Label
      htmlFor="pro"
      className="flex flex-col gap-2 p-4 border rounded-lg cursor-pointer hover:bg-accent peer-data-[state=checked]:border-primary"
    >
      <span className="font-semibold">Pro Plan</span>
      <span className="text-sm text-muted-foreground">
        Advanced features for professionals
      </span>
      <span className="text-2xl font-bold">$19/mo</span>
    </Label>
  </div>
  <div className="relative">
    <RadioGroupItem value="enterprise" id="enterprise" className="peer sr-only" />
    <Label
      htmlFor="enterprise"
      className="flex flex-col gap-2 p-4 border rounded-lg cursor-pointer hover:bg-accent peer-data-[state=checked]:border-primary"
    >
      <span className="font-semibold">Enterprise Plan</span>
      <span className="text-sm text-muted-foreground">
        Custom solutions for organizations
      </span>
      <span className="text-2xl font-bold">Custom</span>
    </Label>
  </div>
</RadioGroup>
```

### Form Integration

Integrate radio group with form handling:

```tsx
import { useState } from 'react'
import { RadioGroup, RadioGroupItem, Label, Button } from '@venizia/ardor-admin'

function FormExample() {
  const [plan, setPlan] = useState('standard')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Selected plan:', plan)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <Label className="text-base">Choose a plan</Label>
        <RadioGroup value={plan} onValueChange={setPlan}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="basic" id="basic" />
            <Label htmlFor="basic">Basic - $9/mo</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="standard" id="standard" />
            <Label htmlFor="standard">Standard - $19/mo</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="premium" id="premium" />
            <Label htmlFor="premium">Premium - $29/mo</Label>
          </div>
        </RadioGroup>
      </div>
      <Button type="submit">Continue</Button>
    </form>
  )
}
```

## API Reference

### RadioGroup

Root component that manages radio group state.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Controlled selected value |
| `defaultValue` | `string` | - | Uncontrolled default value |
| `onValueChange` | `(value: string) => void` | - | Callback when value changes |
| `disabled` | `boolean` | `false` | Whether the radio group is disabled |
| `required` | `boolean` | `false` | Whether the radio group is required |
| `name` | `string` | - | Name attribute for form submission |
| `className` | `string` | - | Additional CSS classes |

### RadioGroupItem

An individual radio button option.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | The value of the radio item (required) |
| `disabled` | `boolean` | `false` | Whether this item is disabled |
| `id` | `string` | - | ID for label association |
| `className` | `string` | - | Additional CSS classes |

Extends all HTML button attributes.

### Data Attributes

The Radio Group component uses these data attributes for styling:

- `data-slot="radio-group"` - Applied to root element
- `data-slot="radio-group-item"` - Applied to each radio button
- `data-slot="radio-group-indicator"` - Applied to the checked indicator
- `data-state="checked|unchecked"` - Current item state
- `data-disabled` - Applied when disabled

## Accessibility

The Radio Group component follows WAI-ARIA Radio Group patterns:

### Keyboard Interactions

- **Tab** - Moves focus into/out of the radio group
- **Space** - Selects the focused radio button
- **Arrow Down/Right** - Moves focus to next radio button (wraps around)
- **Arrow Up/Left** - Moves focus to previous radio button (wraps around)
- **Home** - Moves focus to first radio button
- **End** - Moves focus to last radio button

### Screen Reader Support

- Radio group has `role="radiogroup"`
- Each item has `role="radio"` with proper ARIA attributes
- Selected item indicated with `aria-checked="true"`
- Disabled items indicated with `aria-disabled="true"`
- Label association via `htmlFor` and `id`

### Focus Management

- Roving tabindex (only one radio focusable at a time)
- Visual focus indicator on focused radio
- Arrow keys navigate within the group
- Tab moves to next form element

### Best Practices

::: tip
Always associate radio buttons with labels:
```tsx
<RadioGroupItem value="option1" id="opt1" />
<Label htmlFor="opt1">Option 1</Label>
```
:::

::: tip
Provide a group label for context:
```tsx
<Label className="text-base">Choose your plan</Label>
<RadioGroup>
  {/* options */}
</RadioGroup>
```
:::

::: warning
Radio groups require at least 2 options. For binary choices, consider using a Switch or Checkbox instead.
:::

## Styling

### CSS Variables

The Radio Group uses these CSS variables:

```css
--input        /* Border color */
--ring         /* Focus ring color */
--primary      /* Selected indicator color */
--destructive  /* Invalid state color */
```

### Visual States

- **Unchecked**: Border only, empty circle
- **Checked**: Primary colored filled dot
- **Focus**: 3px ring around radio button
- **Disabled**: Reduced opacity, no interaction
- **Invalid**: Destructive border and ring

### Customization

```tsx
<RadioGroup className="gap-4">
  <RadioGroupItem
    className="size-5 border-2 data-[state=checked]:border-blue-600"
  />
</RadioGroup>
```

### Dark Mode Support

Automatic dark mode adaptation with `dark:bg-input/30`.

## Common Patterns

### Payment Method Selection

```tsx
import { useState } from 'react'
import { RadioGroup, RadioGroupItem, Label } from '@venizia/ardor-admin'
import { CreditCard, Building, Smartphone } from 'lucide-react'

function PaymentMethod() {
  const [method, setMethod] = useState('card')

  return (
    <div className="space-y-4">
      <Label className="text-base">Payment Method</Label>
      <RadioGroup value={method} onValueChange={setMethod}>
        <div className="flex items-start space-x-3 p-3 border rounded-lg">
          <RadioGroupItem value="card" id="credit-card" className="mt-1" />
          <div className="flex-1">
            <Label htmlFor="credit-card" className="flex items-center gap-2 cursor-pointer">
              <CreditCard className="h-4 w-4" />
              <span>Credit Card</span>
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Pay with Visa, Mastercard, or Amex
            </p>
          </div>
        </div>
        <div className="flex items-start space-x-3 p-3 border rounded-lg">
          <RadioGroupItem value="bank" id="bank-transfer" className="mt-1" />
          <div className="flex-1">
            <Label htmlFor="bank-transfer" className="flex items-center gap-2 cursor-pointer">
              <Building className="h-4 w-4" />
              <span>Bank Transfer</span>
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Direct bank account transfer
            </p>
          </div>
        </div>
        <div className="flex items-start space-x-3 p-3 border rounded-lg">
          <RadioGroupItem value="wallet" id="mobile-wallet" className="mt-1" />
          <div className="flex-1">
            <Label htmlFor="mobile-wallet" className="flex items-center gap-2 cursor-pointer">
              <Smartphone className="h-4 w-4" />
              <span>Mobile Wallet</span>
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Apple Pay, Google Pay, or Samsung Pay
            </p>
          </div>
        </div>
      </RadioGroup>
    </div>
  )
}
```

### Survey Question

```tsx
function SurveyQuestion() {
  const [rating, setRating] = useState('')

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">How satisfied are you with our service?</h3>
        <p className="text-sm text-muted-foreground">
          Please select one option
        </p>
      </div>
      <RadioGroup value={rating} onValueChange={setRating}>
        {['Very Satisfied', 'Satisfied', 'Neutral', 'Unsatisfied', 'Very Unsatisfied'].map((option) => (
          <div key={option} className="flex items-center space-x-2">
            <RadioGroupItem value={option.toLowerCase()} id={option} />
            <Label htmlFor={option}>{option}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  )
}
```

## Related Components

- [Checkbox](/components/checkbox) - For multiple selections
- [Select](/components/select) - For dropdown selections
- [Switch](/components/switch) - For binary toggle states
- [Label](/components/label) - For accessible form labels
- [Button](/components/button) - For form submission
