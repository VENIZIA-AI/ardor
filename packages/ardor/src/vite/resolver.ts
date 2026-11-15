import type { IBuildInfoFile } from '@venizia/ardor-kernel';
import { BuildInfoRegistry, type TBuildInfoRecord } from '@venizia/ignis-helpers/core';
import { getError } from '@venizia/ignis-inversion';

import {
  type IBuildInfoResolution,
  type IBuildInfoSources,
  type TUnresolvedPolicy,
  UnresolvedPolicies,
} from './common';

/** The fields in the order the file writes them, the framework versions sorted by name. */
export const toBuildInfoFile = (opts: {
  record: TBuildInfoRecord;
  frameworks: Record<string, string>;
}): IBuildInfoFile => ({
  service: opts.record.service,
  version: opts.record.version,
  commit: opts.record.commit,
  branch: opts.record.branch,
  builtAt: opts.record.builtAt,
  frameworks: Object.fromEntries(
    Object.entries(opts.frameworks).sort(([left], [right]) => left.localeCompare(right)),
  ),
});

/** The same input is always the same text: the keys keep one order, and the file ends with a newline. */
export const serializeBuildInfoFile = (opts: { info: IBuildInfoFile }): string => {
  const { service, version, commit, branch, builtAt, frameworks } = opts.info;

  return `${JSON.stringify({ service, version, commit, branch, builtAt, frameworks }, null, 2)}\n`;
};

/** The stamp of IGNIS, which reads the commit and the branch from the pipeline or from git, and the framework versions. */
export const resolveBuildInfo = async (opts: {
  root: string;
  scope: string;
  policy: TUnresolvedPolicy;
  sources: IBuildInfoSources;
}): Promise<IBuildInfoResolution> => {
  const { root, scope, policy, sources } = opts;
  const warnings: string[] = [];

  const [record, frameworks] = await Promise.all([
    sources.resolveRecord({ root }),
    sources.readFrameworkVersions({ root, scope }),
  ]);

  if (record.commit === BuildInfoRegistry.UNSPECIFIED) {
    const message =
      '[buildInfoFile] no commit | The pipeline gave none (APP_BUILD_COMMIT or the CI variable of your host) and git gave none. Build inside a git checkout, or set APP_BUILD_COMMIT';

    if (policy === UnresolvedPolicies.ERROR) {
      throw getError({ message });
    }

    warnings.push(message);
  }

  if (record.branch === BuildInfoRegistry.UNSPECIFIED) {
    warnings.push(
      '[buildInfoFile] no branch | The pipeline gave none (APP_BUILD_BRANCH) and git gave none',
    );
  }

  for (const name of frameworks.missing) {
    warnings.push(
      `[buildInfoFile] ${name} is a dependency with no installed package.json | Run the install`,
    );
  }

  for (const name of frameworks.invalid) {
    warnings.push(`[buildInfoFile] '${name}' is not a package name | It is left out of frameworks`);
  }

  return {
    info: toBuildInfoFile({ record, frameworks: frameworks.versions }),
    warnings,
  };
};
