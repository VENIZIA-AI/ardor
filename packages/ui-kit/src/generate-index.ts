import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';

const logger = (opts: { level: 'info' | 'error' | 'success' | 'warning'; message: string }) => {
  const { level, message } = opts;
  const timestamp = new Date().toISOString();

  let colorCode = '';
  let levelLabel = '';

  switch (level) {
    case 'info': {
      colorCode = BLUE;
      levelLabel = '[INFO]';
      break;
    }
    case 'error': {
      colorCode = RED;
      levelLabel = '[ERROR]';
      break;
    }
    case 'success': {
      colorCode = GREEN;
      levelLabel = '[SUCCESS]';
      break;
    }
    case 'warning': {
      colorCode = YELLOW;
      levelLabel = '[WARNING]';
      break;
    }
    default: {
      colorCode = RESET;
      levelLabel = '[LOG]';
    }
  }

  console.log(`[${timestamp}] ${colorCode}${BOLD}${levelLabel}${RESET} - ${message}`);
};

const SRC_DIR = path.resolve(__dirname, '../src');
const OUTPUT_FILE = path.join(SRC_DIR, 'index.ts');

const TARGET_DIRS = ['components', 'hooks', 'utilities'];

const getAllFiles = (dirPath: string, arrayOfFiles: string[] = []): string[] => {
  const files = fs.readdirSync(dirPath);

  files.forEach((file: any) => {
    const fullPath = path.join(dirPath, file);

    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
      return;
    }

    if (
      (file.endsWith('.ts') || file.endsWith('.tsx')) &&
      !file.endsWith('.test.tsx') &&
      !file.endsWith('.test.ts') &&
      !file.endsWith('.d.ts') &&
      file !== 'index.ts'
    ) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
};

const generateIndex = () => {
  let content = "// 🚀 AUTO GENERATE - DON'T EDIT THIS FILE\n\n";
  let totalFiles = 0;

  logger({ level: 'info', message: `${BOLD}Scanning directories...${RESET}` });

  TARGET_DIRS.forEach((dir, index) => {
    const fullPath = path.join(SRC_DIR, dir);

    if (!fs.existsSync(fullPath)) {
      return;
    }

    const allFiles = getAllFiles(fullPath);

    if (allFiles.length > 0) {
      logger({ level: 'info', message: `📁 ${GREEN}${dir}${RESET}` });

      const sortedFiles = allFiles.sort((a, b) =>
        a.localeCompare(b, 'en', { sensitivity: 'base' }),
      );

      const exports = sortedFiles.map((absolutePath) => {
        const relativePath = path.relative(SRC_DIR, absolutePath);
        const cleanPath = relativePath.replace(/\\/g, '/').replace(/\.(ts|tsx)$/, '');

        logger({ level: 'info', message: `   ${DIM}└─${RESET} ${cleanPath}` });

        totalFiles++;

        return `export * from './${cleanPath}';`;
      });

      content += `// Exports from ${dir}\n`;

      if (index === TARGET_DIRS.length - 1) {
        content += exports.join('\n') + '\n';
      } else {
        content += exports.join('\n') + '\n\n';
      }
    }
  });

  fs.writeFileSync(OUTPUT_FILE, content);

  logger({ level: 'info', message: `✨ Total files exported: ${GREEN}${totalFiles}${RESET}` });
  logger({ level: 'success', message: `Updated: ${OUTPUT_FILE}` });
};

generateIndex();
