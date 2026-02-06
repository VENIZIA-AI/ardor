# Calendar

A date picker component that displays a calendar for selecting dates. Built with react-day-picker library with extensive customization and range selection support.

## Installation

```bash
bunx shadcn@latest add calendar
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import { useState } from 'react'
import { Calendar } from '@venizia/ardor-admin'

export default function Example() {
  const [date, setDate] = useState<Date | undefined>(new Date())

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      className="rounded-md border"
    />
  )
}
```

## Examples

### Basic Calendar

Simple single date selection:

```tsx
import { useState } from 'react'

function BasicCalendar() {
  const [date, setDate] = useState<Date>()

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      className="rounded-md border"
    />
  )
}
```

### Date Range Selection

Select a date range:

```tsx
import { useState } from 'react'
import type { DateRange } from 'react-day-picker'

function RangeCalendar() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  return (
    <Calendar
      mode="range"
      selected={dateRange}
      onSelect={setDateRange}
      numberOfMonths={2}
      className="rounded-md border"
    />
  )
}
```

### Multiple Date Selection

Select multiple dates:

```tsx
import { useState } from 'react'

function MultipleCalendar() {
  const [dates, setDates] = useState<Date[] | undefined>([])

  return (
    <Calendar
      mode="multiple"
      selected={dates}
      onSelect={setDates}
      className="rounded-md border"
    />
  )
}
```

### With Disabled Dates

Disable specific dates or date ranges:

```tsx
import { useState } from 'react'

function DisabledDatesCalendar() {
  const [date, setDate] = useState<Date>()

  const disabledDays = [
    new Date(2024, 11, 25), // Christmas
    { from: new Date(2024, 11, 24), to: new Date(2024, 11, 26) }
  ]

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      disabled={disabledDays}
      className="rounded-md border"
    />
  )
}
```

### Disable Past Dates

Prevent selection of past dates:

```tsx
import { useState } from 'react'

function FutureDatesOnly() {
  const [date, setDate] = useState<Date>()

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      disabled={(date) => date < new Date()}
      className="rounded-md border"
    />
  )
}
```

### With Month/Year Dropdowns

Navigate months and years with dropdowns:

```tsx
import { useState } from 'react'

function DropdownCalendar() {
  const [date, setDate] = useState<Date>()

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      captionLayout="dropdown"
      fromYear={2000}
      toYear={2030}
      className="rounded-md border"
    />
  )
}
```

### Show Week Numbers

Display week numbers:

```tsx
import { useState } from 'react'

function WeekNumbersCalendar() {
  const [date, setDate] = useState<Date>()

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      showWeekNumber
      className="rounded-md border"
    />
  )
}
```

### Multiple Months

Display multiple months side by side:

```tsx
import { useState } from 'react'

function MultiMonthCalendar() {
  const [date, setDate] = useState<Date>()

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      numberOfMonths={3}
      className="rounded-md border"
    />
  )
}
```

### In Popover

Calendar inside a popover for date input:

```tsx
import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@venizia/ardor-admin'

function DatePicker() {
  const [date, setDate] = useState<Date>()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[240px] justify-start text-left">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'PPP') : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
```

### Date Range Picker

Date range in popover:

```tsx
import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import type { DateRange } from 'react-day-picker'

function DateRangePicker() {
  const [date, setDate] = useState<DateRange | undefined>()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[300px] justify-start text-left">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date?.from ? (
            date.to ? (
              <>
                {format(date.from, 'LLL dd, y')} - {format(date.to, 'LLL dd, y')}
              </>
            ) : (
              format(date.from, 'LLL dd, y')
            )
          ) : (
            <span>Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={date}
          onSelect={setDate}
          numberOfMonths={2}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
```

## API Reference

### Calendar

Date picker component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mode` | `"single" \| "multiple" \| "range"` | - | Selection mode (required) |
| `selected` | `Date \| Date[] \| DateRange` | - | Selected date(s) |
| `onSelect` | `(date) => void` | - | Callback when selection changes |
| `disabled` | `Date \| Date[] \| Matcher \| Matcher[]` | - | Dates to disable |
| `numberOfMonths` | `number` | `1` | Number of months to display |
| `showOutsideDays` | `boolean` | `true` | Show days from adjacent months |
| `showWeekNumber` | `boolean` | `false` | Show week numbers |
| `captionLayout` | `"label" \| "dropdown"` | `"label"` | Caption layout style |
| `fromYear` | `number` | - | Start year for dropdown |
| `toYear` | `number` | - | End year for dropdown |
| `fromDate` | `Date` | - | Earliest selectable date |
| `toDate` | `Date` | - | Latest selectable date |
| `defaultMonth` | `Date` | - | Initial month to display |
| `initialFocus` | `boolean` | `false` | Auto-focus on mount |
| `buttonVariant` | `ButtonVariant` | `"ghost"` | Button variant for navigation |
| `className` | `string` | - | Additional CSS classes |

### Date Matchers

The `disabled` prop accepts various matchers:

```tsx
// Single date
disabled={new Date(2024, 11, 25)}

// Array of dates
disabled={[new Date(2024, 11, 25), new Date(2024, 11, 31)]}

// Date range
disabled={{ from: new Date(2024, 11, 24), to: new Date(2024, 11, 26) }}

// Function matcher
disabled={(date) => date.getDay() === 0 || date.getDay() === 6} // Weekends

// Multiple matchers
disabled={[
  { from: new Date(2024, 11, 24), to: new Date(2024, 11, 26) },
  (date) => date.getDay() === 0
]}
```

### Data Attributes

- `data-slot="calendar"` - Root calendar element
- `data-selected="true"` - Selected date
- `data-today="true"` - Today's date
- `data-outside="true"` - Days from adjacent months
- `data-disabled="true"` - Disabled dates

## Accessibility

Calendar follows accessibility best practices:

### Keyboard Interactions

- **Arrow Keys** - Navigate between dates
- **Home** - Go to start of week
- **End** - Go to end of week
- **Page Up** - Go to previous month
- **Page Down** - Go to next month
- **Shift + Page Up** - Go to previous year
- **Shift + Page Down** - Go to next year
- **Enter/Space** - Select focused date
- **Escape** - Close calendar (in popover)

### Screen Reader Support

- Proper ARIA attributes
- Selected dates announced
- Disabled dates indicated
- Month/year changes announced

### Focus Management

- Clear focus indicators
- Keyboard navigation throughout
- Auto-focus on `initialFocus` prop

### Best Practices

::: tip
Always provide labels for date inputs:
```tsx
<div>
  <Label htmlFor="date-picker">Select Date</Label>
  <Popover>
    <PopoverTrigger asChild>
      <Button id="date-picker" variant="outline">
        {date ? format(date, 'PPP') : 'Pick a date'}
      </Button>
    </PopoverTrigger>
    <PopoverContent>
      <Calendar mode="single" selected={date} onSelect={setDate} />
    </PopoverContent>
  </Popover>
</div>
```
:::

::: tip
Use format functions for consistent date display:
```tsx
import { format } from 'date-fns'

// Good - formatted date
{date && format(date, 'PPP')}

// Bad - raw date string
{date?.toString()}
```
:::

## Styling

### CSS Variables

Calendar uses semantic color tokens:

```css
--background         /* Calendar background */
--foreground         /* Text color */
--accent             /* Today's date background */
--accent-foreground  /* Today's text color */
--primary            /* Selected date background */
--primary-foreground /* Selected text color */
--muted-foreground   /* Outside days, disabled */
--border             /* Cell borders */
```

### Customization

```tsx
{/* Custom button variant */}
<Calendar buttonVariant="outline" />

{/* Custom styling */}
<Calendar className="rounded-xl shadow-lg" />

{/* Custom cell size */}
<Calendar className="[--cell-size:theme(spacing.12)]" />
```

### Dark Mode

- Automatically adapts via CSS variables
- Proper contrast in both themes
- Focus states remain visible

## Common Patterns

### Booking System

```tsx
function BookingCalendar() {
  const [date, setDate] = useState<Date>()

  const bookedDates = [
    new Date(2024, 11, 25),
    new Date(2024, 11, 26),
  ]

  const isBooked = (date: Date) =>
    bookedDates.some(d => d.toDateString() === date.toDateString())

  return (
    <div className="space-y-4">
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        disabled={(date) => date < new Date() || isBooked(date)}
        className="rounded-md border"
      />
      {date && (
        <div className="p-4 border rounded-md">
          <p>Selected: {format(date, 'PPPP')}</p>
          <Button className="mt-2">Book this date</Button>
        </div>
      )}
    </div>
  )
}
```

### Event Calendar

```tsx
function EventCalendar() {
  const [date, setDate] = useState<Date>()

  const events = [
    { date: new Date(2024, 11, 25), title: 'Team Meeting' },
    { date: new Date(2024, 11, 28), title: 'Project Deadline' },
  ]

  const getEventsForDate = (date: Date) =>
    events.filter(e => e.date.toDateString() === date.toDateString())

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        modifiers={{
          hasEvent: events.map(e => e.date)
        }}
        modifiersClassNames={{
          hasEvent: 'bg-primary/20'
        }}
        className="rounded-md border"
      />
      <div className="border rounded-md p-4">
        <h3 className="font-semibold mb-4">
          {date ? format(date, 'PPPP') : 'Select a date'}
        </h3>
        {date && (
          <div className="space-y-2">
            {getEventsForDate(date).map((event, i) => (
              <div key={i} className="p-2 bg-muted rounded">
                {event.title}
              </div>
            ))}
            {getEventsForDate(date).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No events on this day
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

### Vacation Planner

```tsx
function VacationPlanner() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  const calculateDays = (range: DateRange | undefined) => {
    if (!range?.from || !range?.to) return 0
    const days = Math.ceil(
      (range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)
    )
    return days + 1
  }

  return (
    <div className="space-y-4">
      <Calendar
        mode="range"
        selected={dateRange}
        onSelect={setDateRange}
        numberOfMonths={2}
        disabled={(date) => date < new Date()}
        className="rounded-md border"
      />
      {dateRange?.from && (
        <div className="p-4 border rounded-md">
          <p className="font-semibold">Selected Range:</p>
          <p>{format(dateRange.from, 'PPP')}</p>
          {dateRange.to && (
            <>
              <p>to {format(dateRange.to, 'PPP')}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Total: {calculateDays(dateRange)} days
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

## Related Components

- [Popover](/components/popover) - Often used to contain calendar
- [Input](/components/input) - For manual date entry
- [Button](/components/button) - Trigger for calendar popover
- [Select](/components/select) - Alternative for date selection
