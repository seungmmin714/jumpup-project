/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BLE_MODE?: 'mock' | 'real';
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
