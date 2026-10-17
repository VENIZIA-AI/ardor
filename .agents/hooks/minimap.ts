/**
 * SessionStart hook ARDOR adds to VULCAN's digest (registered in `.configs/vulcan.config.ts`): the
 * minimap shape of P-09, which VULCAN's digest does not print - it prints the rule rows only. The
 * shape is read from `.agents/rules.md` at run time, so it cannot drift. Stdout becomes session
 * context.
 */
const ROOT = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const file = Bun.file(`${ROOT}/.agents/rules.md`);

if (!(await file.exists())) {
  // Never break a session over a missing digest.
  process.exit(0);
}

const lines = (await file.text()).split('\n');
const start = lines.findIndex((line) => line.includes('<!-- minimap-shape:start -->'));
const end = lines.findIndex((line) => line.includes('<!-- minimap-shape:end -->'));

if (start !== -1 && end > start) {
  console.log('## The minimap (P-09) - every status message opens with it');
  console.log();
  console.log(lines.slice(start + 1, end).join('\n'));
}
