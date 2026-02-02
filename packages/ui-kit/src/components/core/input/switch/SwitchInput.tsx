import React from 'react';

import * as SwitchPrimitive from '@radix-ui/react-switch';

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/shadcn/field';
import { Switch } from '@/components/shadcn/switch';
import { cn } from '@/utilities/tw.utility';

export type TSwitchInputProps = React.ComponentProps<typeof SwitchPrimitive.Root> & {
  label?: React.ReactNode;
  orientation?: 'vertical' | 'horizontal' | 'horizontal-reverse';

  helperText?: React.ReactNode;

  error?: boolean;
  errorText?: Array<{ message?: string } | undefined>;
};

export const SwitchInput: React.FC<TSwitchInputProps> = (props) => {
  const {
    id,
    required: isRequired,
    label,
    helperText,
    error,
    errorText,
    orientation,
    ...restProps
  } = props;

  return (
    <Field data-invalid={!!error}>
      <div
        className={cn(
          'inline-flex gap-2',
          orientation === 'vertical' && 'flex-col',
          orientation === 'horizontal' && 'flex-row items-center',
          orientation === 'horizontal-reverse' && 'flex-row-reverse items-center justify-end',
        )}>
        <Switch id={id} data-testid={id} {...restProps} aria-invalid={!!error} />

        {!!label && (
          <FieldLabel htmlFor={id} className={cn(orientation === 'horizontal-reverse' && 'flex-1')}>
            {label}
            {!!isRequired && <span className="text-destructive">{' *'}</span>}
          </FieldLabel>
        )}
      </div>

      {!!helperText && <FieldDescription>{helperText}</FieldDescription>}

      {!!error && !!errorText && <FieldError errors={errorText} />}
    </Field>
  );
};
