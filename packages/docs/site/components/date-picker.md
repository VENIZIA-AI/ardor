# Date Picker

::: tip ARDOR Feature
Date Picker is an ARDOR form component that combines Calendar and Popover with integrated label, helper text, and error handling. Uses dayjs for date formatting with YYYY-MM-DD value format.
:::

A complete date picker field component combining calendar selection with form integration. Includes label, helper text, error messages, and formatted date display.

## Installation

```bash
bun add @venizia/ardor-admin dayjs
```

Note: dayjs is a peer dependency required for date formatting.

## Usage

```tsx
import { DatePicker } from '@venizia/ardor-admin'

export default function Example() {
  const [date, setDate] = useState<string>('')

  return (
    <DatePicker
      label="Select date"
      value={date}
      onChange={setDate}
    />
  )
}
```

## Examples

### Basic Date Picker

Simple date picker with label:

```tsx
function BasicExample() {
  const [date, setDate] = useState('')

  return (
    <DatePicker
      label="Birth date"
      value={date}
      onChange={setDate}
    />
  )
}
```

### With Placeholder

Custom placeholder text:

```tsx
<DatePicker
  label="Appointment date"
  placeholder="Choose a date"
  value={date}
  onChange={setDate}
/>
```

### Required Field

Mark field as required:

```tsx
<DatePicker
  label="Start date"
  required
  value={date}
  onChange={setDate}
/>
```

### With Helper Text

Provide additional context:

```tsx
<DatePicker
  label="Event date"
  helperText="Choose when the event will take place"
  value={date}
  onChange={setDate}
/>
```

### With Error

Display validation error:

```tsx
<DatePicker
  label="Due date"
  value={date}
  onChange={setDate}
  error
  errorText={[{ message: 'Please select a valid date' }]}
/>
```

### Disabled State

Disabled date picker:

```tsx
<DatePicker
  label="Locked date"
  value="2024-12-25"
  disabled
/>
```

### Controlled Date Picker

Full control with state and validation:

```tsx
function ControlledExample() {
  const [date, setDate] = useState('')
  const [error, setError] = useState(false)

  const handleDateChange = (newDate: string | null) => {
    setDate(newDate || '')

    // Validate: date must be in the future
    if (newDate) {
      const selected = new Date(newDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      setError(selected < today)
    } else {
      setError(false)
    }
  }

  return (
    <DatePicker
      label="Future date"
      value={date}
      onChange={handleDateChange}
      error={error}
      errorText={error ? [{ message: 'Date must be in the future' }] : undefined}
      helperText="Select a date after today"
    />
  )
}
```

### Date Range Selection

Two date pickers for start and end dates:

```tsx
function DateRangeExample() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  return (
    <div className="grid grid-cols-2 gap-4">
      <DatePicker
        label="Start date"
        value={startDate}
        onChange={setStartDate}
        required
      />
      <DatePicker
        label="End date"
        value={endDate}
        onChange={setEndDate}
        required
      />
    </div>
  )
}
```

### Form Integration

Date picker in validated form:

```tsx
function EventForm() {
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: Record<string, string> = {}

    if (!formData.title) {
      newErrors.title = 'Title is required'
    }
    if (!formData.date) {
      newErrors.date = 'Date is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Submit form
    console.log('Form submitted:', formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextField
        label="Event title"
        required
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        error={!!errors.title}
        errorText={errors.title ? [{ message: errors.title }] : undefined}
      />

      <DatePicker
        label="Event date"
        required
        value={formData.date}
        onChange={(date) => setFormData({ ...formData, date: date || '' })}
        error={!!errors.date}
        errorText={errors.date ? [{ message: errors.date }] : undefined}
      />

      <TextField
        label="Event time"
        type="time"
        value={formData.time}
        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
      />

      <Button type="submit">Create Event</Button>
    </form>
  )
}
```

### Birthday Selector

Date picker for birthdays with year range:

```tsx
function BirthdayPicker() {
  const [birthday, setBirthday] = useState('')

  return (
    <DatePicker
      label="Date of birth"
      placeholder="Select your birthday"
      value={birthday}
      onChange={setBirthday}
      helperText="You must be at least 18 years old"
    />
  )
}
```

### Appointment Booking

Date picker with available dates logic:

```tsx
function AppointmentBooking() {
  const [selectedDate, setSelectedDate] = useState('')
  const availableDates = ['2024-12-20', '2024-12-21', '2024-12-23']

  const isDateAvailable = (date: string) => {
    return availableDates.includes(date)
  }

  const handleDateChange = (date: string | null) => {
    if (date && !isDateAvailable(date)) {
      // Show error or warning
      return
    }
    setSelectedDate(date || '')
  }

  return (
    <DatePicker
      label="Appointment date"
      value={selectedDate}
      onChange={handleDateChange}
      helperText="Select from available dates"
    />
  )
}
```

### Multiple Date Pickers

Form with multiple date fields:

```tsx
function ProjectForm() {
  const [dates, setDates] = useState({
    start: '',
    milestone1: '',
    milestone2: '',
    end: '',
  })

  return (
    <div className="space-y-4">
      <DatePicker
        label="Project start date"
        required
        value={dates.start}
        onChange={(date) => setDates({ ...dates, start: date || '' })}
      />

      <div className="grid grid-cols-2 gap-4">
        <DatePicker
          label="Milestone 1"
          value={dates.milestone1}
          onChange={(date) => setDates({ ...dates, milestone1: date || '' })}
          helperText="First checkpoint"
        />
        <DatePicker
          label="Milestone 2"
          value={dates.milestone2}
          onChange={(date) => setDates({ ...dates, milestone2: date || '' })}
          helperText="Second checkpoint"
        />
      </div>

      <DatePicker
        label="Project end date"
        required
        value={dates.end}
        onChange={(date) => setDates({ ...dates, end: date || '' })}
      />
    </div>
  )
}
```

## API Reference

### DatePicker

Complete date picker field component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `string` | - | Input element ID |
| `name` | `string` | - | Input name attribute |
| `label` | `ReactNode` | - | Field label text |
| `placeholder` | `string` | `"Select date"` | Button placeholder text |
| `required` | `boolean` | `false` | Mark field as required |
| `disabled` | `boolean` | `false` | Disable date picker |
| `value` | `string` | - | Selected date (YYYY-MM-DD format) |
| `onChange` | `(date: string \| null) => void` | - | Date change handler |
| `helperText` | `ReactNode` | - | Helper text below field |
| `error` | `boolean` | `false` | Show error state |
| `errorText` | `Array<{message?: string}>` | - | Error messages to display |

### Value Format

The `value` prop and `onChange` callback use `YYYY-MM-DD` format:
- Example: `"2024-12-25"`
- Null when no date selected
- Formatted using dayjs internally

### Error Text Format

```tsx
errorText={[
  { message: 'Date is required' },
  { message: 'Date must be in the future' },
]}
```

## Accessibility

DatePicker maintains full accessibility:

### Form Accessibility

- Proper label association via `htmlFor`
- Required fields marked with asterisk
- Error messages linked via `aria-invalid`
- Button trigger keyboard accessible

### Calendar Accessibility

- Full keyboard navigation in calendar
- Arrow keys to navigate dates
- Space/Enter to select date
- Escape to close popover
- Screen reader announces dates

### Best Practices

::: tip
Always provide labels:
```tsx
{/* Good - Clear label */}
<DatePicker
  label="Event date"
  value={date}
  onChange={setDate}
/>

{/* Bad - No label */}
<DatePicker
  placeholder="Pick a date"
  value={date}
  onChange={setDate}
/>
```
:::

::: tip
Handle null values properly:
```tsx
{/* Good - Handle null */}
<DatePicker
  value={date}
  onChange={(newDate) => setDate(newDate || '')}
/>

{/* Bad - Don't handle null */}
<DatePicker
  value={date}
  onChange={setDate}
/>
```
:::

## Styling

### CSS Variables

DatePicker uses semantic color tokens from Field, Button, Popover, and Calendar:

```css
--input              /* Button border */
--ring               /* Focus ring */
--destructive        /* Error state */
--muted-foreground   /* Helper text, placeholder */
--primary            /* Selected date */
```

### Date Display Format

Date is displayed using dayjs format `'L'` (localized date):
- US: 12/25/2024
- EU: 25/12/2024
- ISO: 2024-12-25

Can be customized by modifying the format in the component.

### Customization

```tsx
{/* Custom button width */}
<DatePicker
  label="Date"
  value={date}
  onChange={setDate}
  className="w-full"
/>

{/* Custom popover alignment */}
<DatePicker
  label="Date"
  value={date}
  onChange={setDate}
  // Popover opens aligned to start
/>
```

### Dark Mode

- Automatically adapts via CSS variables
- Calendar readable in both themes
- Error states maintain contrast

## Common Patterns

### Min/Max Date Validation

```tsx
function ValidatedDatePicker() {
  const [date, setDate] = useState('')
  const [error, setError] = useState('')

  const minDate = new Date('2024-01-01')
  const maxDate = new Date('2024-12-31')

  const handleDateChange = (newDate: string | null) => {
    if (!newDate) {
      setDate('')
      setError('')
      return
    }

    const selected = new Date(newDate)

    if (selected < minDate || selected > maxDate) {
      setError('Date must be in 2024')
      return
    }

    setDate(newDate)
    setError('')
  }

  return (
    <DatePicker
      label="Select date in 2024"
      value={date}
      onChange={handleDateChange}
      error={!!error}
      errorText={error ? [{ message: error }] : undefined}
      helperText="Must be between Jan 1 and Dec 31, 2024"
    />
  )
}
```

### Date Comparison

```tsx
function DateRangeForm() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')

  const handleEndDateChange = (newEndDate: string | null) => {
    if (!newEndDate) {
      setEndDate('')
      setError('')
      return
    }

    if (startDate && new Date(newEndDate) < new Date(startDate)) {
      setError('End date must be after start date')
    } else {
      setError('')
    }

    setEndDate(newEndDate)
  }

  return (
    <div className="space-y-4">
      <DatePicker
        label="Start date"
        value={startDate}
        onChange={setStartDate}
      />
      <DatePicker
        label="End date"
        value={endDate}
        onChange={handleEndDateChange}
        error={!!error}
        errorText={error ? [{ message: error }] : undefined}
      />
    </div>
  )
}
```

### Date with Time

```tsx
function DateTimeForm() {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  const combinedDateTime = date && time ? `${date}T${time}` : ''

  return (
    <div className="space-y-4">
      <DatePicker
        label="Date"
        value={date}
        onChange={setDate}
      />
      <TextField
        label="Time"
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
      />
      {combinedDateTime && (
        <p className="text-sm text-muted-foreground">
          Selected: {new Date(combinedDateTime).toLocaleString()}
        </p>
      )}
    </div>
  )
}
```

## Related Components

- [Calendar](/components/calendar) - Underlying calendar component
- [Popover](/components/popover) - Popover container
- [Button](/components/button) - Trigger button
- [Field](/components/field) - Field wrapper
- [TextField](/components/text-field) - Alternative text input
