# Accordion

A vertically stacked set of interactive headings that reveal or hide associated content panels. Built on Radix UI Accordion primitive with smooth animations.

## Installation

```bash
bunx shadcn@latest add accordion
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@venizia/ardor-admin'

export default function Example() {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger>Is it accessible?</AccordionTrigger>
        <AccordionContent>
          Yes. It adheres to the WAI-ARIA design pattern.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
```

## Examples

### Single Collapsible

Only one item open at a time, can collapse all:

```tsx
<Accordion type="single" collapsible className="w-full">
  <AccordionItem value="item-1">
    <AccordionTrigger>Is it accessible?</AccordionTrigger>
    <AccordionContent>
      Yes. It adheres to the WAI-ARIA design pattern.
    </AccordionContent>
  </AccordionItem>

  <AccordionItem value="item-2">
    <AccordionTrigger>Is it styled?</AccordionTrigger>
    <AccordionContent>
      Yes. It comes with default styles that matches the other components' aesthetic.
    </AccordionContent>
  </AccordionItem>

  <AccordionItem value="item-3">
    <AccordionTrigger>Is it animated?</AccordionTrigger>
    <AccordionContent>
      Yes. It's animated by default, but you can disable it if you prefer.
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

### Multiple Open Items

Allow multiple items to be open simultaneously:

```tsx
<Accordion type="multiple" className="w-full">
  <AccordionItem value="item-1">
    <AccordionTrigger>Feature 1</AccordionTrigger>
    <AccordionContent>
      Description of feature 1 goes here.
    </AccordionContent>
  </AccordionItem>

  <AccordionItem value="item-2">
    <AccordionTrigger>Feature 2</AccordionTrigger>
    <AccordionContent>
      Description of feature 2 goes here.
    </AccordionContent>
  </AccordionItem>

  <AccordionItem value="item-3">
    <AccordionTrigger>Feature 3</AccordionTrigger>
    <AccordionContent>
      Description of feature 3 goes here.
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

### Default Open Item

Start with specific item(s) open:

```tsx
<Accordion type="single" defaultValue="item-2" collapsible>
  <AccordionItem value="item-1">
    <AccordionTrigger>First Item</AccordionTrigger>
    <AccordionContent>Content 1</AccordionContent>
  </AccordionItem>

  <AccordionItem value="item-2">
    <AccordionTrigger>Second Item (Default Open)</AccordionTrigger>
    <AccordionContent>This item is open by default.</AccordionContent>
  </AccordionItem>

  <AccordionItem value="item-3">
    <AccordionTrigger>Third Item</AccordionTrigger>
    <AccordionContent>Content 3</AccordionContent>
  </AccordionItem>
</Accordion>
```

### Controlled Accordion

Control accordion state with React:

```tsx
import { useState } from 'react'

function ControlledAccordion() {
  const [value, setValue] = useState<string>('item-1')

  return (
    <>
      <div className="mb-4">
        <p>Current open: {value || 'none'}</p>
        <Button onClick={() => setValue('item-2')}>
          Open Item 2
        </Button>
      </div>

      <Accordion type="single" value={value} onValueChange={setValue}>
        <AccordionItem value="item-1">
          <AccordionTrigger>Item 1</AccordionTrigger>
          <AccordionContent>Content 1</AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-2">
          <AccordionTrigger>Item 2</AccordionTrigger>
          <AccordionContent>Content 2</AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-3">
          <AccordionTrigger>Item 3</AccordionTrigger>
          <AccordionContent>Content 3</AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  )
}
```

### FAQ Accordion

Common FAQ pattern:

```tsx
<Accordion type="single" collapsible className="w-full">
  <AccordionItem value="shipping">
    <AccordionTrigger>What are your shipping options?</AccordionTrigger>
    <AccordionContent>
      We offer standard shipping (5-7 business days) and express shipping
      (2-3 business days). Free shipping on orders over $50.
    </AccordionContent>
  </AccordionItem>

  <AccordionItem value="returns">
    <AccordionTrigger>What is your return policy?</AccordionTrigger>
    <AccordionContent>
      We accept returns within 30 days of purchase. Items must be unused
      and in original packaging. Refunds are processed within 5-10 business days.
    </AccordionContent>
  </AccordionItem>

  <AccordionItem value="warranty">
    <AccordionTrigger>Do you offer warranty?</AccordionTrigger>
    <AccordionContent>
      All products come with a 1-year manufacturer warranty covering defects
      in materials and workmanship. Extended warranties are available at checkout.
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

### With Rich Content

Accordion with complex content:

```tsx
<Accordion type="single" collapsible>
  <AccordionItem value="overview">
    <AccordionTrigger>Product Overview</AccordionTrigger>
    <AccordionContent>
      <div className="space-y-4">
        <img
          src="/product.jpg"
          alt="Product"
          className="rounded-lg"
        />
        <p>Detailed product description with images and formatting.</p>
        <ul className="list-disc list-inside">
          <li>Feature 1</li>
          <li>Feature 2</li>
          <li>Feature 3</li>
        </ul>
      </div>
    </AccordionContent>
  </AccordionItem>

  <AccordionItem value="specs">
    <AccordionTrigger>Specifications</AccordionTrigger>
    <AccordionContent>
      <table className="w-full">
        <tbody>
          <tr>
            <td className="font-medium">Dimensions</td>
            <td>10 x 5 x 2 inches</td>
          </tr>
          <tr>
            <td className="font-medium">Weight</td>
            <td>1.5 lbs</td>
          </tr>
          <tr>
            <td className="font-medium">Material</td>
            <td>Aluminum</td>
          </tr>
        </tbody>
      </table>
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

### Disabled Item

Accordion with disabled items:

```tsx
<Accordion type="single" collapsible>
  <AccordionItem value="item-1">
    <AccordionTrigger>Available Item</AccordionTrigger>
    <AccordionContent>This item is clickable.</AccordionContent>
  </AccordionItem>

  <AccordionItem value="item-2" disabled>
    <AccordionTrigger>Disabled Item</AccordionTrigger>
    <AccordionContent>This content won't show.</AccordionContent>
  </AccordionItem>

  <AccordionItem value="item-3">
    <AccordionTrigger>Another Available Item</AccordionTrigger>
    <AccordionContent>This item is also clickable.</AccordionContent>
  </AccordionItem>
</Accordion>
```

### Nested Accordion

Accordion within accordion:

```tsx
<Accordion type="single" collapsible>
  <AccordionItem value="parent-1">
    <AccordionTrigger>Parent Item 1</AccordionTrigger>
    <AccordionContent>
      <Accordion type="single" collapsible>
        <AccordionItem value="child-1">
          <AccordionTrigger>Child Item 1</AccordionTrigger>
          <AccordionContent>Nested content 1</AccordionContent>
        </AccordionItem>
        <AccordionItem value="child-2">
          <AccordionTrigger>Child Item 2</AccordionTrigger>
          <AccordionContent>Nested content 2</AccordionContent>
        </AccordionItem>
      </Accordion>
    </AccordionContent>
  </AccordionItem>

  <AccordionItem value="parent-2">
    <AccordionTrigger>Parent Item 2</AccordionTrigger>
    <AccordionContent>Regular content</AccordionContent>
  </AccordionItem>
</Accordion>
```

## API Reference

### Accordion

Root accordion component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `"single" \| "multiple"` | - | Whether one or multiple items can be open (required) |
| `collapsible` | `boolean` | - | Allow all items to close (type="single" only) |
| `defaultValue` | `string \| string[]` | - | Default open item(s) |
| `value` | `string \| string[]` | - | Controlled open item(s) |
| `onValueChange` | `(value) => void` | - | Callback when value changes |
| `disabled` | `boolean` | `false` | Disable all items |
| `className` | `string` | - | Additional CSS classes |

Extends all Radix UI Accordion.Root props.

### AccordionItem

Individual accordion item.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Unique identifier (required) |
| `disabled` | `boolean` | `false` | Disable this item |
| `className` | `string` | - | Additional CSS classes |

Extends all Radix UI Accordion.Item props.

### AccordionTrigger

Clickable trigger button.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all Radix UI Accordion.Trigger and button attributes.

### AccordionContent

Collapsible content panel.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all Radix UI Accordion.Content and div attributes.

### Data Attributes

- `data-slot="accordion"` - Root element
- `data-slot="accordion-item"` - Item element
- `data-slot="accordion-trigger"` - Trigger button
- `data-slot="accordion-content"` - Content panel
- `data-state="open|closed"` - Current item state
- `data-disabled` - Present when disabled

## Accessibility

Accordion follows WAI-ARIA accordion pattern:

### Keyboard Interactions

- **Tab** - Move focus to next trigger
- **Shift + Tab** - Move focus to previous trigger
- **Enter** or **Space** - Toggle focused item
- **Home** - Focus first trigger
- **End** - Focus last trigger
- **Arrow Down** - Focus next trigger
- **Arrow Up** - Focus previous trigger

### Screen Reader Support

- Proper ARIA roles (`region`, `button`)
- `aria-expanded` indicates open/closed state
- `aria-controls` links trigger to content
- `aria-labelledby` labels content region

### Focus Management

- Visible focus indicators
- Focus remains on trigger after toggle
- Keyboard navigation between items

### Best Practices

::: tip
Use descriptive trigger text:
```tsx
{/* Good - clear question */}
<AccordionTrigger>What is your return policy?</AccordionTrigger>

{/* Bad - vague */}
<AccordionTrigger>Click here</AccordionTrigger>
```
:::

::: tip
Group related items together:
```tsx
{/* Good - logical grouping */}
<Accordion type="single" collapsible>
  <AccordionItem value="shipping">
    <AccordionTrigger>Shipping</AccordionTrigger>
    {/* ... */}
  </AccordionItem>
  <AccordionItem value="returns">
    <AccordionTrigger>Returns</AccordionTrigger>
    {/* ... */}
  </AccordionItem>
</Accordion>
```
:::

## Styling

### CSS Variables

Accordion uses semantic color tokens:

```css
--foreground         /* Trigger text */
--muted-foreground   /* Chevron icon */
--border             /* Item borders */
```

### Animations

Built-in smooth animations:
- **accordion-down**: Content slides down when opening
- **accordion-up**: Content slides up when closing
- Chevron rotates 180deg when open

### Component Structure

- **AccordionItem**: Border-bottom on each item
- **AccordionTrigger**: Full-width button with hover effect, chevron auto-rotates
- **AccordionContent**: Overflow hidden with smooth height animation

### Customization

```tsx
{/* Remove borders */}
<AccordionItem className="border-none">
  {/* ... */}
</AccordionItem>

{/* Custom trigger styling */}
<AccordionTrigger className="text-lg font-bold">
  Custom Trigger
</AccordionTrigger>

{/* Custom content padding */}
<AccordionContent className="px-8 py-6">
  Custom spacing content
</AccordionContent>
```

### Dark Mode

- Automatically adapts using CSS variables
- Border colors adjust for proper contrast
- Hover states maintain visibility

## Common Patterns

### Settings Accordion

```tsx
function SettingsAccordion() {
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="account">
        <AccordionTrigger>Account Settings</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" />
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input id="username" />
            </div>
            <Button>Save Changes</Button>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="privacy">
        <AccordionTrigger>Privacy Settings</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="public-profile">Public Profile</Label>
              <Switch id="public-profile" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show-email">Show Email</Label>
              <Switch id="show-email" />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
```

### Product Details Accordion

```tsx
function ProductDetails({ product }: { product: Product }) {
  return (
    <Accordion type="multiple" defaultValue={['description']} className="w-full">
      <AccordionItem value="description">
        <AccordionTrigger>Description</AccordionTrigger>
        <AccordionContent>
          <p>{product.description}</p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="specifications">
        <AccordionTrigger>Specifications</AccordionTrigger>
        <AccordionContent>
          <dl className="space-y-2">
            {product.specs.map(spec => (
              <div key={spec.name} className="flex justify-between">
                <dt className="font-medium">{spec.name}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="reviews">
        <AccordionTrigger>
          Reviews ({product.reviews.length})
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            {product.reviews.map(review => (
              <div key={review.id} className="border-b pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">{review.author}</span>
                  <span className="text-sm text-muted-foreground">
                    {review.date}
                  </span>
                </div>
                <p>{review.content}</p>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
```

## Related Components

- [Collapsible](/components/collapsible) - Simpler single-item collapse
- [Tabs](/components/tabs) - Alternative content organization
- [Card](/components/card) - For non-collapsible content sections
