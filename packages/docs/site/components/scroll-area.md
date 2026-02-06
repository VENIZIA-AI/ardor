# Scroll Area

A custom styled scrollable container that replaces native browser scrollbars. Built on Radix UI Scroll Area primitive with smooth scrolling and customizable appearance.

## Installation

```bash
bunx shadcn@latest add scroll-area
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { ScrollArea } from '@venizia/ardor-admin'

export default function Example() {
  return (
    <ScrollArea className="h-[200px] w-[350px] rounded-md border p-4">
      <div className="space-y-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <p key={i}>Item {i + 1}</p>
        ))}
      </div>
    </ScrollArea>
  )
}
```

## Examples

### Basic Scroll Area

Simple scrollable content:

```tsx
<ScrollArea className="h-72 w-96 rounded-md border">
  <div className="p-4">
    <h4 className="mb-4 text-sm font-medium">Tags</h4>
    <div className="space-y-2">
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="text-sm"
        >
          Tag {i + 1}
        </div>
      ))}
    </div>
  </div>
</ScrollArea>
```

### Horizontal Scroll

Horizontal scrolling container:

```tsx
<ScrollArea className="w-96 whitespace-nowrap rounded-md border">
  <div className="flex gap-4 p-4">
    {Array.from({ length: 20 }).map((_, i) => (
      <div
        key={i}
        className="h-32 w-32 shrink-0 rounded-md bg-muted flex items-center justify-center"
      >
        Item {i + 1}
      </div>
    ))}
  </div>
  <ScrollBar orientation="horizontal" />
</ScrollArea>
```

### Both Directions

Scroll both vertically and horizontally:

```tsx
<ScrollArea className="h-96 w-96 rounded-md border">
  <div className="p-4">
    <table className="w-full">
      <thead>
        <tr>
          {Array.from({ length: 10 }).map((_, i) => (
            <th key={i} className="border p-2 whitespace-nowrap">
              Column {i + 1}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 50 }).map((_, i) => (
          <tr key={i}>
            {Array.from({ length: 10 }).map((_, j) => (
              <td key={j} className="border p-2 whitespace-nowrap">
                Cell {i + 1}-{j + 1}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  <ScrollBar orientation="horizontal" />
</ScrollArea>
```

### Chat Messages

Scrollable message list:

```tsx
<ScrollArea className="h-96 w-full rounded-md border">
  <div className="p-4 space-y-4">
    {messages.map(message => (
      <div key={message.id} className="flex gap-3">
        <Avatar>
          <AvatarImage src={message.avatar} />
          <AvatarFallback>{message.initials}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{message.author}</span>
            <span className="text-xs text-muted-foreground">
              {message.time}
            </span>
          </div>
          <p className="text-sm mt-1">{message.content}</p>
        </div>
      </div>
    ))}
  </div>
</ScrollArea>
```

### Code Block

Scrollable code viewer:

```tsx
<ScrollArea className="h-64 w-full rounded-md border bg-muted">
  <pre className="p-4">
    <code className="text-sm">{`function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Long code content...
${Array.from({ length: 50 }, (_, i) => `// Line ${i + 1}`).join('\n')}
    `}</code>
  </pre>
  <ScrollBar orientation="horizontal" />
</ScrollArea>
```

### Sidebar Navigation

Scrollable navigation menu:

```tsx
<ScrollArea className="h-[600px] w-64 rounded-md border">
  <div className="p-4 space-y-4">
    <div>
      <h4 className="mb-2 font-semibold">Getting Started</h4>
      <div className="space-y-1">
        <a href="/intro" className="block p-2 text-sm hover:bg-accent rounded">
          Introduction
        </a>
        <a href="/install" className="block p-2 text-sm hover:bg-accent rounded">
          Installation
        </a>
        <a href="/setup" className="block p-2 text-sm hover:bg-accent rounded">
          Setup
        </a>
      </div>
    </div>

    <Separator />

    <div>
      <h4 className="mb-2 font-semibold">Components</h4>
      <div className="space-y-1">
        {Array.from({ length: 30 }).map((_, i) => (
          <a
            key={i}
            href={`/component-${i}`}
            className="block p-2 text-sm hover:bg-accent rounded"
          >
            Component {i + 1}
          </a>
        ))}
      </div>
    </div>
  </div>
</ScrollArea>
```

### Product Gallery

Horizontal image gallery:

```tsx
<ScrollArea className="w-full whitespace-nowrap rounded-md border">
  <div className="flex gap-4 p-4">
    {products.map(product => (
      <div key={product.id} className="shrink-0">
        <div className="h-48 w-48 rounded-md overflow-hidden">
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        </div>
        <p className="mt-2 text-sm font-medium">{product.name}</p>
        <p className="text-sm text-muted-foreground">${product.price}</p>
      </div>
    ))}
  </div>
  <ScrollBar orientation="horizontal" />
</ScrollArea>
```

### Data Table

Scrollable table with fixed header:

```tsx
<div className="rounded-md border">
  <div className="border-b p-4 font-semibold">
    Table Header (Fixed)
  </div>
  <ScrollArea className="h-96">
    <table className="w-full">
      <thead className="sticky top-0 bg-background">
        <tr className="border-b">
          <th className="p-2 text-left">ID</th>
          <th className="p-2 text-left">Name</th>
          <th className="p-2 text-left">Email</th>
          <th className="p-2 text-left">Status</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 100 }).map((_, i) => (
          <tr key={i} className="border-b">
            <td className="p-2">{i + 1}</td>
            <td className="p-2">User {i + 1}</td>
            <td className="p-2">user{i + 1}@example.com</td>
            <td className="p-2">
              <Badge>Active</Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </ScrollArea>
</div>
```

### Notification List

Scrollable notification feed:

```tsx
<ScrollArea className="h-96 w-80 rounded-md border">
  <div className="p-4 space-y-4">
    {notifications.map(notification => (
      <div
        key={notification.id}
        className="flex gap-3 p-3 rounded-lg hover:bg-accent"
      >
        <div className={cn(
          "h-2 w-2 rounded-full mt-2",
          notification.unread && "bg-primary"
        )} />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">{notification.title}</p>
          <p className="text-sm text-muted-foreground">
            {notification.description}
          </p>
          <p className="text-xs text-muted-foreground">
            {notification.time}
          </p>
        </div>
      </div>
    ))}
  </div>
</ScrollArea>
```

## API Reference

### ScrollArea

Root scroll area container.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `children` | `ReactNode` | - | Content to make scrollable |

Extends all Radix UI ScrollArea.Root props.

### ScrollBar

Customizable scrollbar component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `orientation` | `"vertical" \| "horizontal"` | `"vertical"` | Scrollbar orientation |
| `className` | `string` | - | Additional CSS classes |

Extends all Radix UI ScrollArea.Scrollbar props.

### Data Attributes

- `data-slot="scroll-area"` - Root element
- `data-slot="scroll-area-viewport"` - Scrollable viewport
- `data-slot="scroll-area-scrollbar"` - Scrollbar track
- `data-slot="scroll-area-thumb"` - Scrollbar thumb
- `data-orientation` - Scrollbar orientation (vertical/horizontal)

## Accessibility

Scroll Area maintains browser scrolling accessibility:

### Keyboard Interactions

- **Arrow Keys** - Scroll in direction
- **Page Up/Down** - Scroll by page
- **Home/End** - Scroll to start/end
- **Space** - Scroll down by page

### Screen Reader Support

- Scrollable region properly announced
- Focus ring visible on keyboard focus
- Maintains semantic HTML structure

### Touch Support

- Native touch scrolling on mobile devices
- Momentum scrolling on iOS/Android
- Smooth scroll behavior

### Best Practices

::: tip
Always set explicit height for vertical scrolling:
```tsx
{/* Good - explicit height */}
<ScrollArea className="h-96">
  {/* Content */}
</ScrollArea>

{/* Bad - no height, won't scroll */}
<ScrollArea>
  {/* Content */}
</ScrollArea>
```
:::

::: tip
Include ScrollBar for horizontal scrolling:
```tsx
{/* Good - explicit horizontal scrollbar */}
<ScrollArea className="w-96">
  <div className="flex gap-4">
    {/* Horizontal content */}
  </div>
  <ScrollBar orientation="horizontal" />
</ScrollArea>
```
:::

## Styling

### CSS Variables

Scroll Area uses semantic color tokens:

```css
--border             /* Scrollbar track border */
--ring               /* Focus ring color */
```

### Scrollbar Styling

- **Track**: Subtle border, transparent background, 2.5px width
- **Thumb**: Rounded, border color background, full height
- **Orientation**: Automatic layout based on orientation prop

### Viewport Styling

- Focus ring on keyboard focus (3px ring with 1px outline)
- Smooth transitions for color and box-shadow
- Rounded corners inherited from parent

### Customization

```tsx
{/* Custom scrollbar color */}
<ScrollBar className="bg-primary/20">
  <ScrollBarThumb className="bg-primary" />
</ScrollBar>

{/* Thicker scrollbar */}
<ScrollBar className="w-4" />

{/* Hide scrollbar */}
<ScrollArea className="[&>[data-slot=scroll-area-scrollbar]]:hidden">
  {/* Content */}
</ScrollArea>

{/* Custom viewport styling */}
<ScrollArea className="[&>[data-slot=scroll-area-viewport]]:rounded-lg">
  {/* Content */}
</ScrollArea>
```

### Dark Mode

- Scrollbar automatically adapts via CSS variables
- Focus ring maintains visibility
- Proper contrast in both themes

## Common Patterns

### Drawer Content

```tsx
<Drawer>
  <DrawerTrigger>Open Menu</DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Menu</DrawerTitle>
    </DrawerHeader>
    <ScrollArea className="h-[400px] px-4">
      <nav className="space-y-2">
        {menuItems.map(item => (
          <a
            key={item.id}
            href={item.href}
            className="block p-2 hover:bg-accent rounded"
          >
            {item.label}
          </a>
        ))}
      </nav>
    </ScrollArea>
  </DrawerContent>
</Drawer>
```

### Select with Many Options

```tsx
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select country" />
  </SelectTrigger>
  <SelectContent>
    <ScrollArea className="h-72">
      {countries.map(country => (
        <SelectItem key={country.code} value={country.code}>
          {country.name}
        </SelectItem>
      ))}
    </ScrollArea>
  </SelectContent>
</Select>
```

### Command Palette Results

```tsx
<Command>
  <CommandInput placeholder="Search..." />
  <ScrollArea className="h-96">
    <CommandList>
      <CommandGroup heading="Suggestions">
        {suggestions.map(item => (
          <CommandItem key={item.id}>
            {item.label}
          </CommandItem>
        ))}
      </CommandGroup>
      <CommandGroup heading="Results">
        {results.map(item => (
          <CommandItem key={item.id}>
            {item.label}
          </CommandItem>
        ))}
      </CommandGroup>
    </CommandList>
  </ScrollArea>
</Command>
```

## Related Components

- [Tabs](/components/tabs) - For organized content sections
- [Drawer](/components/drawer) - Often contains scrollable content
- [Dialog](/components/dialog) - May need scrollable content area
- [Sheet](/components/sheet) - Side panels with scrollable content
