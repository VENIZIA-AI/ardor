/** The union of the string values of a const class (V-C-08): `SCHEME_SET` and `isValid` are not strings, so they drop out. */
export type TConstValue<T> = Extract<T[keyof T], string> & {};
