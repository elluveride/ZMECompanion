/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'virtual:zme-data' {
  import type { Dataset } from '../schema/schema';
  const data: Dataset;
  export default data;
}
