# Dialog

A modal dialog component for displaying important content that requires user attention.

## Installation

```bash
bunx shadcn@latest add dialog
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@venizia/ardor-admin';
import { Button } from '@venizia/ardor-admin';

export default function Example() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>Dialog description goes here</DialogDescription>
        </DialogHeader>
        <div>Your content goes here</div>
        <DialogFooter>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## Examples

### Basic Dialog

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Are you sure?</DialogTitle>
      <DialogDescription>This action cannot be undone.</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant='outline'>Cancel</Button>
      <Button variant='destructive'>Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Dialog with Form

```tsx
import { Input } from '@venizia/ardor-admin';
import { Label } from '@venizia/ardor-admin';

<Dialog>
  <DialogTrigger asChild>
    <Button>Add Item</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Create New Item</DialogTitle>
      <DialogDescription>Add a new item to your collection</DialogDescription>
    </DialogHeader>
    <form className='space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor='name'>Name</Label>
        <Input id='name' placeholder='Enter name' />
      </div>
      <div className='space-y-2'>
        <Label htmlFor='email'>Email</Label>
        <Input id='email' type='email' placeholder='Enter email' />
      </div>
    </form>
    <DialogFooter>
      <Button variant='outline'>Cancel</Button>
      <Button>Create</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>;
```

### Dialog with Controlled State

```tsx
import { useState } from 'react';

function ControlledDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Controlled Dialog</DialogTitle>
        </DialogHeader>
        <p>This dialog is controlled by state.</p>
        <DialogFooter>
          <Button onClick={() => setIsOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Dialog Without Close Button

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent showCloseButton={false}>
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
    </DialogHeader>
    <p>You must make a choice to close this dialog.</p>
    <DialogFooter>
      <Button variant='outline' onClick={() => {}}>
        No
      </Button>
      <Button>Yes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Nested Dialogs

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Main Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Main Dialog</DialogTitle>
    </DialogHeader>
    <p>This is the main dialog</p>

    <Dialog>
      <DialogTrigger asChild>
        <Button variant='outline'>Open Nested Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nested Dialog</DialogTitle>
        </DialogHeader>
        <p>This is a nested dialog</p>
      </DialogContent>
    </Dialog>
  </DialogContent>
</Dialog>
```

### Long Content

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent className='max-h-screen overflow-y-auto'>
    <DialogHeader>
      <DialogTitle>Terms of Service</DialogTitle>
    </DialogHeader>
    <div className='space-y-4'>
      <p>Your long content goes here...</p>
      {/* Content that may overflow */}
    </div>
    <DialogFooter>
      <Button>Accept</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Custom Styled Dialog

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent className='sm:max-w-md'>
    <DialogHeader>
      <DialogTitle>Custom Dialog</DialogTitle>
      <DialogDescription>This dialog has custom styling</DialogDescription>
    </DialogHeader>
    <div className='space-y-4'>
      <p>Your content here</p>
    </div>
  </DialogContent>
</Dialog>
```

## API Reference

### Dialog

The root dialog component that manages open/close state.

| Prop           | Type                      | Default     | Description                                                |
| -------------- | ------------------------- | ----------- | ---------------------------------------------------------- |
| `open`         | `boolean`                 | `undefined` | Controlled open state                                      |
| `onOpenChange` | `(open: boolean) => void` | `undefined` | Called when dialog open state changes                      |
| `modal`        | `boolean`                 | `true`      | Whether the dialog is modal (prevents interaction outside) |

Extends all Radix UI `Dialog.Root` props.

### DialogTrigger

Element that triggers the dialog to open.

| Prop      | Type      | Default | Description                                      |
| --------- | --------- | ------- | ------------------------------------------------ |
| `asChild` | `boolean` | `false` | Merge props into child element (uses Radix Slot) |

Extends all Radix UI `Dialog.Trigger` props.

### DialogPortal

Container that renders the dialog outside the normal DOM hierarchy.

| Prop         | Type      | Default     | Description            |
| ------------ | --------- | ----------- | ---------------------- |
| `forceMount` | `boolean` | `undefined` | Force mount the dialog |
| `container`  | `Element` | `undefined` | Custom DOM container   |

Extends all Radix UI `Dialog.Portal` props.

### DialogOverlay

Backdrop overlay that appears behind the dialog.

| Prop        | Type     | Default     | Description            |
| ----------- | -------- | ----------- | ---------------------- |
| `className` | `string` | `undefined` | Additional CSS classes |

Extends all standard HTML `<div>` attributes.

### DialogContent

Main dialog container with built-in close button.

| Prop              | Type        | Default     | Description                      |
| ----------------- | ----------- | ----------- | -------------------------------- |
| `showCloseButton` | `boolean`   | `true`      | Whether to show the close button |
| `className`       | `string`    | `undefined` | Additional CSS classes           |
| `children`        | `ReactNode` | `undefined` | Dialog content                   |

Extends all Radix UI `Dialog.Content` props.

### DialogHeader

Container for title and description.

| Prop        | Type     | Default     | Description            |
| ----------- | -------- | ----------- | ---------------------- |
| `className` | `string` | `undefined` | Additional CSS classes |

### DialogTitle

Main heading for the dialog.

| Prop        | Type     | Default     | Description            |
| ----------- | -------- | ----------- | ---------------------- |
| `className` | `string` | `undefined` | Additional CSS classes |

Extends all Radix UI `Dialog.Title` props.

### DialogDescription

Secondary text describing the dialog.

| Prop        | Type     | Default     | Description            |
| ----------- | -------- | ----------- | ---------------------- |
| `className` | `string` | `undefined` | Additional CSS classes |

Extends all Radix UI `Dialog.Description` props.

### DialogFooter

Container for action buttons at the bottom.

| Prop        | Type     | Default     | Description            |
| ----------- | -------- | ----------- | ---------------------- |
| `className` | `string` | `undefined` | Additional CSS classes |

### DialogClose

Button that closes the dialog.

| Prop        | Type     | Default     | Description            |
| ----------- | -------- | ----------- | ---------------------- |
| `className` | `string` | `undefined` | Additional CSS classes |

Extends all Radix UI `Dialog.Close` props.

### Data Attributes

The Dialog component uses these data attributes for styling:

- `data-slot="dialog"` - Applied to Dialog root
- `data-slot="dialog-trigger"` - Applied to DialogTrigger
- `data-slot="dialog-portal"` - Applied to DialogPortal
- `data-slot="dialog-overlay"` - Applied to DialogOverlay
- `data-slot="dialog-content"` - Applied to DialogContent
- `data-slot="dialog-header"` - Applied to DialogHeader
- `data-slot="dialog-title"` - Applied to DialogTitle
- `data-slot="dialog-description"` - Applied to DialogDescription
- `data-slot="dialog-footer"` - Applied to DialogFooter
- `data-slot="dialog-close"` - Applied to DialogClose button

## Animations

The Dialog component includes smooth animations:

- **Open**: Fade-in (0.2s) + zoom-in (95% to 100%)
- **Close**: Fade-out (0.2s) + zoom-out (100% to 95%)
- **Overlay**: Fade-in/out transition

These animations are built-in and use Tailwind's animation utilities.

## Accessibility

- **Modal Behavior**: By default, dialog is modal and prevents interaction outside
- **Focus Management**: Focus is automatically trapped within the dialog
- **Keyboard**: `Escape` key closes the dialog
- **Screen Readers**: Dialog role automatically announced
- **ARIA**: Proper `aria-labelledby` and `aria-describedby` relationships

### Best Practices

::: tip
Always provide a clear title for dialogs:

```tsx
<DialogHeader>
  <DialogTitle>Confirm Delete</DialogTitle>
  <DialogDescription>This action cannot be undone</DialogDescription>
</DialogHeader>
```

:::

::: warning
Avoid hiding the close button for critical actions:

```tsx
// Use only when necessary
<DialogContent showCloseButton={false}>
  {/* Must provide alternative way to dismiss */}
</DialogContent>
```

:::

::: tip
Use DialogDescription for context:

```tsx
<DialogHeader>
  <DialogTitle>New Workspace</DialogTitle>
  <DialogDescription>Create a new workspace to organize your projects</DialogDescription>
</DialogHeader>
```

:::

## Responsive Behavior

### Mobile Optimization

The Dialog automatically adapts to screen sizes:

```typescript
// Small screens (mobile)
max-w-[calc(100%-2rem)]  // Takes 100% minus padding

// sm and larger
max-w-lg  // Fixed max-width of 32rem
```

The header and footer are also responsive:

```typescript
// Mobile: Centered text, column layout
// sm+: Left-aligned text, row layout for footer
```

## Styling

### CSS Variables

The Dialog uses these CSS variables from your theme:

```css
--background
--border
--muted-foreground
--accent
--ring
--ring-offset
```

### Close Button

The close button includes:

- 70% opacity by default
- Hover state with 100% opacity
- Focus ring as per ARDOR design system
- Absolute positioning in top-right corner

### Overlay

```css
bg-black/50  /* Semi-transparent black */
```

### Content Box

```css
rounded-lg           /* Large radius */
border               /* Border color from theme */
shadow-lg            /* Large shadow for depth */
```

## Customization

### Custom Width

```tsx
<DialogContent className='sm:max-w-2xl'>{/* Wider dialog */}</DialogContent>
```

### Custom Colors

```tsx
<DialogContent className='bg-purple-50 border-purple-300'>
  <DialogTitle className='text-purple-900'>Custom Colors</DialogTitle>
</DialogContent>
```

### Without Default Animations

```tsx
<DialogContent className='data-[state=open]:animate-none data-[state=closed]:animate-none'>
  {/* No animations */}
</DialogContent>
```

## Common Patterns

### Confirmation Dialog

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant='destructive'>Delete</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete Item?</DialogTitle>
      <DialogDescription>
        Are you sure you want to delete this item? This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant='outline'>Cancel</Button>
      <Button variant='destructive'>Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Settings Dialog

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant='outline'>Settings</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Settings</DialogTitle>
    </DialogHeader>
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <Label>Dark Mode</Label>
        <Switch />
      </div>
      <div className='flex items-center justify-between'>
        <Label>Notifications</Label>
        <Switch />
      </div>
    </div>
    <DialogFooter>
      <Button>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Alert Dialog

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Show Alert</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Important</DialogTitle>
      <DialogDescription>Your session will expire in 5 minutes.</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button>Extend Session</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Data Entry Dialog

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Add User</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Add New User</DialogTitle>
      <DialogDescription>Enter user details below</DialogDescription>
    </DialogHeader>
    <form className='space-y-4'>
      <Field>
        <Label>Full Name</Label>
        <Input placeholder='John Doe' />
      </Field>
      <Field>
        <Label>Email</Label>
        <Input type='email' placeholder='john@example.com' />
      </Field>
      <Field>
        <Label>Role</Label>
        <Select>
          <option>User</option>
          <option>Admin</option>
        </Select>
      </Field>
    </form>
    <DialogFooter>
      <Button variant='outline'>Cancel</Button>
      <Button>Add User</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Related Components

- [Button](/components/button) - Dialog trigger and action buttons
- [Input](/components/input) - Form inputs in dialogs
- [Card](/components/card) - Similar container structure
- [Alert Dialog](/components/alert-dialog) - For urgent alerts
- [Sheet](/components/sheet) - Slide-in dialog alternative
