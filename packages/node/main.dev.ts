import { init, start } from "@effectstream/runtime";
import { main, suspend } from "effection";
import {
  toSyncProtocolWithNetwork,
  withEffectstreamStaticConfig,
} from "@effectstream/config";
import { migrationTable } from "@payment-app/database";

import { config } from "./config.dev.ts";
import { grammar } from "./grammar.ts";
import { gameStateTransitions } from "./state-machine.ts";
import { apiRouter } from "./api.ts";

main(function* () {
  yield* init();
  console.log("Starting Payment App sync node (dev)");

  yield* withEffectstreamStaticConfig(config, function* () {
    yield* start({
      appName: "payment-app",
      appVersion: "0.1.0",
      syncInfo: toSyncProtocolWithNetwork(config),
      gameStateTransitions,
      migrations: migrationTable,
      apiRouter,
      grammar,
    });
  });

  yield* suspend();
});
