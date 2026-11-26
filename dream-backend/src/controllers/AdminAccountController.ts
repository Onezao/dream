/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { ApiError } from '@topeetop/shared-core';
import { telemetryContext } from '@topeetop/telemetry-core';
import {
  AdminGovernanceService,
  IdentityContextService,
  RoleInvalidationNotifier,
} from '@topeetop/dream-core';
import { AuthUser, getIdentityContextService } from '../middlewares/auth.middleware.js';
import { AuthAccountAdapter } from '../adapters/authAccount.adapter.js';

export interface AdminAccountControllerDeps {
  adminGovernanceService?: AdminGovernanceService;
  identityService?: IdentityContextService;
  roleInvalidationNotifier?: RoleInvalidationNotifier;
}

export class AdminAccountController {
  private readonly service: AdminGovernanceService;

  constructor(deps: AdminAccountControllerDeps = {}) {
    if (deps.adminGovernanceService) {
      this.service = deps.adminGovernanceService;
    } else {
      const identityContextService = deps.identityService ?? getIdentityContextService();
      this.service = new AdminGovernanceService({
        identityContextService,
        authAccountPort: new AuthAccountAdapter(),
        roleInvalidationNotifier: deps.roleInvalidationNotifier,
      });
    }
  }

  private getAuthenticatedUser(request: FastifyRequest): AuthUser {
    const user = request.user as AuthUser | undefined;
    if (!user?.id) {
      throw new ApiError('Authentication token is required', 401, 'UNAUTHORIZED');
    }
    return user;
  }

  private resolveTraceId(request: FastifyRequest): string | undefined {
    const fromContext = telemetryContext.getTraceId();
    if (fromContext) {
      return fromContext;
    }
    const header = request.headers['x-trace-id'];
    return typeof header === 'string' && header ? header : request.id;
  }

  listAdmins = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = this.getAuthenticatedUser(request);
    const data = await this.service.listAdmins(user.id);
    return reply.status(200).send({ data });
  };

  lookupByEmail = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    this.getAuthenticatedUser(request);
    const data = await this.service.lookupAccountByEmail(request.body);
    return reply.status(200).send({ data });
  };

  grantAdmin = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = this.getAuthenticatedUser(request);
    const data = await this.service.grantAdmin(
      user.id,
      request.body,
      this.resolveTraceId(request)
    );
    return reply.status(201).send({ data });
  };

  updateDisplayName = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = this.getAuthenticatedUser(request);
    const params = request.params as { id: string };
    const data = await this.service.updateAdminDisplayName(
      user.id,
      params.id,
      request.body,
      this.resolveTraceId(request)
    );
    return reply.status(200).send({ data });
  };

  revokeAdmin = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = this.getAuthenticatedUser(request);
    const params = request.params as { id: string };
    const data = await this.service.revokeOrdinaryAdmin(
      user.id,
      params.id,
      request.body,
      this.resolveTraceId(request)
    );
    return reply.status(200).send({ data });
  };
}
