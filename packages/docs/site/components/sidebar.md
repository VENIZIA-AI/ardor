# Sidebar

A composable sidebar component with built-in responsive behavior, keyboard shortcuts, and collapsible state management. Perfect for application navigation with desktop and mobile support.

## Installation

```bash
bunx shadcn@latest add sidebar
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@venizia/ardor-admin'

export default function Example() {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Application</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="/dashboard">
                      <Home />
                      <span>Dashboard</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  )
}
```

## Examples

### Basic Sidebar

Simple sidebar with navigation:

```tsx
<SidebarProvider>
  <Sidebar>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Menu</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/">
                  <Home className="h-4 w-4" />
                  <span>Home</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/projects">
                  <Folder className="h-4 w-4" />
                  <span>Projects</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/settings">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
  <main className="flex-1">
    {/* Your main content */}
  </main>
</SidebarProvider>
```

### With Header and Footer

Sidebar with header and footer sections:

```tsx
<SidebarProvider>
  <Sidebar>
    <SidebarHeader>
      <div className="flex items-center gap-2 px-4 py-2">
        <img src="/logo.svg" alt="Logo" className="h-8 w-8" />
        <span className="font-semibold">My App</span>
      </div>
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {/* Menu items */}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton>
            <User className="h-4 w-4" />
            <span>Account</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  </Sidebar>
  <main className="flex-1">
    {/* Content */}
  </main>
</SidebarProvider>
```

### Collapsible Sidebar

Sidebar with toggle button:

```tsx
import { SidebarTrigger } from '@venizia/ardor-admin'

<SidebarProvider>
  <Sidebar>
    <SidebarContent>
      {/* Sidebar content */}
    </SidebarContent>
  </Sidebar>
  <main className="flex-1">
    <header className="border-b p-4">
      <SidebarTrigger />
    </header>
    {/* Main content */}
  </main>
</SidebarProvider>
```

### Custom Hook Usage

Access sidebar state with `useSidebar` hook:

```tsx
import { useSidebar } from '@venizia/ardor-admin'

function CustomComponent() {
  const {
    state,           // 'expanded' | 'collapsed'
    open,            // boolean - desktop open state
    setOpen,         // function - set desktop state
    openMobile,      // boolean - mobile open state
    setOpenMobile,   // function - set mobile state
    isMobile,        // boolean - is mobile viewport
    toggleSidebar,   // function - toggle sidebar
  } = useSidebar()

  return (
    <div>
      <p>Sidebar is {state}</p>
      <button onClick={toggleSidebar}>
        Toggle Sidebar
      </button>
    </div>
  )
}
```

### Multiple Menu Groups

Organized navigation with multiple sections:

```tsx
<Sidebar>
  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupLabel>Overview</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/dashboard">Dashboard</a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/analytics">Analytics</a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>

    <SidebarGroup>
      <SidebarGroupLabel>Management</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/users">Users</a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/teams">Teams</a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>
</Sidebar>
```

### With Dropdown Menu

Sidebar menu items with dropdowns:

```tsx
<SidebarMenu>
  <SidebarMenuItem>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton>
          <User className="h-4 w-4" />
          <span>Account</span>
          <ChevronDown className="ml-auto h-4 w-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start">
        <DropdownMenuItem>
          <a href="/profile">Profile</a>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <a href="/settings">Settings</a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </SidebarMenuItem>
</SidebarMenu>
```

### Collapsible Menu Groups

Expandable menu sections:

```tsx
<SidebarGroup>
  <Collapsible>
    <CollapsibleTrigger asChild>
      <SidebarGroupLabel className="cursor-pointer">
        Projects
        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
      </SidebarGroupLabel>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/project-1">Project 1</a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/project-2">Project 2</a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </CollapsibleContent>
  </Collapsible>
</SidebarGroup>
```

### Icon-Only Mode

Collapsed sidebar showing only icons with tooltips:

```tsx
<SidebarProvider defaultOpen={false}>
  <Sidebar>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton asChild>
                    <a href="/dashboard">
                      <Home className="h-4 w-4" />
                      <span>Dashboard</span>
                    </a>
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Dashboard
                </TooltipContent>
              </Tooltip>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
</SidebarProvider>
```

## API Reference

### SidebarProvider

Context provider for sidebar state management.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultOpen` | `boolean` | `true` | Default open state for desktop |
| `open` | `boolean` | - | Controlled open state |
| `onOpenChange` | `(open: boolean) => void` | - | Callback when open changes |

### Sidebar

Main sidebar container.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `side` | `"left" \| "right"` | `"left"` | Which side to attach sidebar |
| `variant` | `"sidebar" \| "floating" \| "inset"` | `"sidebar"` | Visual variant |
| `collapsible` | `"offcanvas" \| "icon" \| "none"` | `"offcanvas"` | Collapse behavior |
| `className` | `string` | - | Additional CSS classes |

### SidebarTrigger

Button to toggle sidebar visibility.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### SidebarHeader

Header section of sidebar.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### SidebarFooter

Footer section of sidebar.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### SidebarContent

Scrollable content area.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### SidebarGroup

Group container for menu sections.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### SidebarGroupLabel

Label for menu group.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props into child |
| `className` | `string` | - | Additional CSS classes |

### SidebarGroupContent

Content wrapper for menu group.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### SidebarMenu

Menu list container.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### SidebarMenuItem

Individual menu item.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |

### SidebarMenuButton

Clickable menu button.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Merge props into child |
| `isActive` | `boolean` | `false` | Highlight as active |
| `tooltip` | `string \| ComponentProps<typeof TooltipContent>` | - | Tooltip content |
| `className` | `string` | - | Additional CSS classes |

### useSidebar Hook

Access sidebar state and controls.

```tsx
const {
  state,           // 'expanded' | 'collapsed'
  open,            // boolean
  setOpen,         // (open: boolean) => void
  openMobile,      // boolean
  setOpenMobile,   // (open: boolean) => void
  isMobile,        // boolean
  toggleSidebar,   // () => void
} = useSidebar()
```

### Data Attributes

- `data-slot="sidebar"` - Root sidebar element
- `data-slot="sidebar-header"` - Header section
- `data-slot="sidebar-content"` - Content section
- `data-slot="sidebar-footer"` - Footer section
- `data-slot="sidebar-group"` - Menu group
- `data-slot="sidebar-menu"` - Menu list
- `data-slot="sidebar-menu-button"` - Menu button
- `data-state="expanded|collapsed"` - Current state
- `data-side="left|right"` - Which side
- `data-variant` - Visual variant
- `data-collapsible` - Collapse mode

## Accessibility

Sidebar follows accessibility best practices:

### Keyboard Interactions

- **Cmd/Ctrl + B** - Toggle sidebar (customizable)
- **Tab** - Navigate through menu items
- **Enter/Space** - Activate focused item
- **Escape** - Close mobile sidebar

### Screen Reader Support

- Proper navigation semantics
- ARIA labels on interactive elements
- Announces sidebar state changes

### Focus Management

- Focus trap in mobile mode
- Visible focus indicators
- Logical tab order

### Best Practices

::: tip
Always wrap in SidebarProvider:
```tsx
{/* Good */}
<SidebarProvider>
  <Sidebar>{/* ... */}</Sidebar>
</SidebarProvider>

{/* Bad - won't work */}
<Sidebar>{/* ... */}</Sidebar>
```
:::

::: tip
Use semantic HTML with asChild:
```tsx
<SidebarMenuButton asChild>
  <a href="/dashboard">Dashboard</a>
</SidebarMenuButton>
```
:::

## Styling

### CSS Variables

```css
--sidebar-width          /* Default: 16rem */
--sidebar-width-mobile   /* Default: 18rem */
--sidebar-width-icon     /* Default: 3rem */
```

### Variants

- **sidebar** (default): Full-height sidebar
- **floating**: Floating sidebar with shadow
- **inset**: Inset sidebar within content area

### Collapse Modes

- **offcanvas**: Completely hides (mobile-style)
- **icon**: Shows icon-only mode
- **none**: Non-collapsible

### Customization

```tsx
{/* Custom width */}
<Sidebar className="w-64">
  {/* ... */}
</Sidebar>

{/* Custom background */}
<Sidebar className="bg-muted">
  {/* ... */}
</Sidebar>

{/* Floating variant */}
<Sidebar variant="floating">
  {/* ... */}
</Sidebar>
```

### Dark Mode

- Automatically adapts using CSS variables
- Proper contrast in both modes
- Border colors adjust automatically

## Common Patterns

### App Shell Layout

```tsx
function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <Sidebar>
          <SidebarHeader>
            <h2 className="px-4 text-lg font-semibold">My App</h2>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* Navigation items */}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <User className="h-4 w-4" />
                  <span>Profile</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col">
          <header className="border-b p-4">
            <SidebarTrigger />
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
```

### Multi-Level Navigation

```tsx
<SidebarContent>
  <SidebarGroup>
    <SidebarGroupLabel>Main</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <a href="/">Dashboard</a>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <Collapsible>
          <CollapsibleTrigger asChild>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Folder className="h-4 w-4" />
                <span>Projects</span>
                <ChevronDown className="ml-auto h-4 w-4" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenu className="ml-4">
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/project-a">Project A</a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/project-b">Project B</a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</SidebarContent>
```

### Active Route Highlighting

```tsx
import { usePathname } from 'next/navigation'

function NavItem({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <a href={href}>{children}</a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
```

## Related Components

- [Sheet](/components/sheet) - Alternative mobile navigation
- [Drawer](/components/drawer) - Slide-in panels
- [Tabs](/components/tabs) - Alternative navigation pattern
- [Breadcrumb](/components/breadcrumb) - Hierarchical navigation
