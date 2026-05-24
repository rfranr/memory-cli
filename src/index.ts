#!/usr/bin/env node
import { buildProgram } from "./cli/program.js";

await buildProgram().parseAsync(process.argv);
