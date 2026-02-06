# Textarea

A multi-line text input control for longer form entries. Built with native HTML textarea element with enhanced styling and functionality.

## Installation

```bash
bunx shadcn@latest add textarea
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Textarea } from '@venizia/ardor-admin'

export default function Example() {
  return <Textarea placeholder="Type your message here..." />
}
```

## Examples

### Basic Textarea

A simple textarea with placeholder:

```tsx
<Textarea placeholder="Enter your comment..." />
```

### With Label

Combine with Label for proper form accessibility:

```tsx
import { Label, Textarea } from '@venizia/ardor-admin'

<div className="space-y-2">
  <Label htmlFor="message">Message</Label>
  <Textarea id="message" placeholder="Type your message..." />
</div>
```

### Controlled Textarea

Control the textarea value with React state:

```tsx
import { useState } from 'react'
import { Textarea } from '@venizia/ardor-admin'

function ControlledTextarea() {
  const [value, setValue] = useState('')

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Start typing..."
      />
      <p className="text-sm text-muted-foreground">
        Characters: {value.length}
      </p>
    </div>
  )
}
```

### With Character Counter

Add a character counter with maximum length:

```tsx
import { useState } from 'react'

function TextareaWithCounter() {
  const [value, setValue] = useState('')
  const maxLength = 200

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={maxLength}
        placeholder="Write a bio (max 200 characters)..."
      />
      <div className="flex justify-end">
        <span className="text-xs text-muted-foreground">
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  )
}
```

### Disabled State

Disable textarea to prevent user input:

```tsx
<Textarea disabled placeholder="This textarea is disabled" />
```

### With Validation

Show validation errors and success states:

```tsx
import { useState } from 'react'
import { Label, Textarea } from '@venizia/ardor-admin'

function TextareaWithValidation() {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const validate = (text: string) => {
    if (!text.trim()) {
      setError('This field is required')
    } else if (text.length < 10) {
      setError('Must be at least 10 characters')
    } else {
      setError('')
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="description">
        Description <span className="text-destructive">*</span>
      </Label>
      <Textarea
        id="description"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => validate(value)}
        aria-invalid={!!error}
        aria-describedby={error ? 'description-error' : undefined}
        placeholder="Enter a detailed description..."
      />
      {error && (
        <p id="description-error" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
```

### Fixed Height

Set a specific height for the textarea:

```tsx
<Textarea
  className="h-32 resize-none"
  placeholder="Fixed height textarea..."
/>
```

### Auto-Growing Textarea

Textarea that grows with content (using field-sizing-content):

```tsx
<Textarea
  className="min-h-20 max-h-96"
  placeholder="This textarea grows with your content..."
/>
```

### Custom Resize Behavior

Control resize behavior:

```tsx
<div className="space-y-4">
  <div className="space-y-2">
    <Label>Resize Vertical Only</Label>
    <Textarea
      className="resize-y"
      placeholder="Can only resize vertically..."
    />
  </div>
  <div className="space-y-2">
    <Label>Resize Horizontal Only</Label>
    <Textarea
      className="resize-x"
      placeholder="Can only resize horizontally..."
    />
  </div>
  <div className="space-y-2">
    <Label>No Resize</Label>
    <Textarea
      className="resize-none"
      placeholder="Cannot be resized..."
    />
  </div>
</div>
```

### With Helper Text

Add descriptive helper text below textarea:

```tsx
<div className="space-y-2">
  <Label htmlFor="feedback">Feedback</Label>
  <Textarea
    id="feedback"
    placeholder="Share your thoughts..."
  />
  <p className="text-xs text-muted-foreground">
    Your feedback helps us improve our service
  </p>
</div>
```

## API Reference

### Textarea

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Controlled value |
| `defaultValue` | `string` | - | Uncontrolled default value |
| `onChange` | `(e: React.ChangeEvent<HTMLTextAreaElement>) => void` | - | Change event handler |
| `placeholder` | `string` | - | Placeholder text |
| `disabled` | `boolean` | `false` | Whether textarea is disabled |
| `required` | `boolean` | `false` | Whether textarea is required |
| `readOnly` | `boolean` | `false` | Whether textarea is read-only |
| `rows` | `number` | - | Number of visible text lines |
| `maxLength` | `number` | - | Maximum character length |
| `minLength` | `number` | - | Minimum character length |
| `name` | `string` | - | Name attribute for form submission |
| `id` | `string` | - | ID for label association |
| `className` | `string` | - | Additional CSS classes |
| `aria-invalid` | `boolean` | - | Indicates validation error |
| `aria-describedby` | `string` | - | ID of element describing the textarea |

Extends all HTML textarea attributes.

### Data Attributes

The Textarea component uses these data attributes for styling:

- `data-slot="textarea"` - Applied to textarea element

## Accessibility

The Textarea component follows WAI-ARIA form input patterns:

### Keyboard Interactions

- **Tab** - Moves focus to/from textarea
- **Enter** - Creates new line (default textarea behavior)
- **Ctrl/Cmd + Enter** - Often used for form submission (custom implementation)
- **All standard text editing shortcuts** - Cut, copy, paste, select all, etc.

### Screen Reader Support

- Native `<textarea>` semantics
- Works with `aria-label` or associated `<label>`
- Error states announced via `aria-invalid` and `aria-describedby`
- Character limit announced when using `maxLength`
- Required state indicated with `required` attribute

### Focus Management

- Visible focus ring via `focus-visible:ring-[3px]`
- Focus indicator uses theme's `--ring` color
- Keyboard-only focus (no focus on mouse click)

### Best Practices

::: tip
Always associate textareas with labels:
```tsx
<Label htmlFor="message">Message</Label>
<Textarea id="message" />
```
:::

::: tip
Use `aria-describedby` for error messages and helper text:
```tsx
<Textarea
  aria-invalid={!!error}
  aria-describedby="textarea-error textarea-hint"
/>
<p id="textarea-hint">Helpful description</p>
{error && <p id="textarea-error">{error}</p>}
```
:::

::: warning
When using character counters, ensure they're announced to screen readers:
```tsx
<div aria-live="polite" aria-atomic="true">
  {value.length}/{maxLength} characters
</div>
```
:::

## Styling

### CSS Variables

The Textarea component uses these CSS variables from your theme:

```css
--input              /* Border color */
--ring               /* Focus ring color */
--muted-foreground   /* Placeholder text color */
--destructive        /* Invalid state color */
```

### Visual States

The textarea has distinct visual states:

- **Default**: Border with transparent background
- **Focus**: 3px ring with primary color
- **Hover**: Slightly darker background in dark mode
- **Disabled**: Reduced opacity, no interaction
- **Invalid**: Destructive border and ring colors
- **Dark Mode**: Darker background (`dark:bg-input/30`)

### Auto-Sizing

ARDOR textareas use modern CSS `field-sizing: content` for automatic height adjustment:

```css
field-sizing-content  /* Automatically grows with content */
min-h-16              /* Minimum height: 4rem (64px) */
```

### Customization

Override styles using className:

```tsx
<Textarea
  className="min-h-32 max-h-96 resize-vertical bg-blue-50 dark:bg-blue-950"
/>
```

### Dark Mode Support

The textarea automatically adapts to dark mode:
- Darker background for better contrast: `dark:bg-input/30`
- Proper text and border colors
- Maintained readability in both modes

## Common Patterns

### Comment Form

Complete comment form with textarea:

```tsx
import { useState } from 'react'
import { Label, Textarea, Button } from '@venizia/ardor-admin'

function CommentForm() {
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    // Submit comment...
    await new Promise(resolve => setTimeout(resolve, 1000))
    setComment('')
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="comment">Add a comment</Label>
        <Textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your thoughts..."
          required
          minLength={3}
        />
      </div>
      <Button type="submit" disabled={submitting || comment.length < 3}>
        {submitting ? 'Posting...' : 'Post Comment'}
      </Button>
    </form>
  )
}
```

### Rich Text Alternative

Simple textarea with formatting hints:

```tsx
import { useState } from 'react'
import { Textarea } from '@venizia/ardor-admin'

function FormattingTextarea() {
  const [value, setValue] = useState('')

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="**bold** _italic_ `code`"
        className="font-mono text-sm"
      />
      <div className="flex gap-2 text-xs text-muted-foreground">
        <span>**bold**</span>
        <span>_italic_</span>
        <span>`code`</span>
      </div>
    </div>
  )
}
```

### Message Composer with Actions

Textarea with keyboard shortcuts and actions:

```tsx
import { useState } from 'react'
import { Textarea, Button } from '@venizia/ardor-admin'
import { Send, Paperclip } from 'lucide-react'

function MessageComposer() {
  const [message, setMessage] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    if (message.trim()) {
      console.log('Sending:', message)
      setMessage('')
    }
  }

  return (
    <div className="space-y-2 border rounded-lg p-4">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message... (Ctrl+Enter to send)"
        className="resize-none border-0 focus-visible:ring-0 p-0"
      />
      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm">
          <Paperclip className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Ctrl+Enter to send
          </span>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!message.trim()}
          >
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
```

### Feedback Form

Multi-field form with textarea:

```tsx
import { useState } from 'react'
import { Label, Input, Textarea, Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@venizia/ardor-admin'

function FeedbackForm() {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    feedback: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Feedback submitted:', formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData({ ...formData, category: value })}
        >
          <SelectTrigger id="category">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bug">Bug Report</SelectItem>
            <SelectItem value="feature">Feature Request</SelectItem>
            <SelectItem value="general">General Feedback</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="feedback">Feedback</Label>
        <Textarea
          id="feedback"
          value={formData.feedback}
          onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
          placeholder="Share your detailed feedback..."
          className="min-h-32"
          required
        />
      </div>

      <Button type="submit" className="w-full">
        Submit Feedback
      </Button>
    </form>
  )
}
```

## Related Components

- [Input](/components/input) - Single-line text input
- [Label](/components/label) - Accessible form labels
- [Field](/components/field) - Complete form field wrapper
- [Button](/components/button) - Form submission buttons
- [Select](/components/select) - Dropdown selections in forms
