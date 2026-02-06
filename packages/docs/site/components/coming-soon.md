# Coming Soon

::: tip ARDOR Feature
Coming Soon is a custom ARDOR placeholder component for displaying "under construction" or "coming soon" pages with telescope icon and customizable messaging.
:::

A placeholder component for pages or features that are under development. Includes telescope icon, title, and description with built-in sub-components.

## Installation

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { ComingSoon } from '@venizia/ardor-admin'

export default function Example() {
  return <ComingSoon />
}
```

## Examples

### Basic Coming Soon

Default coming soon placeholder:

```tsx
<ComingSoon />
```

This renders with default telescope icon, "Coming Soon!" title, and "This page has not been created yet. Stay tuned though!" description.

### Custom Title and Description

Override default text:

```tsx
<ComingSoon>
  <ComingSoon.Title>Feature In Progress</ComingSoon.Title>
  <ComingSoon.Description>
    We're working hard to bring you this new feature. Check back soon!
  </ComingSoon.Description>
</ComingSoon>
```

### Title Only

Custom title with default description:

```tsx
<ComingSoon>
  <ComingSoon.Title>Settings Panel</ComingSoon.Title>
  <ComingSoon.Description />
</ComingSoon>
```

### Custom Description Only

Default title with custom description:

```tsx
<ComingSoon>
  <ComingSoon.Title />
  <ComingSoon.Description>
    This feature is currently under development and will be available in the next release.
  </ComingSoon.Description>
</ComingSoon>
```

### Completely Custom Content

Replace all content with custom elements:

```tsx
<ComingSoon>
  <div className="flex flex-col items-center gap-4">
    <h1 className="text-5xl font-bold">🚀</h1>
    <h2 className="text-2xl font-semibold">Launching Soon</h2>
    <p className="text-muted-foreground text-center max-w-sm">
      We're putting the finishing touches on something amazing.
      Subscribe to get notified when we launch!
    </p>
    <div className="flex gap-2">
      <Input type="email" placeholder="Enter your email" className="w-64" />
      <Button>Notify Me</Button>
    </div>
  </div>
</ComingSoon>
```

### Page Under Construction

Full page placeholder:

```tsx
export default function UnderConstructionPage() {
  return (
    <div className="min-h-screen">
      <ComingSoon>
        <ComingSoon.Title>Page Under Construction</ComingSoon.Title>
        <ComingSoon.Description>
          We're building something exciting here. This page will be available soon!
        </ComingSoon.Description>
      </ComingSoon>
    </div>
  )
}
```

### Feature Card Placeholder

Coming soon card in feature grid:

```tsx
function FeatureGrid() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p>View your performance metrics</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <ComingSoon className="min-h-[200px]">
            <ComingSoon.Title className="text-2xl">
              Advanced Reports
            </ComingSoon.Title>
            <ComingSoon.Description>
              Detailed reporting coming soon!
            </ComingSoon.Description>
          </ComingSoon>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Manage your preferences</p>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Tab Placeholder

Coming soon for inactive tabs:

```tsx
function FeatureTabs() {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <div>Overview content...</div>
      </TabsContent>

      <TabsContent value="analytics">
        <div>Analytics content...</div>
      </TabsContent>

      <TabsContent value="reports">
        <ComingSoon className="min-h-[300px]">
          <ComingSoon.Title>Reports Coming Soon</ComingSoon.Title>
          <ComingSoon.Description>
            Advanced reporting features are under development.
          </ComingSoon.Description>
        </ComingSoon>
      </TabsContent>
    </Tabs>
  )
}
```

### With Custom Icon

Replace telescope with custom icon:

```tsx
import { Rocket } from 'lucide-react'

<ComingSoon className="justify-start pt-12">
  <Rocket size={72} className="text-primary" />
  <ComingSoon.Title>Launching Soon</ComingSoon.Title>
  <ComingSoon.Description>
    Get ready for something amazing!
  </ComingSoon.Description>
</ComingSoon>
```

## API Reference

### ComingSoon

Root coming soon container.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `children` | `ReactNode` | Default title/description | Custom content |

Extends all HTML div attributes. Full-size flex container with centered content.

### ComingSoon.Title

Title text for coming soon message.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `children` | `ReactNode` | "Coming Soon!" | Custom title text |

Extends all HTML h1 attributes with large, bold styling.

### ComingSoon.Description

Description text for coming soon message.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `children` | `ReactNode` | Default message | Custom description text |

Extends all HTML p attributes with muted text styling.

### Data Attributes

No specific data attributes. Component uses standard HTML elements.

## Accessibility

ComingSoon provides basic accessibility:

### Semantic HTML

- Uses `h1` for title (proper heading hierarchy)
- Uses `p` for description
- Icon has decorative role

### Visual Clarity

- Large icon (72px) for visual impact
- Clear heading hierarchy
- Muted description text
- Centered layout for focus

### Best Practices

::: tip
Use appropriate heading levels:
```tsx
{/* Good - Page-level placeholder */}
<ComingSoon>
  <ComingSoon.Title>Coming Soon</ComingSoon.Title>
</ComingSoon>

{/* Good - Section placeholder with adjusted heading */}
<section>
  <h2 className="text-2xl font-bold mb-4">Features</h2>
  <ComingSoon>
    <h3 className="text-3xl font-bold">New Feature</h3>
    <ComingSoon.Description>
      This feature is under development
    </ComingSoon.Description>
  </ComingSoon>
</section>
```
:::

::: tip
Provide meaningful descriptions:
```tsx
{/* Good - Specific information */}
<ComingSoon.Description>
  Advanced analytics dashboard will be available in Q2 2024.
</ComingSoon.Description>

{/* Bad - Vague */}
<ComingSoon.Description>
  Coming soon.
</ComingSoon.Description>
```
:::

## Styling

### CSS Variables

ComingSoon uses semantic color tokens:

```css
--muted-foreground  /* Description text color */
--foreground        /* Title and icon color */
```

### Default Styles

- **Container**: Full size (`size-full`), flex column, centered
- **Icon**: 72px telescope icon
- **Title**: 4xl text, bold, tight leading
- **Description**: Muted foreground, centered, max-width 448px

### Customization

```tsx
{/* Smaller placeholder */}
<ComingSoon className="min-h-[200px]">
  <ComingSoon.Title className="text-2xl">Mini Feature</ComingSoon.Title>
</ComingSoon>

{/* Left-aligned */}
<ComingSoon className="items-start justify-start text-left p-8">
  <ComingSoon.Title />
  <ComingSoon.Description className="text-left" />
</ComingSoon>

{/* Custom colors */}
<ComingSoon>
  <ComingSoon.Title className="text-primary">
    Premium Feature
  </ComingSoon.Title>
  <ComingSoon.Description className="text-foreground">
    Available for premium users only
  </ComingSoon.Description>
</ComingSoon>

{/* With background */}
<ComingSoon className="bg-muted/50 rounded-lg">
  <ComingSoon.Title />
  <ComingSoon.Description />
</ComingSoon>
```

### Dark Mode

- Automatically adapts via CSS variables
- Icon and text maintain proper contrast
- Works well in both themes

## Common Patterns

### Route Placeholder

```tsx
// app/upcoming-feature/page.tsx
export default function UpcomingFeaturePage() {
  return (
    <div className="container py-12">
      <ComingSoon>
        <ComingSoon.Title>Upcoming Feature</ComingSoon.Title>
        <ComingSoon.Description>
          This feature is currently in development. We'll notify you when it's ready!
        </ComingSoon.Description>
      </ComingSoon>
    </div>
  )
}
```

### Conditional Feature Display

```tsx
function FeatureToggle({ isEnabled, children }: FeatureToggleProps) {
  if (!isEnabled) {
    return (
      <ComingSoon className="min-h-[400px]">
        <ComingSoon.Title>Feature Not Available</ComingSoon.Title>
        <ComingSoon.Description>
          This feature is not enabled for your account. Contact support to learn more.
        </ComingSoon.Description>
      </ComingSoon>
    )
  }

  return <>{children}</>
}

// Usage
<FeatureToggle isEnabled={user.hasFeature('analytics')}>
  <AnalyticsDashboard />
</FeatureToggle>
```

### Dashboard Widget Placeholder

```tsx
function DashboardGrid() {
  const widgets = [
    { id: 1, title: 'Sales', available: true, component: <SalesWidget /> },
    { id: 2, title: 'Traffic', available: true, component: <TrafficWidget /> },
    { id: 3, title: 'Conversions', available: false },
    { id: 4, title: 'Revenue', available: false },
  ]

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {widgets.map((widget) => (
        <Card key={widget.id}>
          <CardHeader>
            <CardTitle>{widget.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {widget.available ? (
              widget.component
            ) : (
              <ComingSoon className="min-h-[200px]">
                <ComingSoon.Title className="text-xl">
                  {widget.title}
                </ComingSoon.Title>
                <ComingSoon.Description>
                  This widget is coming soon!
                </ComingSoon.Description>
              </ComingSoon>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

### With Countdown Timer

```tsx
function LaunchCountdown() {
  const launchDate = new Date('2024-12-31')
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft())

  function calculateTimeLeft() {
    const difference = launchDate.getTime() - new Date().getTime()
    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
    }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  return (
    <ComingSoon>
      <ComingSoon.Title>Launching Soon</ComingSoon.Title>
      <ComingSoon.Description>
        We're launching something exciting!
      </ComingSoon.Description>
      <div className="flex gap-4 mt-6">
        <div className="text-center">
          <div className="text-3xl font-bold">{timeLeft.days}</div>
          <div className="text-xs text-muted-foreground">DAYS</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{timeLeft.hours}</div>
          <div className="text-xs text-muted-foreground">HOURS</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{timeLeft.minutes}</div>
          <div className="text-xs text-muted-foreground">MINUTES</div>
        </div>
      </div>
    </ComingSoon>
  )
}
```

## Related Components

- [Empty](/components/empty) - For no data states
- [Card](/components/card) - Common container
- [Tabs](/components/tabs) - For tabbed placeholders
- [Alert](/components/alert) - For feature announcements
