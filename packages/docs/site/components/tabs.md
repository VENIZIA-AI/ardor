# Tabs

A set of layered sections of content—known as tab panels—that display one panel at a time. Built on Radix UI Tabs primitive with smooth animations.

## Installation

```bash
bunx shadcn@latest add tabs
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@venizia/ardor-admin'

export default function Example() {
  return (
    <Tabs defaultValue="account">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        Account settings content
      </TabsContent>
      <TabsContent value="password">
        Password settings content
      </TabsContent>
    </Tabs>
  )
}
```

## Examples

### Basic Tabs

Simple tabs with text content:

```tsx
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
    <TabsTrigger value="reports">Reports</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">
    <div className="p-4">Overview content goes here</div>
  </TabsContent>
  <TabsContent value="analytics">
    <div className="p-4">Analytics content goes here</div>
  </TabsContent>
  <TabsContent value="reports">
    <div className="p-4">Reports content goes here</div>
  </TabsContent>
</Tabs>
```

### Controlled Tabs

Control the active tab with state:

```tsx
import { useState } from 'react'

function ControlledTabs() {
  const [activeTab, setActiveTab] = useState('tab1')

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3">Tab 3</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Tab 1 content</TabsContent>
        <TabsContent value="tab2">Tab 2 content</TabsContent>
        <TabsContent value="tab3">Tab 3 content</TabsContent>
      </Tabs>
      <p className="text-sm text-muted-foreground">
        Active tab: {activeTab}
      </p>
    </div>
  )
}
```

### With Icons

Add icons to tab triggers:

```tsx
import { User, Settings, Bell } from 'lucide-react'

<Tabs defaultValue="profile">
  <TabsList>
    <TabsTrigger value="profile">
      <User className="mr-2 h-4 w-4" />
      Profile
    </TabsTrigger>
    <TabsTrigger value="settings">
      <Settings className="mr-2 h-4 w-4" />
      Settings
    </TabsTrigger>
    <TabsTrigger value="notifications">
      <Bell className="mr-2 h-4 w-4" />
      Notifications
    </TabsTrigger>
  </TabsList>
  <TabsContent value="profile">Profile content</TabsContent>
  <TabsContent value="settings">Settings content</TabsContent>
  <TabsContent value="notifications">Notifications content</TabsContent>
</Tabs>
```

### Disabled Tabs

Disable specific tabs to prevent selection:

```tsx
<Tabs defaultValue="available">
  <TabsList>
    <TabsTrigger value="available">Available</TabsTrigger>
    <TabsTrigger value="coming-soon" disabled>
      Coming Soon
    </TabsTrigger>
    <TabsTrigger value="beta">Beta</TabsTrigger>
  </TabsList>
  <TabsContent value="available">Available features</TabsContent>
  <TabsContent value="coming-soon">Coming soon features</TabsContent>
  <TabsContent value="beta">Beta features</TabsContent>
</Tabs>
```

### Full Width Tabs

Make tabs take full available width:

```tsx
<Tabs defaultValue="all">
  <TabsList className="w-full">
    <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
    <TabsTrigger value="active" className="flex-1">Active</TabsTrigger>
    <TabsTrigger value="archived" className="flex-1">Archived</TabsTrigger>
  </TabsList>
  <TabsContent value="all">All items</TabsContent>
  <TabsContent value="active">Active items</TabsContent>
  <TabsContent value="archived">Archived items</TabsContent>
</Tabs>
```

### With Cards

Tab content displayed in cards:

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@venizia/ardor-admin'

<Tabs defaultValue="personal">
  <TabsList>
    <TabsTrigger value="personal">Personal</TabsTrigger>
    <TabsTrigger value="business">Business</TabsTrigger>
  </TabsList>
  <TabsContent value="personal">
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
        <CardDescription>
          Update your personal details here
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>Personal form fields...</p>
      </CardContent>
    </Card>
  </TabsContent>
  <TabsContent value="business">
    <Card>
      <CardHeader>
        <CardTitle>Business Information</CardTitle>
        <CardDescription>
          Update your business details here
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>Business form fields...</p>
      </CardContent>
    </Card>
  </TabsContent>
</Tabs>
```

### Navigation Tabs

Use tabs for page navigation:

```tsx
function NavigationTabs() {
  const tabs = [
    { value: 'home', label: 'Home', content: 'Home page content' },
    { value: 'products', label: 'Products', content: 'Products page content' },
    { value: 'about', label: 'About', content: 'About page content' },
    { value: 'contact', label: 'Contact', content: 'Contact page content' },
  ]

  return (
    <Tabs defaultValue="home">
      <TabsList>
        {tabs.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map(tab => (
        <TabsContent key={tab.value} value={tab.value}>
          <div className="p-6">{tab.content}</div>
        </TabsContent>
      ))}
    </Tabs>
  )
}
```

### With Badge Indicators

Add badges to show counts or status:

```tsx
import { Badge } from '@venizia/ardor-admin'

<Tabs defaultValue="inbox">
  <TabsList>
    <TabsTrigger value="inbox">
      Inbox
      <Badge variant="secondary" className="ml-2">12</Badge>
    </TabsTrigger>
    <TabsTrigger value="sent">Sent</TabsTrigger>
    <TabsTrigger value="drafts">
      Drafts
      <Badge variant="secondary" className="ml-2">3</Badge>
    </TabsTrigger>
  </TabsList>
  <TabsContent value="inbox">Inbox messages</TabsContent>
  <TabsContent value="sent">Sent messages</TabsContent>
  <TabsContent value="drafts">Draft messages</TabsContent>
</Tabs>
```

## API Reference

### Tabs

Root component that manages tab state.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Controlled active tab value |
| `defaultValue` | `string` | - | Uncontrolled default active tab |
| `onValueChange` | `(value: string) => void` | - | Callback when active tab changes |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Orientation of tabs |
| `dir` | `"ltr" \| "rtl"` | `"ltr"` | Text direction |
| `className` | `string` | - | Additional CSS classes |

### TabsList

Container for tab triggers.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `loop` | `boolean` | `true` | Whether arrow keys wrap around |

### TabsTrigger

Individual tab button.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Unique value for this tab (required) |
| `disabled` | `boolean` | `false` | Whether the tab is disabled |
| `className` | `string` | - | Additional CSS classes |

Extends all HTML button attributes.

### TabsContent

Content panel for a tab.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Value matching the associated trigger (required) |
| `forceMount` | `boolean` | - | Force mount even when inactive |
| `className` | `string` | - | Additional CSS classes |

### Data Attributes

The Tabs component uses these data attributes for styling:

- `data-slot="tabs"` - Applied to root element
- `data-slot="tabs-list"` - Applied to tabs list
- `data-slot="tabs-trigger"` - Applied to each tab trigger
- `data-slot="tabs-content"` - Applied to each content panel
- `data-state="active|inactive"` - Current tab state
- `data-disabled` - Applied when disabled
- `data-orientation="horizontal|vertical"` - Tab orientation

## Accessibility

The Tabs component follows WAI-ARIA Tabs pattern for full accessibility:

### Keyboard Interactions

- **Tab** - Moves focus into/out of the tab list
- **Arrow Left** - Moves focus to previous tab (wraps to last)
- **Arrow Right** - Moves focus to next tab (wraps to first)
- **Home** - Moves focus to first tab
- **End** - Moves focus to last tab
- **Space/Enter** - Activates the focused tab

### Screen Reader Support

- Tab list has `role="tablist"`
- Tab triggers have `role="tab"` with proper ARIA attributes
- Tab panels have `role="tabpanel"` linked to their triggers
- Active tab indicated with `aria-selected="true"`
- Disabled tabs indicated with `aria-disabled="true"`
- Panels associated with triggers via `aria-controls` and `aria-labelledby`

### Focus Management

- Focus moves to newly activated tab
- Inactive tab panels are removed from tab order
- Visual focus indicator on tab triggers

### Best Practices

::: tip
Provide meaningful tab labels that describe the content:
```tsx
{/* Good */}
<TabsTrigger value="profile">User Profile</TabsTrigger>

{/* Bad */}
<TabsTrigger value="tab1">Tab 1</TabsTrigger>
```
:::

::: tip
Keep tab content panels independent - avoid interdependencies:
```tsx
{/* Each panel should work standalone */}
<TabsContent value="settings">
  {/* Complete settings form */}
</TabsContent>
```
:::

::: warning
Avoid using tabs for sequential workflows - use a stepper instead:
```tsx
{/* Bad: Multi-step form in tabs */}
{/* Good: Use tabs for independent sections */}
```
:::

## Styling

### CSS Variables

The Tabs component uses these CSS variables:

```css
--muted            /* Tab list background */
--muted-foreground /* Inactive tab text color */
--primary          /* Active tab accent color */
--ring             /* Focus ring color */
--input            /* Hover background */
--foreground       /* Active tab text color */
```

### Visual States

**Inactive Tab**:
- Muted text color
- Transparent background
- Hover: subtle background tint

**Active Tab**:
- Primary text color
- Primary background tint (`bg-primary/10`)
- Enhanced hover state (`bg-primary/20`)

**Focus**:
- 3px ring around trigger
- 1px outline for visibility

**Disabled**:
- Reduced opacity
- No pointer events

### Customization

Override styles using className:

```tsx
<TabsList className="bg-transparent border">
  <TabsTrigger
    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
    value="custom"
  >
    Custom Styled
  </TabsTrigger>
</TabsList>
```

### Dark Mode Support

Tabs automatically adapt to dark mode with proper contrast for all states.

## Common Patterns

### Settings Tabs

Complete settings interface with tabs:

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent, Card, CardHeader, CardTitle, CardContent, Label, Input, Button } from '@venizia/ardor-admin'

function SettingsTabs() {
  return (
    <Tabs defaultValue="general" className="w-full max-w-3xl">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue="John Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue="john@example.com" />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="security">
        <Card>
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Current Password</Label>
              <Input id="current" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">New Password</Label>
              <Input id="new" type="password" />
            </div>
            <Button>Update Password</Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="notifications">
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configure your notification preferences
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
```

### Data Table Filters

Use tabs to filter table data:

```tsx
import { useState } from 'react'

function DataTableWithTabs() {
  const [filter, setFilter] = useState('all')

  const data = {
    all: ['Item 1', 'Item 2', 'Item 3', 'Item 4'],
    active: ['Item 1', 'Item 3'],
    completed: ['Item 2', 'Item 4'],
  }

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">
            All <Badge className="ml-2">{data.all.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="active">
            Active <Badge className="ml-2">{data.active.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed <Badge className="ml-2">{data.completed.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <div className="space-y-2">
            {data.all.map(item => (
              <div key={item} className="p-4 border rounded">{item}</div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="active">
          <div className="space-y-2">
            {data.active.map(item => (
              <div key={item} className="p-4 border rounded">{item}</div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="completed">
          <div className="space-y-2">
            {data.completed.map(item => (
              <div key={item} className="p-4 border rounded">{item}</div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### Dashboard Tabs

Dashboard with different views:

```tsx
import { BarChart, Users, DollarSign } from 'lucide-react'

function DashboardTabs() {
  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">
          <BarChart className="mr-2 h-4 w-4" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="customers">
          <Users className="mr-2 h-4 w-4" />
          Customers
        </TabsTrigger>
        <TabsTrigger value="revenue">
          <DollarSign className="mr-2 h-4 w-4" />
          Revenue
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Dashboard cards */}
        </div>
      </TabsContent>
      <TabsContent value="customers">
        {/* Customer list/table */}
      </TabsContent>
      <TabsContent value="revenue">
        {/* Revenue charts */}
      </TabsContent>
    </Tabs>
  )
}
```

## Related Components

- [Card](/components/card) - Often used within tab content
- [Button](/components/button) - For actions within tabs
- [Dialog](/components/dialog) - Modal dialogs triggered from tabs
- [Table](/components/table) - Data tables within tabs
- [Badge](/components/badge) - Status indicators on tab triggers
