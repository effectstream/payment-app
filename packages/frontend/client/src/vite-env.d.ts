/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EFFECTSTREAM_NODE_URL?: string;
  readonly VITE_BATCHER_URL?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_EFFECTSTREAM_L2_ADDRESS?: string;
  readonly VITE_TRANSAK_ENABLED?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
