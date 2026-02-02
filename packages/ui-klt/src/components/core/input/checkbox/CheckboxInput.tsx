import React from 'react';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';

import { Checkbox } from '@/components/shadcn/checkbox';
import { Field, FieldError, FieldLabel } from '@/components/shadcn/field';
import { cn } from '@/utilities/tw.utility';

export interface ICheckboxInputProps extends React.ComponentProps<typeof CheckboxPrimitive.Root> {
  label?: React.ReactNode;
  orientation?: 'vertical' | 'horizontal';

  error?: boolean;
  errorText?: Array<{ message?: string } | undefined>;
}

export const CheckboxInput: React.FC<ICheckboxInputProps> = (props) => {
  const {
    id,
    label,

    error,
    errorText,
    orientation = 'vertical',
    ...restProps
  } = props;

  return (
    <Field>
      <div
        className={cn(
          'inline-flex gap-2',
          orientation === 'horizontal' ? 'flex-col' : 'flex-row items-center',
        )}>
        <Checkbox id={id} data-testid={id} {...restProps} aria-invalid={!!error} />

        {!!label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      </div>

      {!!error && !!errorText && <FieldError errors={errorText} />}
    </Field>
  );
};
