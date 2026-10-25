// Preload for the Node probe: see sandbox-guard.ts. Registers the resolve hook below.
import { register } from 'node:module';

register('./node-guard-hooks.mjs', import.meta.url);
