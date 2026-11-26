/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { NotificationManager } from '@topeetop/notification-core';
import type { RoleInvalidationNotifier } from '@topeetop/dream-core';

/**
 * Publishes real-time `ROLE_CONTEXT_INVALIDATED` events through `@topeetop/notification-core` SSE queue.
 */
export class NotificationRoleInvalidationNotifier implements RoleInvalidationNotifier {
  private readonly getNotificationManager: () => NotificationManager | null;

  constructor(getNotificationManager: () => NotificationManager | null) {
    this.getNotificationManager = getNotificationManager;
  }

  async notifyRoleContextInvalidated(
    targetAccountId: string,
    payload: { reason: string; adminId: string }
  ): Promise<void> {
    const manager = this.getNotificationManager();
    if (!manager) {
      return;
    }

    await manager.createMessage({
      userId: targetAccountId,
      audience: 'user',
      eventType: 'ROLE_CONTEXT_INVALIDATED',
      entityId: payload.adminId,
      payload,
    });
  }
}
