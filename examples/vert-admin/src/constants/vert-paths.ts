// IGNIS `examples/vert` mounts its authentication component at /auth and a CRUD controller at
// /configurations (see examples/vert/src/components/platform.component.ts and
// src/controllers/configuration.controller.ts in the IGNIS repository).
export class VertPaths {
  static readonly SIGN_IN = '/auth/sign-in';
  static readonly WHO_AM_I = '/auth/who-am-i';
  static readonly REFRESH_TOKEN = '/auth/token/refresh';
  static readonly CONFIGURATIONS = 'configurations';
}
