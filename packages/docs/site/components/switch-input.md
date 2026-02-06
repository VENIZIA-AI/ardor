# Switch Input

::: tip ARDOR Feature
Switch Input is an ARDOR form component that wraps the Switch with integrated label, helper text, error handling, and flexible orientation. Perfect for on/off toggles with complete form integration.
:::

A complete switch field component combining toggle switch with label, helper text, and error messages. Supports multiple orientations for flexible layouts.

## Installation

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { SwitchInput } from '@venizia/ardor-admin'

export default function Example() {
  return (
    <SwitchInput
      label="Enable notifications"
    />
  )
}
```

## Examples

### Basic Switch

Simple switch with label:

```tsx
<SwitchInput
  id="notifications"
  label="Push notifications"
/>
```

### With Helper Text

Switch with descriptive text:

```tsx
<SwitchInput
  label="Marketing emails"
  helperText="Receive updates about new features and offers"
/>
```

### Required Switch

Mark switch as required:

```tsx
<SwitchInput
  label="Accept terms"
  required
/>
```

### With Error

Display validation error:

```tsx
<SwitchInput
  label="Enable two-factor authentication"
  error
  errorText={[{ message: 'Two-factor authentication is required for admin users' }]}
/>
```

### Horizontal Orientation

Switch on left, label on right (default):

```tsx
<SwitchInput
  label="Enable dark mode"
  orientation="horizontal"
/>
```

### Vertical Orientation

Label above switch:

```tsx
<SwitchInput
  label="Auto-save"
  helperText="Automatically save your work every 5 minutes"
  orientation="vertical"
/>
```

### Horizontal Reverse

Label on left, switch on right:

```tsx
<SwitchInput
  label="Wi-Fi"
  orientation="horizontal-reverse"
/>
```

### Controlled Switch

Controlled switch with state:

```tsx
function ControlledExample() {
  const [enabled, setEnabled] = useState(false)

  return (
    <div className="space-y-4">
      <SwitchInput
        label="Enable feature"
        checked={enabled}
        onCheckedChange={setEnabled}
      />
      <p className="text-sm text-muted-foreground">
        Feature is currently {enabled ? 'enabled' : 'disabled'}
      </p>
    </div>
  )
}
```

### Disabled Switch

Disabled states:

```tsx
<div className="space-y-3">
  <SwitchInput
    label="Disabled unchecked"
    disabled
  />
  <SwitchInput
    label="Disabled checked"
    disabled
    checked
  />
</div>
```

### Settings Panel

Group of switches for settings:

```tsx
function SettingsPanel() {
  const [settings, setSettings] = useState({
    notifications: true,
    autoSave: false,
    darkMode: true,
    sounds: false,
  })

  return (
    <div className="space-y-4">
      <h3 className="font-semibold mb-4">Preferences</h3>

      <SwitchInput
        label="Notifications"
        helperText="Receive desktop notifications"
        checked={settings.notifications}
        onCheckedChange={(checked) =>
          setSettings({ ...settings, notifications: checked })
        }
        orientation="horizontal-reverse"
      />

      <SwitchInput
        label="Auto-save"
        helperText="Automatically save changes"
        checked={settings.autoSave}
        onCheckedChange={(checked) =>
          setSettings({ ...settings, autoSave: checked })
        }
        orientation="horizontal-reverse"
      />

      <SwitchInput
        label="Dark mode"
        helperText="Use dark color scheme"
        checked={settings.darkMode}
        onCheckedChange={(checked) =>
          setSettings({ ...settings, darkMode: checked })
        }
        orientation="horizontal-reverse"
      />

      <SwitchInput
        label="Sound effects"
        helperText="Play sounds for actions"
        checked={settings.sounds}
        onCheckedChange={(checked) =>
          setSettings({ ...settings, sounds: checked })
        }
        orientation="horizontal-reverse"
      />
    </div>
  )
}
```

### Confirmation Switch

Switch with confirmation dialog:

```tsx
function ConfirmationSwitch() {
  const [enabled, setEnabled] = useState(false)
  const [showDialog, setShowDialog] = useState(false)

  const handleChange = (checked: boolean) => {
    if (checked) {
      setShowDialog(true)
    } else {
      setEnabled(false)
    }
  }

  const handleConfirm = () => {
    setEnabled(true)
    setShowDialog(false)
  }

  return (
    <>
      <SwitchInput
        label="Delete account"
        helperText="Permanently delete your account and all data"
        checked={enabled}
        onCheckedChange={handleChange}
      />

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All your data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

### Feature Toggle with Dependencies

Switches with dependent states:

```tsx
function FeatureToggles() {
  const [features, setFeatures] = useState({
    analytics: false,
    advancedAnalytics: false,
    customReports: false,
  })

  return (
    <div className="space-y-4">
      <SwitchInput
        label="Analytics"
        helperText="Enable basic analytics tracking"
        checked={features.analytics}
        onCheckedChange={(checked) => {
          setFeatures({
            analytics: checked,
            advancedAnalytics: checked ? features.advancedAnalytics : false,
            customReports: checked ? features.customReports : false,
          })
        }}
        orientation="horizontal-reverse"
      />

      <div className="pl-6 space-y-4 border-l-2">
        <SwitchInput
          label="Advanced Analytics"
          helperText="Detailed metrics and insights"
          checked={features.advancedAnalytics}
          onCheckedChange={(checked) =>
            setFeatures({ ...features, advancedAnalytics: checked })
          }
          disabled={!features.analytics}
          orientation="horizontal-reverse"
        />

        <SwitchInput
          label="Custom Reports"
          helperText="Create custom analytics reports"
          checked={features.customReports}
          onCheckedChange={(checked) =>
            setFeatures({ ...features, customReports: checked })
          }
          disabled={!features.analytics}
          orientation="horizontal-reverse"
        />
      </div>
    </div>
  )
}
```

### Card with Toggle

Switch in card header:

```tsx
function ToggleCard() {
  const [enabled, setEnabled] = useState(false)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Feature Name</CardTitle>
            <CardDescription>
              Enable or disable this feature
            </CardDescription>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </CardHeader>
      {enabled && (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Feature is now active. Additional settings will appear here.
          </p>
        </CardContent>
      )}
    </Card>
  )
}
```

## API Reference

### SwitchInput

Complete switch field component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `string` | - | Switch element ID |
| `label` | `ReactNode` | - | Label text or content |
| `checked` | `boolean` | - | Controlled checked state |
| `onCheckedChange` | `(checked: boolean) => void` | - | Change handler |
| `disabled` | `boolean` | `false` | Disable switch |
| `required` | `boolean` | `false` | Mark as required |
| `orientation` | `"vertical" \| "horizontal" \| "horizontal-reverse"` | `"horizontal"` | Label/switch layout |
| `helperText` | `ReactNode` | - | Helper text below field |
| `error` | `boolean` | `false` | Show error state |
| `errorText` | `Array<{message?: string}>` | - | Error messages to display |

Extends all Radix UI Switch.Root props.

### Orientation Values

- **`"vertical"`** - Label above switch (stacked)
- **`"horizontal"`** - Switch on left, label on right
- **`"horizontal-reverse"`** - Label on left, switch on right (common in settings)

### Error Text Format

```tsx
errorText={[
  { message: 'This setting is required' },
]}
```

## Accessibility

SwitchInput maintains full accessibility:

### Switch Accessibility

- Proper label association via `htmlFor`
- Keyboard accessible (Space to toggle)
- ARIA attributes for state
- Error messages linked

### Screen Reader Support

- Label announced with switch
- On/off state announced
- Helper text readable
- Error messages announced

### Keyboard Interactions

- **Space** - Toggle switch state
- **Tab** - Navigate to/from switch
- Standard switch keyboard behavior

### Best Practices

::: tip
Use switches for immediate state changes:
```tsx
{/* Good - Immediate effect */}
<SwitchInput
  label="Dark mode"
  checked={isDarkMode}
  onCheckedChange={setIsDarkMode}
/>

{/* Bad - Use checkbox for form submission */}
<form onSubmit={handleSubmit}>
  <SwitchInput label="Subscribe" />
  <Button type="submit">Save</Button>
</form>
```
:::

::: tip
Provide clear labels describing the state:
```tsx
{/* Good - Clear what it toggles */}
<SwitchInput label="Enable notifications" />

{/* Bad - Ambiguous */}
<SwitchInput label="Notifications" />
```
:::

## Styling

### CSS Variables

SwitchInput uses semantic color tokens from Switch and Field:

```css
--input              /* Switch background (unchecked) */
--primary            /* Switch background (checked) */
--primary-foreground /* Switch thumb color */
--ring               /* Focus ring */
--destructive        /* Error state */
--muted-foreground   /* Helper text */
```

### Customization

```tsx
{/* Full width label in reverse orientation */}
<SwitchInput
  label="Full width toggle"
  orientation="horizontal-reverse"
  className="w-full"
/>

{/* Custom label styling */}
<SwitchInput
  label={
    <span className="text-lg font-semibold">
      Important Setting
    </span>
  }
/>

{/* Compact spacing */}
<div className="space-y-2">
  <SwitchInput label="Option 1" />
  <SwitchInput label="Option 2" />
</div>
```

### Dark Mode

- Automatically adapts via CSS variables
- Switch state clearly visible in both themes
- Error states maintain proper contrast

## Common Patterns

### Theme Toggle

```tsx
function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  return (
    <SwitchInput
      label="Dark mode"
      checked={isDark}
      onCheckedChange={setIsDark}
      orientation="horizontal-reverse"
    />
  )
}
```

### Notification Settings

```tsx
function NotificationSettings() {
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    sms: false,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Choose how you want to be notified
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SwitchInput
          label="Email notifications"
          helperText="Receive notifications via email"
          checked={notifications.email}
          onCheckedChange={(checked) =>
            setNotifications({ ...notifications, email: checked })
          }
          orientation="horizontal-reverse"
        />
        <SwitchInput
          label="Push notifications"
          helperText="Receive browser push notifications"
          checked={notifications.push}
          onCheckedChange={(checked) =>
            setNotifications({ ...notifications, push: checked })
          }
          orientation="horizontal-reverse"
        />
        <SwitchInput
          label="SMS notifications"
          helperText="Receive text message alerts"
          checked={notifications.sms}
          onCheckedChange={(checked) =>
            setNotifications({ ...notifications, sms: checked })
          }
          orientation="horizontal-reverse"
        />
      </CardContent>
    </Card>
  )
}
```

### Privacy Controls

```tsx
function PrivacyControls() {
  const [privacy, setPrivacy] = useState({
    profileVisible: true,
    emailVisible: false,
    activityTracking: true,
  })

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Privacy Settings</h3>
        <div className="space-y-4">
          <SwitchInput
            label="Public profile"
            helperText="Make your profile visible to other users"
            checked={privacy.profileVisible}
            onCheckedChange={(checked) =>
              setPrivacy({ ...privacy, profileVisible: checked })
            }
            orientation="horizontal-reverse"
          />
          <SwitchInput
            label="Show email address"
            helperText="Display your email on your profile"
            checked={privacy.emailVisible}
            disabled={!privacy.profileVisible}
            onCheckedChange={(checked) =>
              setPrivacy({ ...privacy, emailVisible: checked })
            }
            orientation="horizontal-reverse"
          />
          <SwitchInput
            label="Activity tracking"
            helperText="Allow us to track your activity to improve your experience"
            checked={privacy.activityTracking}
            onCheckedChange={(checked) =>
              setPrivacy({ ...privacy, activityTracking: checked })
            }
            orientation="horizontal-reverse"
          />
        </div>
      </div>
    </div>
  )
}
```

## Related Components

- [Switch](/components/switch) - Base switch component
- [Field](/components/field) - Field wrapper component
- [Checkbox Input](/components/checkbox-input) - Alternative toggle input
- [Radio Group](/components/radio-group) - For exclusive selections
