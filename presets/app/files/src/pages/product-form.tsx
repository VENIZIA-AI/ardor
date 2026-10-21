import { Form, useInput } from 'ra-core';

const TextInput = (props: { source: string; label: string }) => {
  const { field } = useInput({ source: props.source });

  return (
    <label>
      {props.label} <input {...field} value={field.value ?? ''} />
    </label>
  );
};

const NumberInput = (props: { source: string; label: string }) => {
  const { field } = useInput({
    source: props.source,
    parse: (value: string) => (value === '' ? null : Number(value)),
  });

  return (
    <label>
      {props.label} <input {...field} type="number" value={field.value ?? ''} />
    </label>
  );
};

export const ProductForm = () => (
  <Form>
    <TextInput source="name" label="Name" />
    <NumberInput source="price" label="Price" />
    <button type="submit">Save</button>
  </Form>
);
