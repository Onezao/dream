/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
