/**
 * Refuses `crypto.randomUUID`: browsers define it only in a secure context, so a plain-http LAN origin
 * throws. Use `uuidV4` from `@venizia/ignis-helpers/uuid`.
 */
const MESSAGE =
  'crypto.randomUUID exists only in a secure context (https, localhost) - on a plain-http origin it is undefined. Use uuidV4 from @venizia/ignis-helpers/uuid.';

export const secureContextRules = [
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "MemberExpression[property.name='randomUUID']", message: MESSAGE },
        { selector: "MemberExpression[property.value='randomUUID']", message: MESSAGE },
        { selector: "ObjectPattern > Property[key.name='randomUUID']", message: MESSAGE },
      ],
    },
  },
];
