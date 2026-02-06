# Alert Dialog

A modal dialog that interrupts the user with important content and expects a response. Built on Radix UI Alert Dialog primitive with accessible focus management.

## Installation

```bash
bunx shadcn@latest add alert-dialog
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@venizia/ardor-admin'

export default function Example() {
  return (
    <AlertDialog>
      <AlertDialogTrigger>Delete Account</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your account
            and remove your data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

## Examples

### Basic Alert Dialog

Simple confirmation dialog:

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="outline">Show Dialog</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Confirm action</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to proceed?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction>Confirm</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Destructive Action

Dialog for destructive operations:

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete file permanently?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently delete "document.pdf". This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Controlled Alert Dialog

Control dialog state programmatically:

```tsx
import { useState } from 'react'

function ControlledAlertDialog() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Dialog</Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Controlled Dialog</AlertDialogTitle>
            <AlertDialogDescription>
              This dialog's state is controlled by React state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

### With Custom Actions

Add custom action handlers:

```tsx
import { useState } from 'react'

function DeleteItemDialog() {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteItem()
      toast.success('Item deleted successfully')
    } catch (error) {
      toast.error('Failed to delete item')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete Item</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this item?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the item from your collection.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

### Without Trigger

Use without a built-in trigger:

```tsx
import { useState } from 'react'

function ExternalTrigger() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>External Trigger</Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Externally Triggered</AlertDialogTitle>
            <AlertDialogDescription>
              This dialog is triggered by an external button.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

### Multiple Actions

Dialog with more than two actions:

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button>Save Changes</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
      <AlertDialogDescription>
        You have unsaved changes. What would you like to do?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter className="flex-col sm:flex-col gap-2">
      <AlertDialogAction>Save and Close</AlertDialogAction>
      <AlertDialogAction variant="outline">
        Discard Changes
      </AlertDialogAction>
      <AlertDialogCancel>Continue Editing</AlertDialogCancel>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### With Icons

Add icons for visual emphasis:

```tsx
import { AlertTriangle } from 'lucide-react'

<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete Account</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <AlertDialogTitle>Delete account permanently?</AlertDialogTitle>
      </div>
      <AlertDialogDescription>
        This action cannot be undone. All your data will be permanently removed
        from our servers.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction className="bg-destructive text-destructive-foreground">
        Yes, delete my account
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### With Form Input

Dialog requiring user input:

```tsx
import { useState } from 'react'
import { Input, Label } from '@venizia/ardor-admin'

function ConfirmWithInput() {
  const [confirmText, setConfirmText] = useState('')
  const requiredText = 'DELETE'

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete Project</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete project?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the project and all its data.
            Type "DELETE" to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="confirm">Type DELETE to confirm</Label>
          <Input
            id="confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="mt-2"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmText('')}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={confirmText !== requiredText}
            className="bg-destructive text-destructive-foreground"
          >
            Delete Project
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

## API Reference

### AlertDialog

Root component that manages dialog state.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | - | Controlled open state |
| `defaultOpen` | `boolean` | - | Uncontrolled default open state |
| `onOpenChange` | `(open: boolean) => void` | - | Callback when open state changes |

### AlertDialogTrigger

Button that opens the dialog.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props into child element |

Extends all HTML button attributes.

### AlertDialogContent

The dialog content container.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `onEscapeKeyDown` | `(event: KeyboardEvent) => void` | - | Handler for Escape key |
| `onPointerDownOutside` | `(event: PointerDownOutsideEvent) => void` | - | Handler for clicks outside |

### AlertDialogHeader

Container for title and description.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### AlertDialogFooter

Container for action buttons.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### AlertDialogTitle

Dialog title heading.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### AlertDialogDescription

Descriptive text content.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### AlertDialogAction

Primary action button.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends Button component props and closes dialog on click.

### AlertDialogCancel

Cancel/close button.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends Button component props with outline variant and closes dialog on click.

### Data Attributes

- `data-slot="alert-dialog"` - Root element
- `data-slot="alert-dialog-trigger"` - Trigger button
- `data-slot="alert-dialog-overlay"` - Background overlay
- `data-slot="alert-dialog-content"` - Content container
- `data-slot="alert-dialog-header"` - Header section
- `data-slot="alert-dialog-title"` - Title element
- `data-slot="alert-dialog-description"` - Description text
- `data-slot="alert-dialog-footer"` - Footer section
- `data-state="open|closed"` - Current dialog state

## Accessibility

The Alert Dialog follows WAI-ARIA Dialog (Modal) patterns:

### Keyboard Interactions

- **Escape** - Closes the dialog
- **Tab** - Moves focus between interactive elements
- **Shift + Tab** - Moves focus backwards
- **Space/Enter** - Activates the focused button

### Screen Reader Support

- Dialog has `role="alertdialog"`
- Title linked via `aria-labelledby`
- Description linked via `aria-describedby`
- Focus trapped within dialog when open
- Focus returns to trigger on close
- Cancel button is focused by default

### Focus Management

- Focus automatically moves into dialog on open
- Focus trapped - cannot tab outside dialog
- Focus returns to trigger element on close
- Cancel action is focused first for safety

### Best Practices

::: tip
Always provide a clear title and description:
```tsx
<AlertDialogTitle>Delete account?</AlertDialogTitle>
<AlertDialogDescription>
  This action cannot be undone. Your data will be permanently deleted.
</AlertDialogDescription>
```
:::

::: warning
Use AlertDialog for actions requiring confirmation, not for general information:
```tsx
{/* Good: Requires user decision */}
<AlertDialog> {/* Destructive action */} </AlertDialog>

{/* Bad: Informational only */}
{/* Use regular Dialog instead */}
```
:::

::: tip
Place the safer action (Cancel) first in tab order:
```tsx
<AlertDialogFooter>
  <AlertDialogCancel>Cancel</AlertDialogCancel> {/* Focused first */}
  <AlertDialogAction>Delete</AlertDialogAction>
</AlertDialogFooter>
```
:::

## Styling

### CSS Variables

```css
--background        /* Dialog background */
--foreground        /* Text color */
--muted-foreground  /* Description text */
--destructive       /* Destructive action color */
```

### Animations

- **Overlay**: Fades in/out
- **Content**: Fades and zooms in/out
- **Duration**: 200ms for smooth transitions

### Responsive Layout

- **Mobile**: Vertical button stack, centered text
- **Desktop**: Horizontal buttons (right-aligned), left-aligned text
- **Max width**: Full width - 2rem on mobile, 512px on desktop

### Customization

```tsx
<AlertDialogContent className="max-w-md">
  <AlertDialogHeader className="text-left">
    <AlertDialogTitle className="text-xl">
      Custom Title
    </AlertDialogTitle>
  </AlertDialogHeader>
  <AlertDialogFooter className="flex-row justify-start">
    <AlertDialogAction className="bg-blue-600">
      Custom Action
    </AlertDialogAction>
    <AlertDialogCancel>Cancel</AlertDialogCancel>
  </AlertDialogFooter>
</AlertDialogContent>
```

## Common Patterns

### Delete Confirmation

```tsx
function DeleteConfirmation({ itemName, onDelete }: { itemName: string, onDelete: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{itemName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the item.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

### Logout Confirmation

```tsx
function LogoutButton() {
  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost">Logout</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Logout from your account?</AlertDialogTitle>
          <AlertDialogDescription>
            You will need to sign in again to access your account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleLogout}>
            Logout
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

### Unsaved Changes Warning

```tsx
function UnsavedChangesDialog({ hasChanges, onSave, onDiscard }: Props) {
  return (
    <AlertDialog open={hasChanges}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>You have unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>
            Do you want to save your changes before leaving?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard}>
            Discard Changes
          </AlertDialogCancel>
          <AlertDialogAction onClick={onSave}>
            Save Changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

## Related Components

- [Alert](/components/alert) - Non-modal alert messages
- [Dialog](/components/dialog) - General purpose modal dialogs
- [Button](/components/button) - Button components for actions
- [Toast/Sonner](/components/sonner) - Temporary notifications
