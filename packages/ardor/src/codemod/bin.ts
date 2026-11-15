#!/usr/bin/env node
import { ArdorCli } from './ardor-cli';

const result = await ArdorCli.run({ root: process.cwd(), argv: process.argv.slice(2) });
process.exitCode = result;
