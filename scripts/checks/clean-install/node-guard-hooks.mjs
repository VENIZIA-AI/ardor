import { realpathSync } from 'node:fs';
import { sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const sandbox = realpathSync(process.env.CLEAN_INSTALL_SANDBOX);

export const resolve = async (specifier, context, nextResolve) => {
  const result = await nextResolve(specifier, context);

  if (result.url.startsWith('file:')) {
    const file = realpathSync(fileURLToPath(result.url));

    if (file !== sandbox && !file.startsWith(sandbox + sep)) {
      throw new Error(`'${specifier}' resolved outside the sandbox: ${file}`);
    }
  }
  return result;
};
