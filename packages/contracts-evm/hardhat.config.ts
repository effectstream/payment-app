import type { HardhatUserConfig } from "hardhat/config";
import {
  createHardhatConfig,
  createNodeTasks,
  initTelemetry,
} from "@effectstream/evm-hardhat/hardhat-config-builder";

const __dirname: any = import.meta.dirname;

initTelemetry("@payment-app/contracts-evm", "0.1.0");

const nodeTasks = createNodeTasks();

const evmMainPort = 8545;
const evmMainChainId = 31337;
const evmMainInterval = 250;

const config: HardhatUserConfig = createHardhatConfig({
  sourcesDir: `${__dirname}/src/contracts`,
  artifactsDir: `${__dirname}/build/artifacts/hardhat`,
  cacheDir: `${__dirname}/build/cache/hardhat`,
  networks: {
    evmMain: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: evmMainChainId,
      mining: {
        auto: true,
        interval: evmMainInterval,
      },
      allowBlocksWithSameTimestamp: true,
    },
    evmMainHttp: {
      type: "http",
      chainType: "l1",
      url: `http://0.0.0.0:${evmMainPort}`,
    },
  },
  tasks: nodeTasks,
  solidityVersion: "0.8.30",
});

export default config;
