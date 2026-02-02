import React from 'react';

import dayjs from 'dayjs';
import { CalendarDaysIcon } from 'lucide-react';

import { Button } from '@/components/shadcn/button';
import { Calendar } from '@/components/shadcn/calendar';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/shadcn/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/shadcn/popover';

export interface IDatePickerProps {
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;

  label?: React.ReactNode;
  placeholder?: string;

  helperText?: React.ReactNode;

  error?: boolean;
  errorText?: Array<{ message?: string } | undefined>;

  value?: string; // YYYY-MM-DD
  onChange?: (date: string | null) => void;
}

/**
 *
 * @param value format: YYYY-MM-DD
 */
export const DatePicker: React.FC<IDatePickerProps> = (props) => {
  // --------------------------------------------------
  const {
    id,
    required: isRequired,
    disabled,
    error,
    errorText,
    helperText,
    label,
    placeholder = 'Select date',
    value,
    onChange,
  } = props;

  // --------------------------------------------------
  const [isOpen, setIsOpen] = React.useState(false);

  // --------------------------------------------------
  const [date, setDate] = React.useState<Date | undefined>(value ? new Date(value) : undefined);

  // --------------------------------------------------
  React.useEffect(() => {
    setDate(value ? new Date(value) : undefined);
    return () => {};
  }, [value]);

  return (
    <Field data-invalid={!!error}>
      {!!label && (
        <FieldLabel htmlFor={id}>
          {label}
          {!!isRequired && <span className="text-destructive">{' *'}</span>}
        </FieldLabel>
      )}

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            disabled={disabled}
            variant="outline"
            id={id}
            data-testid={id}
            className="justify-between">
            {date ? dayjs(date).format('L') : placeholder}
            <CalendarDaysIcon />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            captionLayout="dropdown"
            onSelect={(d) => {
              setDate(d);
              onChange?.(d ? dayjs(d).format('YYYY-MM-DD') : null);
              setIsOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      {!!helperText && <FieldDescription>{helperText}</FieldDescription>}

      {!!error && !!errorText && <FieldError errors={errorText} />}
    </Field>
  );
};
