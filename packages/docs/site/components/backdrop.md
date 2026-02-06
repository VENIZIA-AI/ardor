# Backdrop

::: tip ARDOR Feature
Backdrop is a custom ARDOR utility component for creating loading overlays and modal backdrops with built-in loading spinner support.
:::

A flexible overlay component for creating loading states, modal backdrops, and blocking UI interactions. Includes a built-in loading spinner variant.

## Installation

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Backdrop } from '@venizia/ardor-admin'

export default function Example() {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div className="relative min-h-[400px]">
      <Backdrop open={isLoading}>
        <Backdrop.Loading />
      </Backdrop>
      <div>Your content here</div>
    </div>
  )
}
```

## Examples

### Basic Backdrop

Simple overlay backdrop:

```tsx
function BasicExample() {
  const [show, setShow] = useState(false)

  return (
    <div className="relative h-[300px] border rounded-lg p-6">
      <Backdrop open={show} />
      <div>
        <h3 className="font-semibold mb-2">Content Area</h3>
        <p className="text-sm text-muted-foreground mb-4">
          This content will be covered by a backdrop overlay.
        </p>
        <Button onClick={() => setShow(!show)}>
          Toggle Backdrop
        </Button>
      </div>
    </div>
  )
}
```

### Loading Backdrop

Backdrop with loading spinner:

```tsx
function LoadingExample() {
  const [isLoading, setIsLoading] = useState(false)

  const handleLoad = async () => {
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsLoading(false)
  }

  return (
    <div className="relative h-[300px] border rounded-lg p-6">
      <Backdrop open={isLoading}>
        <Backdrop.Loading />
      </Backdrop>
      <div>
        <h3 className="font-semibold mb-2">Data Loading</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Click the button to simulate loading.
        </p>
        <Button onClick={handleLoad} disabled={isLoading}>
          Load Data
        </Button>
      </div>
    </div>
  )
}
```

### Custom Loading Spinner

Backdrop with custom spinner size and color:

```tsx
<div className="relative h-[300px]">
  <Backdrop open={isLoading}>
    <Backdrop.Loading className="size-16 text-primary" />
  </Backdrop>
  <div>Content</div>
</div>
```

### Custom Backdrop Content

Backdrop with custom loading message:

```tsx
<div className="relative h-[300px]">
  <Backdrop open={isProcessing} className="bg-background/80">
    <div className="flex flex-col items-center gap-3">
      <Backdrop.Loading />
      <p className="text-sm font-medium">Processing your request...</p>
    </div>
  </Backdrop>
  <div>Content</div>
</div>
```

### Form Submission Loading

Backdrop during form submission:

```tsx
function FormWithLoading() {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="relative space-y-4 p-6 border rounded-lg">
      <Backdrop open={isSubmitting}>
        <Backdrop.Loading />
      </Backdrop>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="Enter your name" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="Enter your email" />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </Button>
    </form>
  )
}
```

### Card with Loading State

Loading overlay on card component:

```tsx
function DataCard() {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchData()
    setIsRefreshing(false)
  }

  return (
    <Card className="relative">
      <Backdrop open={isRefreshing}>
        <Backdrop.Loading />
      </Backdrop>

      <CardHeader>
        <CardTitle>Analytics</CardTitle>
        <CardDescription>Your performance metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm">Total Views</span>
            <span className="font-semibold">1,234</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Conversions</span>
            <span className="font-semibold">89</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" onClick={handleRefresh}>
          Refresh Data
        </Button>
      </CardFooter>
    </Card>
  )
}
```

### Table Loading Overlay

Backdrop over data table:

```tsx
function DataTable() {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div className="relative border rounded-lg">
      <Backdrop open={isLoading}>
        <div className="flex flex-col items-center gap-3">
          <Backdrop.Loading />
          <p className="text-sm text-muted-foreground">Loading data...</p>
        </div>
      </Backdrop>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Table rows */}
        </TableBody>
      </Table>
    </div>
  )
}
```

### Modal Backdrop

Custom modal-like backdrop:

```tsx
function CustomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <Backdrop
        open={open}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
      >
        <div
          className="bg-background border rounded-lg p-6 max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-semibold mb-2">Modal Title</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Modal content goes here.
          </p>
          <Button onClick={onClose}>Close</Button>
        </div>
      </Backdrop>
    </>
  )
}
```

## API Reference

### Backdrop

Root backdrop overlay component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | - | Controls backdrop visibility (required) |
| `className` | `string` | - | Additional CSS classes |

Extends all HTML div attributes. Component only renders when `open` is `true`.

### Backdrop.Loading

Built-in loading spinner for backdrop.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all SVG attributes. Uses Spinner component with absolute centering.

### Data Attributes

- `data-slot="backdrop"` - Root backdrop element
- `aria-hidden` - Present on backdrop (not interactive element)

## Accessibility

Backdrop follows accessibility patterns:

### ARIA Attributes

- `aria-hidden` attribute on backdrop overlay
- Backdrop is non-interactive by default
- Screen readers skip backdrop element

### Focus Management

- Backdrop doesn't trap focus by itself
- Use with Dialog/Modal for focus trapping
- Loading spinner has proper `role` and `aria-label`

### Visual Feedback

- Semi-transparent background for context
- Clear loading indicator
- Prevents interaction with covered content

### Best Practices

::: tip
Always control visibility with `open` prop:
```tsx
{/* Good - Controlled visibility */}
<Backdrop open={isLoading}>
  <Backdrop.Loading />
</Backdrop>

{/* Bad - Always rendered */}
<Backdrop open={true}>
  <Backdrop.Loading />
</Backdrop>
```
:::

::: tip
Position container relatively:
```tsx
{/* Good - Relative positioning */}
<div className="relative">
  <Backdrop open={isLoading}>
    <Backdrop.Loading />
  </Backdrop>
  <div>Content</div>
</div>

{/* Bad - No positioning context */}
<div>
  <Backdrop open={isLoading}>
    <Backdrop.Loading />
  </Backdrop>
</div>
```
:::

## Styling

### CSS Variables

Backdrop uses semantic color tokens:

```css
--background         /* Backdrop background color with opacity */
--primary           /* Loading spinner color */
```

### Default Styles

- **Background**: `bg-background/50` (50% opacity)
- **Position**: `absolute inset-0` (covers parent)
- **Z-Index**: `z-40`
- **Layout**: Flex centered for children
- **Spinner Size**: `size-12` (48px)
- **Spinner Position**: Absolute centered

### Customization

```tsx
{/* Custom opacity */}
<Backdrop open={isLoading} className="bg-background/80">
  <Backdrop.Loading />
</Backdrop>

{/* Custom z-index */}
<Backdrop open={isLoading} className="z-50">
  <Backdrop.Loading />
</Backdrop>

{/* Fixed positioning (fullscreen) */}
<Backdrop open={isLoading} className="fixed inset-0">
  <Backdrop.Loading />
</Backdrop>

{/* Blur effect */}
<Backdrop open={isLoading} className="backdrop-blur-sm">
  <Backdrop.Loading />
</Backdrop>

{/* Custom spinner color and size */}
<Backdrop open={isLoading}>
  <Backdrop.Loading className="size-20 text-destructive" />
</Backdrop>
```

### Dark Mode

- Automatically adapts via CSS variables
- Background opacity adjusts for visibility
- Loading spinner maintains proper contrast

## Common Patterns

### Async Operation Handler

```tsx
function useAsyncOperation() {
  const [isLoading, setIsLoading] = useState(false)

  const execute = async <T,>(
    operation: () => Promise<T>
  ): Promise<T | null> => {
    setIsLoading(true)
    try {
      const result = await operation()
      return result
    } catch (error) {
      console.error(error)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return { isLoading, execute }
}

// Usage
function MyComponent() {
  const { isLoading, execute } = useAsyncOperation()

  const handleAction = () => {
    execute(async () => {
      await api.doSomething()
    })
  }

  return (
    <div className="relative">
      <Backdrop open={isLoading}>
        <Backdrop.Loading />
      </Backdrop>
      <Button onClick={handleAction}>Perform Action</Button>
    </div>
  )
}
```

### Section Loading State

```tsx
function DashboardSection({ title, loadData }: SectionProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState(null)

  const refresh = async () => {
    setIsLoading(true)
    try {
      const result = await loadData()
      setData(result)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <Button variant="ghost" size="icon" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative min-h-[200px]">
        <Backdrop open={isLoading}>
          <Backdrop.Loading />
        </Backdrop>
        {data && <DataDisplay data={data} />}
      </CardContent>
    </Card>
  )
}
```

### Conditional Loading Message

```tsx
function SmartBackdrop({
  open,
  message = 'Loading...',
  showMessage = false
}: BackdropProps) {
  return (
    <Backdrop open={open}>
      <div className="flex flex-col items-center gap-3">
        <Backdrop.Loading />
        {showMessage && (
          <p className="text-sm font-medium animate-pulse">
            {message}
          </p>
        )}
      </div>
    </Backdrop>
  )
}

// Usage
<SmartBackdrop
  open={isProcessing}
  message="Processing payment..."
  showMessage
/>
```

## Related Components

- [Spinner](/components/spinner) - Standalone loading spinner
- [Card](/components/card) - Common container for backdrop
- [Dialog](/components/dialog) - Full modal with backdrop
- [Sheet](/components/sheet) - Side panel with backdrop
