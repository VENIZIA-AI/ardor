import React from 'react';

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/shadcn/field';
import { Input } from '@/components/shadcn/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
} from '@/components/shadcn/input-group';
import { Textarea } from '@/components/shadcn/textarea';

export type TTextFieldProps = React.ComponentProps<'textarea'> &
  React.ComponentProps<'input'> & {
    label?: React.ReactNode;
    startIcon?: React.ReactNode;
    startBlockIcon?: React.ReactNode;
    endIcon?: React.ReactNode;
    endBlockIcon?: React.ReactNode;

    helperText?: React.ReactNode;

    error?: boolean;
    errorText?: Array<{ message?: string } | undefined>;

    multiline?: boolean;

    fieldRef?: React.Ref<HTMLDivElement>;
    fieldClassName?: string;
    inputGroupClassName?: string;
  };

export const TextField: React.FC<TTextFieldProps> = (props) => {
  const {
    id,
    required: isRequired,
    label,
    startIcon,
    endIcon,
    startBlockIcon,
    endBlockIcon,
    helperText,
    error,
    errorText,
    className,
    multiline: isMultiline,
    fieldClassName,
    fieldRef,
    inputGroupClassName,
    ...restProps
  } = props;

  return (
    <Field ref={fieldRef} data-invalid={!!error} className={fieldClassName}>
      {!!label && (
        <FieldLabel htmlFor={id}>
          {label}
          {!!isRequired && <span className="text-destructive">{' *'}</span>}
        </FieldLabel>
      )}

      {!startIcon && !endIcon ? (
        isMultiline ? (
          <Textarea
            {...restProps}
            className={className}
            aria-invalid={!!error}
            id={id}
            data-testid={id}
            required={isRequired}
          />
        ) : (
          <Input
            {...restProps}
            className={className}
            aria-invalid={!!error}
            id={id}
            data-testid={id}
            required={isRequired}
          />
        )
      ) : (
        <InputGroup className={inputGroupClassName}>
          {isMultiline ? (
            <InputGroupTextarea
              {...restProps}
              className={className}
              aria-invalid={!!error}
              id={id}
              data-testid={id}
              required={isRequired}
            />
          ) : (
            <InputGroupInput
              {...restProps}
              className={className}
              aria-invalid={!!error}
              id={id}
              data-testid={id}
              required={isRequired}
            />
          )}

          {!!startIcon && <InputGroupAddon align="inline-start">{startIcon}</InputGroupAddon>}

          {!!startBlockIcon && (
            <InputGroupAddon align="block-start">{startBlockIcon}</InputGroupAddon>
          )}

          {!!endIcon && <InputGroupAddon align="inline-end">{endIcon}</InputGroupAddon>}

          {!!endBlockIcon && <InputGroupAddon align="block-end">{endBlockIcon}</InputGroupAddon>}
        </InputGroup>
      )}

      {!!helperText && <FieldDescription>{helperText}</FieldDescription>}

      {!!error && !!errorText && <FieldError errors={errorText} />}
    </Field>
  );
};
