#!/usr/bin/env node
import { dispatch } from "./_hook.mjs";

await dispatch(process.argv.slice(2));
