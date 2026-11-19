/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import type { BusinessRole } from '../api/auth';

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean;
    requiresAuth?: boolean;
    allowedRoles?: BusinessRole[];
  }
}

export async function authBeforeEach(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<void> {
  const authStore = useAuthStore();

  if (!to.meta.public && !authStore.isLoggedIn) {
    next({ name: 'login', query: { redirect: to.fullPath } });
    return;
  }

  if (authStore.isLoggedIn && (to.name === 'login' || to.name === 'register')) {
    next({ name: 'home' });
    return;
  }

  if (authStore.isLoggedIn && !authStore.dreamContext) {
    await authStore.fetchDreamContext().catch(() => {});
  }

  if (
    to.meta.allowedRoles &&
    to.meta.allowedRoles.length > 0 &&
    !authStore.hasAnyRole(to.meta.allowedRoles)
  ) {
    next({ name: 'home' });
    return;
  }

  next();
}
