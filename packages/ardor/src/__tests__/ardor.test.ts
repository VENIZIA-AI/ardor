import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import * as admin from '@venizia/ardor-admin';
import * as kernel from '@venizia/ardor-kernel';

import * as umbrella from '@/index';
import {
  AbstractArdorApplication,
  Ardor,
  BaseArdorApplication,
  CoreBindings,
  useInjectable,
  useProvider,
  type IAuthProvider,
  type IDataProvider,
} from '@/index';
import { makeScratch, REPOSITORY_ROOT, removeScratch, writeFiles } from './vite/fixture';

const HOOK_NAME = /^use[A-Z]/;

const hooksOf = (source: object): string[] =>
  Object.keys(source)
    .filter((name) => HOOK_NAME.test(name))
    .sort();

describe('Ardor', () => {
  test('gathers every hook the package exports, and nothing else', () => {
    // A new hook in react or admin that is not listed in ardor.ts fails here.
    expect(hooksOf(Ardor)).toEqual(hooksOf(umbrella));
    expect(Object.keys(Ardor)).toHaveLength(33);
  });

  test('each member is the very function the react or admin package exports', () => {
    const gathered: Record<string, unknown> = Ardor;
    const exported: Record<string, unknown> = umbrella;

    for (const name of hooksOf(Ardor)) {
      expect(gathered[name]).toBe(exported[name]);
    }
  });

  test('is a module namespace, so an application cannot swap a hook for the whole process', () => {
    const target: Record<string, unknown> = Ardor;

    expect(() => {
      target.useRepository = () => undefined;
    }).toThrow(TypeError);
    expect(Object.isExtensible(Ardor)).toBe(false);
  });
});

/**
 * The React Rules of Hooks recognise a call through a PascalCase identifier. The same oxlint rule
 * ARDOR enforces on react code (`react/rules-of-hooks`) is run on two fixtures: `Ardor.useX()` in a
 * component and in a custom hook passes, and the same call under a condition is reported, so the
 * rule does treat it as a hook.
 */
describe('the application classes', () => {
  test('BaseArdorApplication is the admin class, which extends the kernel AbstractArdorApplication', () => {
    expect(BaseArdorApplication).toBe(admin.BaseArdorApplication);
    expect(Object.getPrototypeOf(BaseArdorApplication)).toBe(kernel.AbstractArdorApplication);
    expect(AbstractArdorApplication).toBe(kernel.AbstractArdorApplication);
    expect(Reflect.get(kernel, 'BaseArdorApplication')).toBeUndefined();
  });
});

describe('Ardor and the Rules of Hooks', () => {
  const REACT_PACKAGE = join(REPOSITORY_ROOT, 'packages', 'react');
  let scratch = '';

  const lint = async (opts: { file: string }) => {
    const processHandle = Bun.spawn({
      cmd: [
        join(REACT_PACKAGE, 'node_modules', '.bin', 'oxlint'),
        '-c',
        '.configs/lints/oxlint.config.mts',
        '--deny-warnings',
        join(scratch, opts.file),
      ],
      cwd: REACT_PACKAGE,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, exitCode] = await Promise.all([
      new Response(processHandle.stdout).text(),
      processHandle.exited,
    ]);

    return { stdout, exitCode };
  };

  beforeAll(() => {
    scratch = makeScratch({ prefix: 'ardor-hooks-' });
    writeFiles({
      root: scratch,
      files: {
        'valid.tsx': [
          "import { Ardor } from '@venizia/ardor';",
          '',
          'export const Orders = () => {',
          "  const repository = Ardor.useRepository({ key: 'repositories.Orders' });",
          '',
          '  return <div>{String(repository)}</div>;',
          '};',
          '',
          "export const useOrders = () => Ardor.useRepository({ key: 'repositories.Orders' });",
          '',
        ].join('\n'),
        'conditional.tsx': [
          "import { Ardor } from '@venizia/ardor';",
          '',
          'export const Orders = (props: { show: boolean }) => {',
          '  if (props.show) {',
          "    const repository = Ardor.useRepository({ key: 'repositories.Orders' });",
          '',
          '    return <div>{String(repository)}</div>;',
          '  }',
          '',
          '  return null;',
          '};',
          '',
        ].join('\n'),
      },
    });
  });

  afterAll(() => {
    removeScratch({ root: scratch });
  });

  test('a call in a component or in a custom hook passes', async () => {
    const result = await lint({ file: 'valid.tsx' });

    expect(result.stdout).not.toContain('rules-of-hooks');
    expect(result.exitCode).toBe(0);
  });

  test('a call under a condition is reported as a hook call', async () => {
    const result = await lint({ file: 'conditional.tsx' });

    expect(result.stdout).toContain('rules-of-hooks');
    expect(result.stdout).toContain('"useRepository" is called conditionally');
    expect(result.exitCode).toBe(1);
  });
});

describe('the umbrella types the provider keys', () => {
  // Compiled, never called: the claim is that an application importing only `@venizia/ardor` gets
  // the types with no augmentation of its own.
  test('useProvider and useInjectable return the provider a CoreBindings key holds', () => {
    const typed = () => {
      const data: IDataProvider = useProvider({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER });
      const auth: IAuthProvider = Ardor.useProvider({ key: CoreBindings.DEFAULT_AUTH_PROVIDER });
      const injected: IDataProvider = useInjectable({
        key: CoreBindings.DEFAULT_REST_DATA_PROVIDER,
      });
      // @ts-expect-error - the data provider is not a number
      const collapsed: number = useProvider({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER });

      return [data, auth, injected, collapsed];
    };

    expect(typeof typed).toBe('function');
  });

  test('a key that is not listed does not compile', () => {
    const typed = () => {
      // @ts-expect-error - 'providers.Unlisted' is not a key of the kernel or an augmentation
      useProvider({ key: 'providers.Unlisted' });
    };

    expect(typeof typed).toBe('function');
  });
});
