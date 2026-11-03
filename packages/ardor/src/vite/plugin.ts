import { getError } from '@venizia/ignis-inversion';
import type { Plugin } from 'vite';

import {
  DEFAULT_BUILD_INFO_FILE_NAME,
  DEFAULT_FRAMEWORK_SCOPE,
  type IBuildInfoFileOptions,
  type IBuildInfoSources,
  type TUnresolvedPolicy,
  UnresolvedPolicies,
} from './common';
import { serializeBuildInfoFile, resolveBuildInfo } from './resolver';
import { defaultSources } from './sources';

type TParsedOptions = Required<IBuildInfoFileOptions>;

const FILE_NAME_PATTERN = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\.json$/;

export const parseBuildInfoFileOptions = (opts: IBuildInfoFileOptions): TParsedOptions => {
  const {
    root = process.cwd(),
    fileName = DEFAULT_BUILD_INFO_FILE_NAME,
    frameworkScope = DEFAULT_FRAMEWORK_SCOPE,
    onUnresolved = UnresolvedPolicies.ERROR,
  } = opts;

  // A folder outside the output folder, or one a request path could climb out of, is refused.
  if (!FILE_NAME_PATTERN.test(fileName) || fileName.split('/').includes('..')) {
    throw getError({
      message: `[buildInfoFile] fileName '${fileName}' is not valid | Use a relative path of letters, digits, '.', '_' and '-' that ends in .json, like 'build-info.json'`,
    });
  }

  if (frameworkScope === '') {
    throw getError({
      message: "[buildInfoFile] frameworkScope is empty | Use a scope like '@venizia/'",
    });
  }

  if (!UnresolvedPolicies.isValid(onUnresolved)) {
    throw getError({
      message: `[buildInfoFile] onUnresolved '${onUnresolved}' is not valid | Use one of: ${[...UnresolvedPolicies.SCHEME_SET].join(', ')}`,
    });
  }

  return { root, fileName, frameworkScope, onUnresolved };
};

export const isBuildInfoRequest = (opts: {
  url: string | undefined;
  base: string;
  fileName: string;
}): boolean => {
  if (opts.url === undefined) {
    return false;
  }

  return opts.url.split('?')[0] === `${opts.base}${opts.fileName}`;
};

export const createBuildInfoFilePlugin = (opts: {
  options: IBuildInfoFileOptions;
  sources: IBuildInfoSources;
}): Plugin => {
  const { options, sources } = opts;
  const { root, fileName, frameworkScope, onUnresolved } = parseBuildInfoFileOptions(options);

  let body: Promise<string> | undefined;

  // One resolution per process, so the dev server and the build both serve the same builtAt; a failed
  // one is not kept, because the cause (a half-saved package.json) may be gone on the next request.
  const loadBody = (load: {
    warn: (message: string) => void;
    policy: TUnresolvedPolicy;
  }): Promise<string> => {
    body ??= (async () => {
      const { info, warnings } = await resolveBuildInfo({
        root,
        scope: frameworkScope,
        policy: load.policy,
        sources,
      });

      for (const warning of warnings) {
        load.warn(warning);
      }

      return serializeBuildInfoFile({ info });
    })().catch((error: unknown) => {
      body = undefined;

      throw error;
    });

    return body;
  };

  return {
    name: 'ardor:build-info-file',

    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!isBuildInfoRequest({ url: request.url, base: server.config.base, fileName })) {
          next();

          return;
        }

        if (request.method !== 'GET' && request.method !== 'HEAD') {
          response.statusCode = 405;
          response.setHeader('allow', 'GET, HEAD');
          response.end();

          return;
        }

        try {
          const text = await loadBody({
            warn: (message) => server.config.logger.warn(message),
            policy: UnresolvedPolicies.UNSPECIFIED,
          });

          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.setHeader('content-length', Buffer.byteLength(text));
          response.setHeader('cache-control', 'no-store');
          response.end(request.method === 'HEAD' ? undefined : text);
        } catch (error) {
          // The cause goes to the terminal of the developer; the response never carries a path or a stack.
          server.config.logger.error(error instanceof Error ? error.message : String(error));

          response.statusCode = 500;
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.setHeader('cache-control', 'no-store');
          response.end(
            `${JSON.stringify({ error: `${fileName} is unavailable, see the dev server log` })}\n`,
          );
        }
      });
    },

    async generateBundle() {
      const result = await loadBody({
        warn: (message) => this.warn(message),
        policy: onUnresolved,
      });
      this.emitFile({
        type: 'asset',
        fileName,
        source: result,
      });
    },
  };
};

/**
 * Emits `build-info.json` into the build and serves it on the dev server: the commit, the branch and
 * the build time from the pipeline or git, the app's name and version, and the installed versions of
 * the framework packages it depends on. The shape is `IBuildInfoFile` of `@venizia/ardor`.
 */
export const buildInfoFile = (opts: IBuildInfoFileOptions = {}): Plugin =>
  createBuildInfoFilePlugin({ options: opts, sources: defaultSources });
