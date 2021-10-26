#! /usr/bin/env node

// hello-world.mjs

import { $ } from "zx";

$.verbose = false;

const output = (await $`ls`).stdout.trim();

console.log(output);
