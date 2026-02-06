# Switch

A toggle control for binary on/off states. Built on Radix UI Switch primitive with smooth animations.

## Installation

```bash
bunx shadcn@latest add switch
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { Switch } from '@venizia/ardor-admin'

export default function Example() {
  return <Switch />
}
```

## Examples

### Basic Switch

A simple switch with label:

```tsx
import { Label, Switch } from '@venizia/ardor-admin'

<div className="flex items-center space-x-2">
  <Switch id="airplane-mode" />
  <Label htmlFor="airplane-mode">Airplane Mode</Label>
</div>
```

### Controlled Switch

Control the switch state with React state:

```tsx
import { useState } from 'react'
import { Switch } from '@venizia/ardor-admin'

function ControlledSwitch() {
  const [enabled, setEnabled] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch
          id="notifications"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
        <Label htmlFor="notifications">Enable notifications</Label>
      </div>
      <p className="text-sm text-muted-foreground">
        Notifications are {enabled ? 'enabled' : 'disabled'}
      </p>
    </div>
  )
}
```

### Disabled State

Disable switches to prevent user interaction:

```tsx
<div className="space-y-4">
  <div className="flex items-center space-x-2">
    <Switch id="enabled" />
    <Label htmlFor="enabled">Enabled switch</Label>
  </div>
  <div className="flex items-center space-x-2">
    <Switch id="disabled-off" disabled />
    <Label htmlFor="disabled-off">Disabled (off)</Label>
  </div>
  <div className="flex items-center space-x-2">
    <Switch id="disabled-on" disabled checked />
    <Label htmlFor="disabled-on">Disabled (on)</Label>
  </div>
</div>
```

### With Description

Add descriptive text for better context:

```tsx
<div className="flex items-start space-x-3">
  <Switch id="marketing" className="mt-0.5" />
  <div className="grid gap-1.5 leading-none">
    <Label htmlFor="marketing">Marketing emails</Label>
    <p className="text-sm text-muted-foreground">
      Receive emails about new products and features
    </p>
  </div>
</div>
```

### Switch List

Multiple switches for different settings:

```tsx
import { useState } from 'react'

function SwitchList() {
  const [settings, setSettings] = useState({
    notifications: true,
    marketing: false,
    social: true,
  })

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="notifications">Push Notifications</Label>
        <Switch
          id="notifications"
          checked={settings.notifications}
          onCheckedChange={() => toggleSetting('notifications')}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="marketing">Marketing Emails</Label>
        <Switch
          id="marketing"
          checked={settings.marketing}
          onCheckedChange={() => toggleSetting('marketing')}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="social">Social Updates</Label>
        <Switch
          id="social"
          checked={settings.social}
          onCheckedChange={() => toggleSetting('social')}
        />
      </div>
    </div>
  )
}
```

### Form Integration

Integrate switch with form handling:

```tsx
import { useState } from 'react'
import { Switch, Button } from '@venizia/ardor-admin'

function FormExample() {
  const [preferences, setPreferences] = useState({
    darkMode: false,
    autoSave: true,
    showPreview: true,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Preferences:', preferences)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Preferences</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="darkMode">Dark Mode</Label>
            <Switch
              id="darkMode"
              checked={preferences.darkMode}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, darkMode: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="autoSave">Auto Save</Label>
            <Switch
              id="autoSave"
              checked={preferences.autoSave}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, autoSave: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="showPreview">Show Preview</Label>
            <Switch
              id="showPreview"
              checked={preferences.showPreview}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, showPreview: checked })
              }
            />
          </div>
        </div>
      </div>
      <Button type="submit">Save Preferences</Button>
    </form>
  )
}
```

### With Icons

Add visual indicators with icons:

```tsx
import { Switch, Label } from '@venizia/ardor-admin'
import { Moon, Sun } from 'lucide-react'

<div className="flex items-center space-x-2">
  <Sun className="h-4 w-4" />
  <Switch id="theme" />
  <Moon className="h-4 w-4" />
  <Label htmlFor="theme" className="sr-only">Toggle theme</Label>
</div>
```

### Conditional UI

Show/hide content based on switch state:

```tsx
import { useState } from 'react'
import { Switch, Label, Input } from '@venizia/ardor-admin'

function ConditionalSwitch() {
  const [enabled, setEnabled] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch
          id="custom"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
        <Label htmlFor="custom">Custom domain</Label>
      </div>
      {enabled && (
        <div className="pl-10 space-y-2">
          <Label htmlFor="domain">Domain name</Label>
          <Input
            id="domain"
            placeholder="example.com"
            className="max-w-xs"
          />
        </div>
      )}
    </div>
  )
}
```

## API Reference

### Switch

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | `boolean` | - | Controlled checked state |
| `defaultChecked` | `boolean` | - | Uncontrolled default checked state |
| `onCheckedChange` | `(checked: boolean) => void` | - | Callback when checked state changes |
| `disabled` | `boolean` | `false` | Whether the switch is disabled |
| `required` | `boolean` | `false` | Whether the switch is required |
| `name` | `string` | - | Name attribute for form submission |
| `value` | `string` | `"on"` | Value submitted with form |
| `id` | `string` | - | ID for label association |
| `className` | `string` | - | Additional CSS classes |

Extends all HTML button attributes.

### Data Attributes

The Switch component uses these data attributes for styling:

- `data-slot="switch"` - Applied to switch root element
- `data-slot="switch-thumb"` - Applied to the thumb/handle element
- `data-state="checked|unchecked"` - Current switch state
- `data-disabled` - Applied when disabled

## Accessibility

The Switch component follows WAI-ARIA Switch patterns for full accessibility:

### Keyboard Interactions

- **Space** - Toggles the switch between on and off
- **Enter** - Toggles the switch (optional implementation)
- **Tab** - Moves focus to/from the switch

### Screen Reader Support

- Switch has `role="switch"` with proper ARIA attributes
- State communicated via `aria-checked="true|false"`
- Disabled state indicated with `aria-disabled="true"`
- Label association via `htmlFor` and `id`
- Works with `aria-describedby` for additional context

### Focus Management

- Visible focus ring via `focus-visible:ring-[3px]`
- Focus indicator uses theme's `--ring` color
- Keyboard-only focus (no focus on mouse click)

### Best Practices

::: tip
Always associate switches with labels:
```tsx
<Switch id="notifications" />
<Label htmlFor="notifications">Notifications</Label>
```
This improves accessibility and makes the label clickable.
:::

::: tip
Use descriptive labels that clearly indicate what the switch controls:
```tsx
{/* Good */}
<Label>Enable dark mode</Label>

{/* Bad */}
<Label>Dark mode</Label>
```
:::

::: warning
Switches are for immediate actions. For settings that require confirmation, use checkboxes instead:
```tsx
{/* Switch: Takes effect immediately */}
<Switch id="wifi" /> Enable WiFi

{/* Checkbox: Requires form submission */}
<Checkbox id="terms" /> I agree to terms
```
:::

## Styling

### CSS Variables

The Switch component uses these CSS variables from your theme:

```css
--primary            /* Checked state background */
--input              /* Unchecked state background */
--background         /* Thumb color (light mode) */
--foreground         /* Thumb color (dark mode, unchecked) */
--primary-foreground /* Thumb color (dark mode, checked) */
--ring               /* Focus ring color */
```

### Visual States

The switch has distinct visual states:

- **Unchecked**: Gray background (`bg-input`), thumb at left
- **Checked**: Primary background, thumb at right
- **Focus**: 3px ring around switch
- **Disabled**: Reduced opacity, no interaction
- **Dark Mode**: Adjusted backgrounds and thumb colors

### Animation

The switch features smooth animations:
- **Thumb transition**: Slides smoothly between positions
- **Background transition**: Fades between colors
- **All transitions**: Use `transition-all` for fluid state changes

### Customization

Override styles using className:

```tsx
<Switch className="scale-110 data-[state=checked]:bg-green-600" />
```

### Dark Mode Support

The switch automatically adapts to dark mode:
- Unchecked: `dark:bg-input/80`
- Thumb colors: `dark:data-[state=unchecked]:bg-foreground`
- Proper contrast maintained

## Common Patterns

### Settings Panel

Complete settings interface with switches:

```tsx
import { useState } from 'react'
import { Switch, Label, Separator } from '@venizia/ardor-admin'

function SettingsPanel() {
  const [settings, setSettings] = useState({
    notifications: true,
    sounds: false,
    updates: true,
  })

  const updateSetting = (key: keyof typeof settings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h3 className="text-lg font-medium">Settings</h3>
        <p className="text-sm text-muted-foreground">
          Manage your application preferences
        </p>
      </div>
      <Separator />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications">Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Receive push notifications
            </p>
          </div>
          <Switch
            id="notifications"
            checked={settings.notifications}
            onCheckedChange={(checked) =>
              updateSetting('notifications', checked)
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="sounds">Sound Effects</Label>
            <p className="text-sm text-muted-foreground">
              Play sounds for actions
            </p>
          </div>
          <Switch
            id="sounds"
            checked={settings.sounds}
            onCheckedChange={(checked) => updateSetting('sounds', checked)}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="updates">Auto Updates</Label>
            <p className="text-sm text-muted-foreground">
              Automatically update the app
            </p>
          </div>
          <Switch
            id="updates"
            checked={settings.updates}
            onCheckedChange={(checked) => updateSetting('updates', checked)}
          />
        </div>
      </div>
    </div>
  )
}
```

### Feature Toggles

Enable/disable features dynamically:

```tsx
import { useState } from 'react'
import { Switch, Label, Badge } from '@venizia/ardor-admin'

function FeatureToggles() {
  const [features, setFeatures] = useState({
    betaFeatures: false,
    analytics: true,
    experimentalUI: false,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="beta">Beta Features</Label>
          <Badge variant="secondary">New</Badge>
        </div>
        <Switch
          id="beta"
          checked={features.betaFeatures}
          onCheckedChange={(checked) =>
            setFeatures({ ...features, betaFeatures: checked })
          }
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="analytics">Analytics</Label>
        <Switch
          id="analytics"
          checked={features.analytics}
          onCheckedChange={(checked) =>
            setFeatures({ ...features, analytics: checked })
          }
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="experimental">Experimental UI</Label>
          <Badge variant="destructive">Unstable</Badge>
        </div>
        <Switch
          id="experimental"
          checked={features.experimentalUI}
          onCheckedChange={(checked) =>
            setFeatures({ ...features, experimentalUI: checked })
          }
        />
      </div>
    </div>
  )
}
```

### Dark Mode Toggle

Complete dark mode implementation:

```tsx
import { useState, useEffect } from 'react'
import { Switch, Label } from '@venizia/ardor-admin'
import { Moon, Sun } from 'lucide-react'

function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Initialize from localStorage or system preference
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDark(stored === 'dark' || (!stored && prefersDark))
  }, [])

  useEffect(() => {
    // Apply theme
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  return (
    <div className="flex items-center space-x-3">
      <Sun className="h-4 w-4" />
      <Switch
        id="dark-mode"
        checked={isDark}
        onCheckedChange={setIsDark}
      />
      <Moon className="h-4 w-4" />
      <Label htmlFor="dark-mode" className="sr-only">
        Toggle dark mode
      </Label>
    </div>
  )
}
```

### Privacy Settings

Grouped privacy controls:

```tsx
import { useState } from 'react'
import { Switch, Label, Card, CardHeader, CardTitle, CardContent } from '@venizia/ardor-admin'

function PrivacySettings() {
  const [privacy, setPrivacy] = useState({
    profileVisible: true,
    showEmail: false,
    allowMessages: true,
    showActivity: false,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacy Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="profile">Public Profile</Label>
            <p className="text-sm text-muted-foreground">
              Make your profile visible to everyone
            </p>
          </div>
          <Switch
            id="profile"
            checked={privacy.profileVisible}
            onCheckedChange={(checked) =>
              setPrivacy({ ...privacy, profileVisible: checked })
            }
          />
        </div>
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="email">Show Email</Label>
            <p className="text-sm text-muted-foreground">
              Display email on your profile
            </p>
          </div>
          <Switch
            id="email"
            checked={privacy.showEmail}
            onCheckedChange={(checked) =>
              setPrivacy({ ...privacy, showEmail: checked })
            }
          />
        </div>
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="messages">Direct Messages</Label>
            <p className="text-sm text-muted-foreground">
              Allow others to message you
            </p>
          </div>
          <Switch
            id="messages"
            checked={privacy.allowMessages}
            onCheckedChange={(checked) =>
              setPrivacy({ ...privacy, allowMessages: checked })
            }
          />
        </div>
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="activity">Show Activity</Label>
            <p className="text-sm text-muted-foreground">
              Let others see when you're online
            </p>
          </div>
          <Switch
            id="activity"
            checked={privacy.showActivity}
            onCheckedChange={(checked) =>
              setPrivacy({ ...privacy, showActivity: checked })
            }
          />
        </div>
      </CardContent>
    </Card>
  )
}
```

## Related Components

- [Checkbox](/components/checkbox) - For multi-select or form submission scenarios
- [Radio Group](/components/radio-group) - For single selection from multiple options
- [Select](/components/select) - For dropdown selections
- [Label](/components/label) - For accessible form labels
