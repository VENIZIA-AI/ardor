# Collapsible

An interactive component that can be expanded and collapsed. Built on Radix UI Collapsible primitive for a single expandable section.

## Installation

```bash
bunx shadcn@latest add collapsible
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@venizia/ardor-admin'

export default function Example() {
  return (
    <Collapsible>
      <CollapsibleTrigger>Can I use this component?</CollapsibleTrigger>
      <CollapsibleContent>
        Yes. Free to use for personal and commercial projects.
      </CollapsibleContent>
    </Collapsible>
  )
}
```

## Examples

### Basic Collapsible

Simple expand/collapse section:

```tsx
<Collapsible>
  <CollapsibleTrigger asChild>
    <Button variant="ghost">Toggle Details</Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <p className="mt-2 text-sm">
      This content can be toggled open and closed.
    </p>
  </CollapsibleContent>
</Collapsible>
```

### With Custom Trigger

Collapsible with styled trigger button:

```tsx
import { ChevronDown } from 'lucide-react'

<Collapsible>
  <CollapsibleTrigger asChild>
    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted rounded-md">
      <span className="font-medium">Show More Information</span>
      <ChevronDown className="h-4 w-4 transition-transform duration-200" />
    </div>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div className="p-4 pt-0">
      <p className="text-sm text-muted-foreground">
        Additional information appears here when expanded.
      </p>
    </div>
  </CollapsibleContent>
</Collapsible>
```

### Default Open

Start with content expanded:

```tsx
<Collapsible defaultOpen>
  <CollapsibleTrigger asChild>
    <Button variant="outline">Hide Details</Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <p className="mt-2">This content is visible by default.</p>
  </CollapsibleContent>
</Collapsible>
```

### Controlled Collapsible

Control open state with React:

```tsx
import { useState } from 'react'

function ControlledCollapsible() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <div className="mb-4">
        <p>Status: {isOpen ? 'Open' : 'Closed'}</p>
        <Button onClick={() => setIsOpen(!isOpen)}>
          Toggle from Outside
        </Button>
      </div>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button>Toggle Content</Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p className="mt-2">Controlled collapsible content.</p>
        </CollapsibleContent>
      </Collapsible>
    </>
  )
}
```

### Disabled Collapsible

Prevent interaction with collapsible:

```tsx
<Collapsible disabled>
  <CollapsibleTrigger asChild>
    <Button disabled>Disabled Trigger</Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    This content cannot be revealed.
  </CollapsibleContent>
</Collapsible>
```

### List with Collapsible Items

Multiple collapsible sections:

```tsx
<div className="space-y-2">
  <Collapsible>
    <CollapsibleTrigger className="flex items-center justify-between w-full p-4 font-medium bg-muted rounded-md">
      <span>Section 1</span>
      <ChevronDown className="h-4 w-4" />
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="px-4 py-2">Content for section 1</div>
    </CollapsibleContent>
  </Collapsible>

  <Collapsible>
    <CollapsibleTrigger className="flex items-center justify-between w-full p-4 font-medium bg-muted rounded-md">
      <span>Section 2</span>
      <ChevronDown className="h-4 w-4" />
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="px-4 py-2">Content for section 2</div>
    </CollapsibleContent>
  </Collapsible>

  <Collapsible>
    <CollapsibleTrigger className="flex items-center justify-between w-full p-4 font-medium bg-muted rounded-md">
      <span>Section 3</span>
      <ChevronDown className="h-4 w-4" />
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="px-4 py-2">Content for section 3</div>
    </CollapsibleContent>
  </Collapsible>
</div>
```

### With Animation

Add custom animation classes:

```tsx
<Collapsible>
  <CollapsibleTrigger asChild>
    <Button variant="outline">Animated Toggle</Button>
  </CollapsibleTrigger>
  <CollapsibleContent className="transition-all duration-300 ease-in-out data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
    <div className="mt-2 p-4 border rounded-md">
      Content with smooth animation.
    </div>
  </CollapsibleContent>
</Collapsible>
```

### Code Block Collapsible

Expandable code section:

```tsx
<Collapsible>
  <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
    <ChevronRight className="h-3 w-3 transition-transform duration-200" />
    <span>Show code</span>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <pre className="mt-2 p-4 bg-muted rounded-md overflow-x-auto">
      <code>{`function hello() {
  console.log("Hello, World!");
}`}</code>
    </pre>
  </CollapsibleContent>
</Collapsible>
```

### Sidebar Navigation Item

Collapsible navigation group:

```tsx
<Collapsible>
  <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-accent rounded-md">
    <div className="flex items-center gap-2">
      <Folder className="h-4 w-4" />
      <span>Projects</span>
    </div>
    <ChevronDown className="h-4 w-4 transition-transform duration-200" />
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div className="ml-6 space-y-1 mt-1">
      <a href="/project-1" className="block p-2 text-sm hover:bg-accent rounded-md">
        Project 1
      </a>
      <a href="/project-2" className="block p-2 text-sm hover:bg-accent rounded-md">
        Project 2
      </a>
      <a href="/project-3" className="block p-2 text-sm hover:bg-accent rounded-md">
        Project 3
      </a>
    </div>
  </CollapsibleContent>
</Collapsible>
```

## API Reference

### Collapsible

Root collapsible component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultOpen` | `boolean` | `false` | Default open state |
| `open` | `boolean` | - | Controlled open state |
| `onOpenChange` | `(open: boolean) => void` | - | Callback when open state changes |
| `disabled` | `boolean` | `false` | Disable interaction |

Extends all Radix UI Collapsible.Root props.

### CollapsibleTrigger

Button that toggles the collapsible.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props into child element |

Extends all Radix UI Collapsible.Trigger and button attributes.

### CollapsibleContent

The content that expands and collapses.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

Extends all Radix UI Collapsible.Content and div attributes.

### Data Attributes

- `data-slot="collapsible"` - Root element
- `data-slot="collapsible-trigger"` - Trigger button
- `data-slot="collapsible-content"` - Content panel
- `data-state="open|closed"` - Current state
- `data-disabled` - Present when disabled

## Accessibility

Collapsible follows accessibility best practices:

### Keyboard Interactions

- **Tab** - Focus trigger button
- **Enter** or **Space** - Toggle collapsible
- **Escape** - Close collapsible (when focused)

### Screen Reader Support

- `aria-expanded` indicates open/closed state
- `aria-controls` links trigger to content
- Proper button semantics for trigger

### Focus Management

- Focus remains on trigger after toggle
- Visible focus indicator
- Keyboard navigation support

### Best Practices

::: tip
Use descriptive trigger text:
```tsx
{/* Good - describes content */}
<CollapsibleTrigger>Show additional options</CollapsibleTrigger>

{/* Bad - unclear */}
<CollapsibleTrigger>Click here</CollapsibleTrigger>
```
:::

::: tip
Provide visual indication of state:
```tsx
<CollapsibleTrigger className="flex items-center gap-2">
  <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
  <span>Toggle Content</span>
</CollapsibleTrigger>
```
:::

## Styling

### CSS Variables

Collapsible is unstyled by default, allowing full customization.

### Component Structure

- **Collapsible**: Wrapper with state management
- **CollapsibleTrigger**: Clickable button with `asChild` support
- **CollapsibleContent**: Content with expand/collapse behavior

### Customization

```tsx
{/* Custom trigger styling */}
<CollapsibleTrigger className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
  Custom Trigger
</CollapsibleTrigger>

{/* Custom content styling */}
<CollapsibleContent className="mt-2 p-4 border rounded-md bg-muted">
  Styled content area
</CollapsibleContent>

{/* Add animations */}
<CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
  Animated content
</CollapsibleContent>
```

### Dark Mode

- Style with CSS variables for automatic dark mode support
- Use semantic color tokens (border, muted, accent)

## Common Patterns

### Advanced Filter Section

```tsx
function FilterSection() {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Filters</h3>

      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
          <span>Price Range</span>
          <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-2">
            <Input type="number" placeholder="Min" />
            <Input type="number" placeholder="Max" />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
          <span>Categories</span>
          <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2">
              <Checkbox /> Electronics
            </label>
            <label className="flex items-center gap-2">
              <Checkbox /> Clothing
            </label>
            <label className="flex items-center gap-2">
              <Checkbox /> Books
            </label>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
```

### Comment Thread

```tsx
function CommentThread({ comment, replies }: {
  comment: Comment
  replies: Comment[]
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <Avatar>
          <AvatarImage src={comment.author.avatar} />
          <AvatarFallback>{comment.author.initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{comment.author.name}</span>
            <span className="text-sm text-muted-foreground">
              {comment.timestamp}
            </span>
          </div>
          <p className="text-sm mt-1">{comment.content}</p>
        </div>
      </div>

      {replies.length > 0 && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="ml-12 text-sm text-muted-foreground hover:text-foreground">
            {isOpen ? 'Hide' : 'Show'} {replies.length} replies
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-12 mt-2 space-y-2">
              {replies.map(reply => (
                <div key={reply.id} className="flex items-start gap-3">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={reply.author.avatar} />
                    <AvatarFallback>{reply.author.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-medium text-sm">{reply.author.name}</span>
                    <p className="text-sm mt-1">{reply.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
```

## Related Components

- [Accordion](/components/accordion) - For multiple collapsible sections
- [Tabs](/components/tabs) - For switching between content views
- [Dialog](/components/dialog) - For modal content display
