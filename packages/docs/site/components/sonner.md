# Sonner (Toast)

An opinionated toast notification component powered by Sonner. Provides elegant toast notifications with automatic theming and customization.

## Installation

```bash
bunx shadcn@latest add sonner
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

First, add the Toaster component to your app root:

```tsx
import { Toaster } from '@venizia/ardor-admin'

export default function App() {
  return (
    <>
      {/* Your app content */}
      <Toaster />
    </>
  )
}
```

Then use toast notifications anywhere:

```tsx
import { toast } from 'sonner'

function Example() {
  return (
    <Button onClick={() => toast('Hello World')}>
      Show Toast
    </Button>
  )
}
```

## Examples

### Basic Toast

Simple text notification:

```tsx
import { toast } from 'sonner'

<Button onClick={() => toast('Event has been created')}>
  Show Toast
</Button>
```

### Toast Variants

Different toast types:

```tsx
import { toast } from 'sonner'

// Success
<Button onClick={() => toast.success('Changes saved successfully')}>
  Success Toast
</Button>

// Error
<Button onClick={() => toast.error('Something went wrong')}>
  Error Toast
</Button>

// Info
<Button onClick={() => toast.info('New update available')}>
  Info Toast
</Button>

// Warning
<Button onClick={() => toast.warning('Storage almost full')}>
  Warning Toast
</Button>
```

### With Description

Toast with additional description:

```tsx
<Button
  onClick={() =>
    toast('Event created', {
      description: 'Monday, January 3rd at 6:00pm',
    })
  }
>
  Show Toast with Description
</Button>
```

### With Action Button

Toast with interactive action:

```tsx
<Button
  onClick={() =>
    toast('Event created', {
      action: {
        label: 'Undo',
        onClick: () => console.log('Undo'),
      },
    })
  }
>
  Show Toast with Action
</Button>
```

### Promise Toast

Show loading, success, or error based on promise:

```tsx
<Button
  onClick={() =>
    toast.promise(
      fetch('/api/data').then(res => res.json()),
      {
        loading: 'Loading data...',
        success: 'Data loaded successfully',
        error: 'Failed to load data',
      }
    )
  }
>
  Promise Toast
</Button>
```

### Custom Duration

Control how long toast is visible:

```tsx
<Button
  onClick={() =>
    toast('This will disappear in 10 seconds', {
      duration: 10000,
    })
  }
>
  Long Duration Toast
</Button>
```

### Persistent Toast

Toast that stays until manually dismissed:

```tsx
<Button
  onClick={() =>
    toast('This toast persists', {
      duration: Infinity,
    })
  }
>
  Persistent Toast
</Button>
```

### Rich Content Toast

Toast with custom JSX content:

```tsx
<Button
  onClick={() =>
    toast(
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarImage src="/avatar.jpg" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">John Doe</p>
          <p className="text-sm text-muted-foreground">
            Sent you a message
          </p>
        </div>
      </div>
    )
  }
>
  Rich Content Toast
</Button>
```

### Dismiss Toasts

Programmatically dismiss toasts:

```tsx
import { toast } from 'sonner'

function DismissExample() {
  const handleCreateAndDismiss = () => {
    const toastId = toast('Processing...')

    setTimeout(() => {
      toast.dismiss(toastId)
    }, 2000)
  }

  return (
    <div className="flex gap-2">
      <Button onClick={handleCreateAndDismiss}>
        Auto Dismiss
      </Button>
      <Button onClick={() => toast.dismiss()}>
        Dismiss All
      </Button>
    </div>
  )
}
```

### Loading Toast

Show loading state that updates:

```tsx
function LoadingExample() {
  const handleUpload = async () => {
    const toastId = toast.loading('Uploading...')

    try {
      await uploadFile()
      toast.success('Upload complete', { id: toastId })
    } catch (error) {
      toast.error('Upload failed', { id: toastId })
    }
  }

  return <Button onClick={handleUpload}>Upload File</Button>
}
```

## API Reference

### Toaster Component

Place once in your app root.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `theme` | `"light" \| "dark" \| "system"` | `"system"` | Theme mode (auto-detected from next-themes) |
| `position` | `"top-left" \| "top-center" \| "top-right" \| "bottom-left" \| "bottom-center" \| "bottom-right"` | `"bottom-right"` | Toast position |
| `expand` | `boolean` | `false` | Expand toasts by default |
| `richColors` | `boolean` | `false` | Use rich colors for variants |
| `closeButton` | `boolean` | `false` | Show close button on all toasts |

### toast() Function

Create a toast notification.

```tsx
toast(message, options?)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | `string \| ReactNode` | Toast content |
| `options` | `ToastOptions` | Configuration options |

### Toast Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `description` | `string \| ReactNode` | - | Additional description |
| `duration` | `number` | `4000` | Duration in milliseconds |
| `action` | `{ label: string, onClick: () => void }` | - | Action button |
| `cancel` | `{ label: string, onClick: () => void }` | - | Cancel button |
| `id` | `string \| number` | - | Custom toast ID |
| `important` | `boolean` | `false` | Makes toast stay until dismissed |
| `onDismiss` | `(toast: Toast) => void` | - | Callback when dismissed |
| `onAutoClose` | `(toast: Toast) => void` | - | Callback when auto-closed |

### Toast Methods

```tsx
// Basic variants
toast(message, options?)
toast.success(message, options?)
toast.error(message, options?)
toast.info(message, options?)
toast.warning(message, options?)
toast.loading(message, options?)

// Promise handling
toast.promise(promise, {
  loading: string | ReactNode,
  success: string | ReactNode | ((data) => ReactNode),
  error: string | ReactNode | ((error) => ReactNode),
})

// Utilities
toast.dismiss(id?) // Dismiss specific or all toasts
toast.message(message, options?) // Custom toast
```

## Accessibility

Toast notifications follow accessibility best practices:

### Screen Reader Support

- Toasts are announced via ARIA live regions
- Success/error states communicated clearly
- Action buttons are keyboard accessible

### Keyboard Interactions

- **Tab** - Focus action buttons
- **Enter/Space** - Activate focused button
- **Escape** - Dismiss focused toast

### Focus Management

- Focus not stolen from main content
- Action buttons are keyboard accessible
- Toast can be dismissed via keyboard

### Best Practices

::: tip
Keep toast messages concise and actionable:
```tsx
// Good
toast.success('File uploaded')

// Bad - too verbose
toast('The file has been successfully uploaded to the server and is now available for download')
```
:::

::: warning
Don't use toasts for critical information:
```tsx
// Bad - use Dialog instead for critical actions
toast.error('Your account will be deleted')

// Good - toasts for transient info
toast.success('Settings saved')
```
:::

## Styling

### CSS Variables

The Toaster automatically uses your theme colors:

```css
--background        /* Toast background */
--foreground        /* Toast text */
--muted-foreground  /* Description text */
--primary           /* Action button background */
--primary-foreground /* Action button text */
--border            /* Toast border */
```

### Theme Integration

ARDOR's Toaster integrates with next-themes:
- Automatically detects light/dark mode
- Uses theme CSS variables
- Seamless dark mode support

### Custom Styling

Customize via className in toast options:

```tsx
toast('Custom styled', {
  className: 'bg-blue-500 text-white',
})
```

## Common Patterns

### Form Submission Toast

```tsx
async function handleSubmit(data: FormData) {
  const toastId = toast.loading('Saving changes...')

  try {
    await saveData(data)
    toast.success('Changes saved successfully', { id: toastId })
  } catch (error) {
    toast.error('Failed to save changes', {
      id: toastId,
      description: error.message,
    })
  }
}
```

### Undo Toast

```tsx
function handleDelete(id: string) {
  // Optimistic delete
  removeItemFromUI(id)

  toast('Item deleted', {
    action: {
      label: 'Undo',
      onClick: () => restoreItem(id),
    },
  })
}
```

### Multi-Step Process Toast

```tsx
async function handleMultiStepProcess() {
  const steps = [
    { message: 'Validating data...', action: validateData },
    { message: 'Uploading files...', action: uploadFiles },
    { message: 'Processing...', action: processData },
  ]

  const toastId = toast.loading(steps[0].message)

  for (let i = 0; i < steps.length; i++) {
    toast.loading(steps[i].message, { id: toastId })
    await steps[i].action()
  }

  toast.success('Process complete!', { id: toastId })
}
```

### API Error Toast

```tsx
async function fetchData() {
  try {
    const response = await fetch('/api/data')
    if (!response.ok) throw new Error('Failed to fetch')

    const data = await response.json()
    toast.success('Data loaded')
    return data
  } catch (error) {
    toast.error('Failed to load data', {
      description: 'Please try again later',
      action: {
        label: 'Retry',
        onClick: () => fetchData(),
      },
    })
  }
}
```

### File Upload Toast

```tsx
async function handleFileUpload(file: File) {
  const toastId = toast.loading('Uploading file...')

  try {
    await uploadFile(file)

    toast.success('Upload complete', {
      id: toastId,
      description: file.name,
      action: {
        label: 'View',
        onClick: () => window.open(`/files/${file.name}`),
      },
    })
  } catch (error) {
    toast.error('Upload failed', {
      id: toastId,
      description: 'Please try again',
    })
  }
}
```

### Batch Operation Toast

```tsx
async function handleBatchDelete(ids: string[]) {
  const count = ids.length
  const toastId = toast.loading(`Deleting ${count} items...`)

  try {
    await Promise.all(ids.map(id => deleteItem(id)))

    toast.success(`${count} items deleted`, {
      id: toastId,
      action: {
        label: 'Undo',
        onClick: () => restoreItems(ids),
      },
    })
  } catch (error) {
    toast.error('Some items failed to delete', {
      id: toastId,
      description: 'Please try again',
    })
  }
}
```

### Network Status Toast

```tsx
function useNetworkStatus() {
  useEffect(() => {
    const handleOnline = () => {
      toast.success('Back online', {
        description: 'Your connection has been restored',
      })
    }

    const handleOffline = () => {
      toast.error('Connection lost', {
        description: 'Please check your internet connection',
        duration: Infinity,
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
}
```

## Related Components

- [Alert](/components/alert) - For persistent in-page notifications
- [Alert Dialog](/components/alert-dialog) - For critical confirmations
- [Dialog](/components/dialog) - For more complex notifications
