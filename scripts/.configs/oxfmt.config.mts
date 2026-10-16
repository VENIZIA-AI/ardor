import { defineConfig } from 'oxfmt';
import { oxfmtConfigs } from '@venizia/dev-configs/formatters';

// ARDOR keeps parentheses on every arrow parameter and the closing '>' of a JSX tag on its last line.
export default defineConfig({ ...oxfmtConfigs, arrowParens: 'always', bracketSameLine: true });
