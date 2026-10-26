import { getError } from '@venizia/ignis-inversion';
import type { Logger, Plugin, ResolvedConfig } from 'vite';

import {
  type IBuildInfoSources,
  isBuildInfoRequest,
  defaultSources,
  resolveBuildInfo,
  serializeBuildInfoFile,
  type TUnresolvedPolicy,
  UnresolvedPolicies,
} from './build-info';

export const DEFAULT_BUILD_INFO_FILE_NAME = 'build-info.json';
export const DEFAULT_FRAMEWORK_SCOPE = '@venizia/';

export interface IBuildInfoFileOptions {
  /** The app folder, where its package.json is. Default: the folder Vite runs in. */
  root?: string;
  /** The file's path under the output folder and under the dev server's base. Default: `build-info.json`. */
  fileName?: string;
  /** Dependencies whose name starts with this are listed under `frameworks`. Default: `@venizia/`. */
  frameworkScope?: string;
  /** What a build does when no commit can be found: `error` (default) or `unspecified`. The dev server always serves what it has and warns. */
  onUnresolved?: TUnresolvedPolicy;
}

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

export const createBuildInfoFilePlugin = (opts: {
  options: IBuildInfoFileOptions;
  sources: IBuildInfoSources;
}): Plugin => {
  const { options, sources } = opts;
  const { root, fileName, frameworkScope, onUnresolved } = parseBuildInfoFileOptions(options);

  let config: ResolvedConfig | undefined;
  let body: Promise<string> | undefined;

  // One resolution per process: the dev server and the build both serve the same builtAt.
  const loadBody = (load: { logger: Logger; policy: TUnresolvedPolicy }): Promise<string> => {
    body ??= (async () => {
      const { info, warnings } = await resolveBuildInfo({
        root,
        scope: frameworkScope,
        policy: load.policy,
        sources,
      });

      for (const warning of warnings) {
        load.logger.warn(warning);
      }

      return serializeBuildInfoFile({ info });
    })();

    return body;
  };

  return {
    name: 'ardor:build-info-file',

    configResolved(resolved) {
      config = resolved;
    },

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
            logger: server.config.logger,
            policy: UnresolvedPolicies.UNSPECIFIED,
          });

          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.setHeader('content-length', Buffer.byteLength(text));
          response.setHeader('cache-control', 'no-store');
          response.end(request.method === 'HEAD' ? undefined : text);
        } catch (error) {
          next(error);
        }
      });
    },

    async generateBundle() {
      if (config === undefined) {
        throw getError({ message: '[buildInfoFile] used before Vite resolved its configuration' });
      }

      this.emitFile({
        type: 'asset',
        fileName,
        source: await loadBody({ logger: config.logger, policy: onUnresolved }),
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
