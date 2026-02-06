# Spinner

A loading indicator that displays a spinning icon. Uses the Loader2 icon from Lucide React with continuous rotation animation.

## Installation

```bash
bunx shadcn@latest add spinner
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Spinner } from '@venizia/ardor-admin'

export default function Example() {
  return <Spinner />
}
```

## Examples

### Basic Spinner

Default spinner with standard size:

```tsx
<Spinner />
```

### Custom Sizes

Different spinner sizes:

```tsx
<div className="flex items-center gap-4">
  <Spinner className="h-3 w-3" />
  <Spinner className="h-4 w-4" />
  <Spinner className="h-6 w-6" />
  <Spinner className="h-8 w-8" />
  <Spinner className="h-12 w-12" />
</div>
```

### With Text

Spinner with loading message:

```tsx
<div className="flex items-center gap-2">
  <Spinner />
  <span>Loading...</span>
</div>
```

### Centered

Spinner centered in container:

```tsx
<div className="flex items-center justify-center h-64">
  <Spinner className="h-8 w-8" />
</div>
```

### In Button

Spinner as button loading state:

```tsx
<Button disabled>
  <Spinner className="mr-2" />
  Loading...
</Button>
```

### Full Page Loading

Full-screen loading overlay:

```tsx
<div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
  <div className="flex flex-col items-center gap-2">
    <Spinner className="h-8 w-8" />
    <p className="text-sm text-muted-foreground">Loading content...</p>
  </div>
</div>
```

### Color Variants

Spinner with different colors:

```tsx
<div className="flex items-center gap-4">
  <Spinner className="text-primary" />
  <Spinner className="text-destructive" />
  <Spinner className="text-green-500" />
  <Spinner className="text-blue-500" />
</div>
```

### In Card

Loading state within card:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Loading Data</CardTitle>
  </CardHeader>
  <CardContent className="flex justify-center py-12">
    <Spinner className="h-6 w-6" />
  </CardContent>
</Card>
```

### Inline Loading

Spinner inline with content:

```tsx
<div className="flex items-center gap-2">
  <span>Processing</span>
  <Spinner className="h-3 w-3" />
</div>
```

### Form Submission

Loading state during form submission:

```tsx
function SubmitForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Spinner className="mr-2" />
            Submitting...
          </>
        ) : (
          'Submit'
        )}
      </Button>
    </form>
  )
}
```

## API Reference

### Spinner

Animated loading spinner component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all SVG element attributes.

### ARIA Attributes

Built-in accessibility attributes:
- `role="status"` - Indicates loading status
- `aria-label="Loading"` - Screen reader label

## Accessibility

Spinner includes proper ARIA attributes:

### Screen Reader Support

- `role="status"` announces loading state
- `aria-label="Loading"` provides context
- Announced automatically to screen readers

### Custom Labels

Provide specific loading context:

```tsx
<Spinner aria-label="Loading user data" />
<Spinner aria-label="Saving changes" />
<Spinner aria-label="Processing payment" />
```

### With Live Region

For dynamic updates:

```tsx
<div role="status" aria-live="polite" aria-atomic="true">
  <Spinner className="mr-2" />
  <span>Loading data...</span>
</div>
```

### Best Practices

::: tip
Always provide context for loading state:
```tsx
{/* Good - with text */}
<div className="flex items-center gap-2">
  <Spinner />
  <span>Loading...</span>
</div>

{/* Also good - descriptive label */}
<Spinner aria-label="Loading user profile" />
```
:::

::: warning
Don't rely solely on spinner for user feedback:
```tsx
{/* Good - spinner + text */}
<Button disabled>
  <Spinner className="mr-2" />
  Saving...
</Button>

{/* Bad - spinner only */}
<Button disabled>
  <Spinner />
</Button>
```
:::

## Styling

### CSS Variables

Spinner uses icon color from text:

```css
currentColor  /* Inherits text color */
```

### Animations

- **animate-spin**: Continuous 360° rotation
- Smooth, infinite animation
- CSS-based for performance

### Customization

```tsx
{/* Size variants */}
<Spinner className="h-3 w-3" />  {/* Small */}
<Spinner className="h-4 w-4" />  {/* Default */}
<Spinner className="h-6 w-6" />  {/* Medium */}
<Spinner className="h-8 w-8" />  {/* Large */}

{/* Color variants */}
<Spinner className="text-primary" />
<Spinner className="text-destructive" />
<Spinner className="text-muted-foreground" />

{/* Custom animation speed */}
<Spinner className="animate-[spin_2s_linear_infinite]" />

{/* Reverse direction */}
<Spinner className="animate-[spin_1s_linear_reverse_infinite]" />
```

### Dark Mode

- Automatically adapts via `currentColor`
- Inherits text color from parent
- No special handling needed

## Common Patterns

### Async Data Loading

```tsx
function DataDisplay() {
  const { data, isLoading, error } = useQuery('data', fetchData)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (error) {
    return <div>Error loading data</div>
  }

  return <div>{/* Display data */}</div>
}
```

### Button Loading State

```tsx
function AsyncButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    setIsLoading(true)
    try {
      await performAction()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button onClick={handleClick} disabled={isLoading}>
      {isLoading ? (
        <>
          <Spinner className="mr-2 h-4 w-4" />
          Processing...
        </>
      ) : (
        'Click Me'
      )}
    </Button>
  )
}
```

### Search with Loading

```tsx
function SearchBox() {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      {isSearching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Spinner className="h-4 w-4" />
        </div>
      )}
    </div>
  )
}
```

### Page Loading Overlay

```tsx
function PageLoader({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) return null

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Spinner className="h-12 w-12" />
        <div className="text-center">
          <p className="font-medium">Loading</p>
          <p className="text-sm text-muted-foreground">
            Please wait while we load your content...
          </p>
        </div>
      </div>
    </div>
  )
}
```

### Infinite Scroll Loading

```tsx
function InfiniteList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery()

  return (
    <div>
      {data?.pages.map((page) => (
        <div key={page.id}>
          {/* Render items */}
        </div>
      ))}

      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      )}

      {hasNextPage && (
        <Button onClick={() => fetchNextPage()}>
          Load More
        </Button>
      )}
    </div>
  )
}
```

### Multi-Step Process

```tsx
function MultiStepProcess() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span>Step {currentStep} of 3</span>
        {isProcessing && <Spinner className="h-4 w-4" />}
      </div>

      {isProcessing ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Spinner className="h-8 w-8" />
          <p className="text-sm text-muted-foreground">
            Processing step {currentStep}...
          </p>
        </div>
      ) : (
        <div>{/* Step content */}</div>
      )}
    </div>
  )
}
```

### Upload Progress

```tsx
function FileUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  return (
    <div className="space-y-4">
      <Input type="file" onChange={handleFileChange} />

      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Spinner className="h-4 w-4" />
            <span className="text-sm">Uploading... {progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}
    </div>
  )
}
```

## Related Components

- [Skeleton](/components/skeleton) - For placeholder loading states
- [Button](/components/button) - Often contains spinner during loading
- [Progress](/components/progress) - For determinate loading indicators
