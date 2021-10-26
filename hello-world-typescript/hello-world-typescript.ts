#! ./node_modules/.bin/ts-node

// hello-world-typescript.ts

import { $ } from "zx";

void (async function () {
  await $`ls`;
})();
