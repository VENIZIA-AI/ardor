# Alert

Displays a callout for user attention with optional icon, title, and description. Built with semantic HTML and accessible ARIA attributes.

## Installation

```bash
bunx shadcn@latest add alert
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Alert, AlertTitle, AlertDescription } from '@venizia/ardor-admin'

export default function Example() {
  return (
    <Alert>
      <AlertTitle>Heads up!</AlertTitle>
      <AlertDescription>
        You can add components to your app using the cli.
      </AlertDescription>
    </Alert>
  )
}
```

## Examples

### Basic Alert

A simple informational alert:

```tsx
<Alert>
  <AlertTitle>Information</AlertTitle>
  <AlertDescription>
    This is a basic alert with a title and description.
  </AlertDescription>
</Alert>
```

### With Icon

Add an icon for visual context:

```tsx
import { Terminal } from 'lucide-react'

<Alert>
  <Terminal />
  <AlertTitle>Terminal access required</AlertTitle>
  <AlertDescription>
    You need terminal access to run this command.
  </AlertDescription>
</Alert>
```

### Destructive Variant

For errors or destructive actions:

```tsx
import { AlertCircle } from 'lucide-react'

<Alert variant="destructive">
  <AlertCircle />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    Your session has expired. Please log in again.
  </AlertDescription>
</Alert>
```

### Title Only

Alert with just a title:

```tsx
import { Info } from 'lucide-react'

<Alert>
  <Info />
  <AlertTitle>This is a title-only alert</AlertTitle>
</Alert>
```

### Description Only

Alert with just a description:

```tsx
import { CheckCircle2 } from 'lucide-react'

<Alert>
  <CheckCircle2 />
  <AlertDescription>
    Your changes have been saved successfully.
  </AlertDescription>
</Alert>
```

### Multiple Paragraphs

Alert with rich content:

```tsx
import { Lightbulb } from 'lucide-react'

<Alert>
  <Lightbulb />
  <AlertTitle>Pro Tip</AlertTitle>
  <AlertDescription>
    <p>You can use keyboard shortcuts to work faster.</p>
    <p className="mt-2">
      Press <kbd>Ctrl+K</kbd> to open the command palette.
    </p>
  </AlertDescription>
</Alert>
```

### With Action Button

Alert with a call-to-action:

```tsx
import { AlertTriangle } from 'lucide-react'
import { Button } from '@venizia/ardor-admin'

<Alert variant="destructive">
  <AlertTriangle />
  <AlertTitle>Action Required</AlertTitle>
  <AlertDescription className="flex items-center justify-between">
    <span>Your payment method needs to be updated.</span>
    <Button variant="outline" size="sm">Update</Button>
  </AlertDescription>
</Alert>
```

### Dismissible Alert

Create a closeable alert:

```tsx
import { useState } from 'react'
import { X, Info } from 'lucide-react'

function DismissibleAlert() {
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  return (
    <Alert>
      <Info />
      <AlertTitle>New feature available</AlertTitle>
      <AlertDescription>
        Check out our new dashboard analytics.
      </AlertDescription>
      <button
        onClick={() => setVisible(false)}
        className="absolute right-2 top-2 rounded-md p-1 hover:bg-muted"
        aria-label="Close alert"
      >
        <X className="h-4 w-4" />
      </button>
    </Alert>
  )
}
```

### Stacked Alerts

Multiple alerts in a stack:

```tsx
import { Info, AlertCircle, CheckCircle2 } from 'lucide-react'

<div className="space-y-4">
  <Alert>
    <Info />
    <AlertTitle>Information</AlertTitle>
    <AlertDescription>
      This is an informational message.
    </AlertDescription>
  </Alert>

  <Alert variant="destructive">
    <AlertCircle />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>
      Something went wrong with your request.
    </AlertDescription>
  </Alert>

  <Alert>
    <CheckCircle2 />
    <AlertTitle>Success</AlertTitle>
    <AlertDescription>
      Your changes have been saved.
    </AlertDescription>
  </Alert>
</div>
```

## API Reference

### Alert

Root alert container component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"default" \| "destructive"` | `"default"` | Visual style variant |
| `className` | `string` | - | Additional CSS classes |

Extends all HTML div attributes.

### AlertTitle

Title/heading for the alert.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML div attributes.

### AlertDescription

Content/description area of the alert.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all HTML div attributes.

### Data Attributes

The Alert component uses these data attributes for styling:

- `data-slot="alert"` - Applied to root element
- `data-slot="alert-title"` - Applied to title element
- `data-slot="alert-description"` - Applied to description element

## Accessibility

The Alert component follows accessibility best practices:

### ARIA Attributes

- Root element has `role="alert"` for screen reader announcements
- Alert content is announced when rendered
- Screen readers prioritize alert messages

### Visual Indicators

- Clear color coding for different variants
- Icons provide visual context
- Destructive variant uses red tones for errors

### Best Practices

::: tip
Always provide clear, actionable information:
```tsx
{/* Good */}
<AlertDescription>
  Your session will expire in 5 minutes. Save your work.
</AlertDescription>

{/* Bad */}
<AlertDescription>
  Error occurred.
</AlertDescription>
```
:::

::: tip
Use appropriate icons that match the alert purpose:
```tsx
<Alert variant="destructive">
  <AlertCircle /> {/* Error icon */}
  <AlertTitle>Error</AlertTitle>
</Alert>
```
:::

::: warning
Don't overuse alerts - they can create alert fatigue:
```tsx
{/* Use alerts sparingly for important information */}
{/* Consider using less prominent UI for routine messages */}
```
:::

## Styling

### CSS Variables

The Alert component uses these CSS variables:

```css
--card             /* Background color */
--card-foreground  /* Text color */
--destructive      /* Destructive variant color */
--muted-foreground /* Description text color */
```

### Variants

**Default**:
- Card background with card foreground text
- Neutral, informational styling
- Suitable for general notifications

**Destructive**:
- Red/destructive text color
- Card background maintained
- Icon and title use destructive color
- Description has slightly transparent destructive color

### Grid Layout

The alert uses CSS Grid with intelligent column adjustment:
- **Without icon**: Single column layout
- **With icon**: Two-column layout with icon in first column
- Icon is automatically detected via `has-[>svg]` selector
- Content aligns properly with or without icon

### Customization

Override styles using className:

```tsx
<Alert className="border-blue-600 bg-blue-50 dark:bg-blue-950">
  <AlertTitle className="text-blue-900 dark:text-blue-100">
    Custom styled alert
  </AlertTitle>
  <AlertDescription className="text-blue-700 dark:text-blue-300">
    With custom colors
  </AlertDescription>
</Alert>
```

### Dark Mode Support

Alerts automatically adapt to dark mode through CSS variable inheritance.

## Common Patterns

### Success Notification

```tsx
import { CheckCircle2 } from 'lucide-react'

function SuccessAlert() {
  return (
    <Alert className="border-green-600 bg-green-50 dark:bg-green-950">
      <CheckCircle2 className="text-green-600" />
      <AlertTitle className="text-green-900 dark:text-green-100">
        Success
      </AlertTitle>
      <AlertDescription className="text-green-700 dark:text-green-300">
        Your profile has been updated successfully.
      </AlertDescription>
    </Alert>
  )
}
```

### Warning Alert

```tsx
import { AlertTriangle } from 'lucide-react'

function WarningAlert() {
  return (
    <Alert className="border-yellow-600 bg-yellow-50 dark:bg-yellow-950">
      <AlertTriangle className="text-yellow-600" />
      <AlertTitle className="text-yellow-900 dark:text-yellow-100">
        Warning
      </AlertTitle>
      <AlertDescription className="text-yellow-700 dark:text-yellow-300">
        Your storage is almost full. Consider upgrading your plan.
      </AlertDescription>
    </Alert>
  )
}
```

### Alert with Links

```tsx
import { Info } from 'lucide-react'

<Alert>
  <Info />
  <AlertTitle>Update available</AlertTitle>
  <AlertDescription>
    A new version is available.{' '}
    <a href="/updates" className="underline font-medium">
      View release notes
    </a>
  </AlertDescription>
</Alert>
```

### Form Validation Alert

```tsx
import { useState } from 'react'
import { AlertCircle } from 'lucide-react'

function FormWithAlert() {
  const [errors, setErrors] = useState<string[]>([])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validationErrors = []

    // Validation logic...
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Validation failed</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {/* Form fields */}
    </form>
  )
}
```

### Timed Auto-Dismiss Alert

```tsx
import { useState, useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'

function AutoDismissAlert() {
  const [show, setShow] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false)
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  if (!show) return null

  return (
    <Alert>
      <CheckCircle2 />
      <AlertTitle>Changes saved</AlertTitle>
      <AlertDescription>
        Your changes have been saved automatically.
      </AlertDescription>
    </Alert>
  )
}
```

### Alert List Component

```tsx
import { Info, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'

type AlertType = 'info' | 'error' | 'success' | 'warning'

interface AlertMessage {
  id: string
  type: AlertType
  title: string
  message: string
}

const iconMap = {
  info: Info,
  error: AlertCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
}

function AlertList({ alerts }: { alerts: AlertMessage[] }) {
  return (
    <div className="space-y-4">
      {alerts.map((alert) => {
        const Icon = iconMap[alert.type]
        return (
          <Alert
            key={alert.id}
            variant={alert.type === 'error' ? 'destructive' : 'default'}
          >
            <Icon />
            <AlertTitle>{alert.title}</AlertTitle>
            <AlertDescription>{alert.message}</AlertDescription>
          </Alert>
        )
      })}
    </div>
  )
}
```

## Related Components

- [Alert Dialog](/components/alert-dialog) - Modal dialog for confirmations
- [Toast/Sonner](/components/sonner) - Temporary toast notifications
- [Badge](/components/badge) - Inline status indicators
- [Card](/components/card) - General content containers
- [Dialog](/components/dialog) - Modal overlays
