import { Features } from '@venizia/ardor';

// {{package}} as one ARDOR feature, mounted by the apps that list it in `features()`. Empty until the
// first module moves in: each module adds its routes, resources and messages here, and nothing in the
// package depends on an app.
export const feature = Features.define({ name: '{{lib}}' });
