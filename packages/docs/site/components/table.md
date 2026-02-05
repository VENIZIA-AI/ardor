# Table

A flexible table component for displaying data in rows and columns with built-in responsive overflow handling.

## Installation

```bash
bunx shadcn@latest add table
```

Or install the full package:

```bash
bun add @venizia/ardor-admin
```

## Usage

```tsx
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@venizia/ardor-admin';

export default function Example() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>John Doe</TableCell>
          <TableCell>john@example.com</TableCell>
          <TableCell>$100.00</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
```

## Examples

### Basic Table

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Invoice</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Method</TableHead>
      <TableHead>Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>INV-001</TableCell>
      <TableCell>Paid</TableCell>
      <TableCell>Credit Card</TableCell>
      <TableCell>$250.00</TableCell>
    </TableRow>
    <TableRow>
      <TableCell>INV-002</TableCell>
      <TableCell>Pending</TableCell>
      <TableCell>Bank Transfer</TableCell>
      <TableCell>$150.00</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Table with Caption

```tsx
<Table>
  <TableCaption>A list of your recent invoices.</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Invoice</TableHead>
      <TableHead>Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>INV-001</TableCell>
      <TableCell>$250.00</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Table with Footer

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Item</TableHead>
      <TableHead>Price</TableHead>
      <TableHead>Qty</TableHead>
      <TableHead>Total</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Product A</TableCell>
      <TableCell>$50.00</TableCell>
      <TableCell>2</TableCell>
      <TableCell>$100.00</TableCell>
    </TableRow>
    <TableRow>
      <TableCell>Product B</TableCell>
      <TableCell>$30.00</TableCell>
      <TableCell>1</TableCell>
      <TableCell>$30.00</TableCell>
    </TableRow>
  </TableBody>
  <TableFooter>
    <TableRow>
      <TableCell colSpan={3}>Total</TableCell>
      <TableCell>$130.00</TableCell>
    </TableRow>
  </TableFooter>
</Table>
```

### Table with Dynamic Data

```tsx
import { users } from '@/data';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Email</TableHead>
      <TableHead>Role</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {users.map(user => (
      <TableRow key={user.id}>
        <TableCell>{user.name}</TableCell>
        <TableCell>{user.email}</TableCell>
        <TableCell>{user.role}</TableCell>
        <TableCell>{user.status}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>;
```

### Table with Actions

```tsx
import { Button } from '@venizia/ardor-admin';
import { Edit, Trash2 } from 'lucide-react';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Email</TableHead>
      <TableHead>Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {users.map(user => (
      <TableRow key={user.id}>
        <TableCell>{user.name}</TableCell>
        <TableCell>{user.email}</TableCell>
        <TableCell className='flex gap-2'>
          <Button size='icon-sm' variant='ghost'>
            <Edit className='h-4 w-4' />
          </Button>
          <Button size='icon-sm' variant='ghost'>
            <Trash2 className='h-4 w-4' />
          </Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>;
```

### Sortable Headers

```tsx
import { Button } from '@venizia/ardor-admin';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

function SortableHeader({ label, sort, onSort }) {
  return (
    <Button variant='ghost' onClick={() => onSort(label)} className='h-auto p-0 font-medium'>
      {label}
      {sort.key === label ? (
        sort.direction === 'asc' ? (
          <ArrowUp className='ml-2 h-4 w-4' />
        ) : (
          <ArrowDown className='ml-2 h-4 w-4' />
        )
      ) : (
        <ArrowUpDown className='ml-2 h-4 w-4 opacity-50' />
      )}
    </Button>
  );
}

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>
        <SortableHeader label='Name' sort={sort} onSort={handleSort} />
      </TableHead>
      <TableHead>Email</TableHead>
    </TableRow>
  </TableHeader>
  {/* Body */}
</Table>;
```

### Striped Rows

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Email</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {users.map((user, index) => (
      <TableRow key={user.id} className={index % 2 === 0 ? 'bg-muted/50' : ''}>
        <TableCell>{user.name}</TableCell>
        <TableCell>{user.email}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Hoverable Rows

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Email</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {users.map(user => (
      <TableRow key={user.id} className='cursor-pointer hover:bg-muted'>
        <TableCell>{user.name}</TableCell>
        <TableCell>{user.email}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Responsive Table

```tsx
<div className='w-full overflow-x-auto rounded-lg border'>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead className='hidden md:table-cell'>Email</TableHead>
        <TableHead className='hidden lg:table-cell'>Department</TableHead>
        <TableHead>Status</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {users.map(user => (
        <TableRow key={user.id}>
          <TableCell className='font-medium'>{user.name}</TableCell>
          <TableCell className='hidden md:table-cell'>{user.email}</TableCell>
          <TableCell className='hidden lg:table-cell'>{user.department}</TableCell>
          <TableCell>
            <Badge>{user.status}</Badge>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

## API Reference

### Table

Main table container with responsive overflow handling.

| Prop        | Type     | Default     | Description            |
| ----------- | -------- | ----------- | ---------------------- |
| `className` | `string` | `undefined` | Additional CSS classes |

Extends all standard HTML `<table>` attributes.

### TableHeader

Table header wrapper (thead element).

| Prop        | Type     | Default     | Description            |
| ----------- | -------- | ----------- | ---------------------- |
| `className` | `string` | `undefined` | Additional CSS classes |

Extends all standard HTML `<thead>` attributes.

### TableBody

Table body wrapper (tbody element).

| Prop        | Type     | Default     | Description            |
| ----------- | -------- | ----------- | ---------------------- |
| `className` | `string` | `undefined` | Additional CSS classes |

Extends all standard HTML `<tbody>` attributes.

### TableFooter

Table footer wrapper (tfoot element).

| Prop        | Type     | Default     | Description            |
| ----------- | -------- | ----------- | ---------------------- |
| `className` | `string` | `undefined` | Additional CSS classes |

Extends all standard HTML `<tfoot>` attributes.

### TableRow

Table row element (tr).

| Prop        | Type     | Default     | Description            |
| ----------- | -------- | ----------- | ---------------------- |
| `className` | `string` | `undefined` | Additional CSS classes |

Extends all standard HTML `<tr>` attributes. Has `group/table-row` class for row-level styling hooks.

### TableHead

Table header cell (th).

| Prop        | Type                                         | Default     | Description            |
| ----------- | -------------------------------------------- | ----------- | ---------------------- |
| `className` | `string`                                     | `undefined` | Additional CSS classes |
| `scope`     | `"row" \| "col" \| "rowgroup" \| "colgroup"` | `"col"`     | Header scope           |
| `colSpan`   | `number`                                     | `1`         | Column span            |

Extends all standard HTML `<th>` attributes.

### TableCell

Table data cell (td).

| Prop        | Type     | Default     | Description            |
| ----------- | -------- | ----------- | ---------------------- |
| `className` | `string` | `undefined` | Additional CSS classes |
| `colSpan`   | `number` | `1`         | Column span            |
| `rowSpan`   | `number` | `1`         | Row span               |

Extends all standard HTML `<td>` attributes.

### TableCaption

Table caption element.

| Prop        | Type     | Default     | Description            |
| ----------- | -------- | ----------- | ---------------------- |
| `className` | `string` | `undefined` | Additional CSS classes |

Extends all standard HTML `<caption>` attributes.

### Data Attributes

The Table component uses these data attributes for styling:

- `data-slot="table-container"` - Applied to container div
- `data-slot="table"` - Applied to table element
- `data-slot="table-header"` - Applied to thead
- `data-slot="table-body"` - Applied to tbody
- `data-slot="table-footer"` - Applied to tfoot
- `data-slot="table-row"` - Applied to tr
- `data-slot="table-head"` - Applied to th
- `data-slot="table-cell"` - Applied to td
- `data-slot="table-caption"` - Applied to caption

## Responsive Overflow

The Table component automatically handles horizontal overflow on smaller screens:

```tsx
// Container wraps table with overflow-x-auto
<div data-slot='table-container' className='relative w-full overflow-x-auto'>
  <table data-slot='table' className='w-full'>
    {/* Content */}
  </table>
</div>
```

This allows tables to be scrollable on mobile devices without breaking the layout.

## Accessibility

- **Semantic HTML**: Uses proper `<table>`, `<thead>`, `<tbody>`, `<tfoot>` elements
- **Header Scope**: `TableHead` defaults to `scope="col"`
- **Captions**: Use `TableCaption` to describe table contents
- **Row Headers**: Use `scope="row"` for row headers when needed
- **Sorting**: Implement with keyboard-accessible buttons
- **Selection**: Use accessible checkboxes for row selection

### Best Practices

::: tip
Always provide a table caption or aria-label:

```tsx
<Table aria-label='User directory'>
  <TableCaption>List of all users in the system</TableCaption>
  {/* Content */}
</Table>
```

:::

::: warning
Make row selection accessible:

```tsx
<TableRow>
  <TableCell>
    <Checkbox
      checked={isSelected}
      onChange={() => handleSelect(row.id)}
      aria-label={`Select ${row.name}`}
    />
  </TableCell>
  {/* Other cells */}
</TableRow>
```

:::

## Styling

### CSS Variables

The Table uses these CSS variables from your theme:

```css
--foreground
--muted-foreground
--muted
--border
```

### Layout

- **Text Size**: `text-sm`
- **Header Height**: `h-10`
- **Footer Background**: `bg-muted/50`
- **Header Alignment**: `text-left`
- **Whitespace**: `whitespace-nowrap`

### Customization

Override base styles with className:

```tsx
<Table className='border border-purple-300'>{/* Content */}</Table>
```

Style individual rows:

```tsx
<TableRow className='hover:bg-purple-50'>{/* Cells */}</TableRow>
```

## Common Patterns

### Data Table with Filters

```tsx
import { Input } from '@venizia/ardor-admin';

function DataTable({ data }) {
  const [filter, setFilter] = useState('');
  const filtered = data.filter(item => item.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <div className='mb-4'>
        <Input
          placeholder='Filter by name...'
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(item => (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.email}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
```

### Pagination Example

```tsx
import { Button } from '@venizia/ardor-admin';

function PaginatedTable({ items, itemsPerPage = 10 }) {
  const [page, setPage] = useState(0);
  const start = page * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = items.slice(start, end);
  const pageCount = Math.ceil(items.length / itemsPerPage);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map(item => (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.email}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className='flex gap-2 mt-4'>
        <Button
          variant='outline'
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}>
          Previous
        </Button>
        <span className='flex items-center px-2'>
          Page {page + 1} of {pageCount}
        </span>
        <Button
          variant='outline'
          onClick={() => setPage(Math.min(pageCount - 1, page + 1))}
          disabled={page >= pageCount - 1}>
          Next
        </Button>
      </div>
    </>
  );
}
```

### Selection with Checkboxes

```tsx
import { Checkbox } from '@venizia/ardor-admin';

function SelectableTable({ data }) {
  const [selected, setSelected] = useState(new Set());

  const toggleRow = id => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const toggleAll = () => {
    if (selected.size === data.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.map(item => item.id)));
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Checkbox
              checked={selected.size === data.length}
              onChange={toggleAll}
              aria-label='Select all rows'
            />
          </TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map(item => (
          <TableRow key={item.id}>
            <TableCell>
              <Checkbox
                checked={selected.has(item.id)}
                onChange={() => toggleRow(item.id)}
                aria-label={`Select ${item.name}`}
              />
            </TableCell>
            <TableCell>{item.name}</TableCell>
            <TableCell>{item.email}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### Expandable Rows

```tsx
import { Button } from '@venizia/ardor-admin';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

function ExpandableTable({ data }) {
  const [expanded, setExpanded] = useState(new Set());

  const toggleRow = id => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead></TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map(item => (
          <React.Fragment key={item.id}>
            <TableRow>
              <TableCell>
                <Button size='icon-sm' variant='ghost' onClick={() => toggleRow(item.id)}>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      expanded.has(item.id) ? '' : '-rotate-90'
                    }`}
                  />
                </Button>
              </TableCell>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.email}</TableCell>
            </TableRow>
            {expanded.has(item.id) && (
              <TableRow className='bg-muted/50'>
                <TableCell colSpan={3}>
                  <div className='p-4'>Additional details about {item.name}</div>
                </TableCell>
              </TableRow>
            )}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
```

## Related Components

- [Card](/components/card) - Container for grouped content
- [Button](/components/button) - Actions within tables
- [Checkbox](/components/checkbox) - Row selection
- [Dialog](/components/dialog) - Detailed view of row data
- [Badge](/components/badge) - Status indicators in tables
- [Input](/components/input) - Table filtering and search
