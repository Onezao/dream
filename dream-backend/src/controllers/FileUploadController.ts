/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { FastifyRequest, FastifyReply } from 'fastify';
import { FileUploadService, UploadUrlInput } from '@topeetop/dream-core';

export class FileUploadController {
  constructor(
    private readonly service: FileUploadService = new FileUploadService()
  ) {}

  getPresignedUploadUrl = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await this.service.getPresignedUploadUrl(request.body as UploadUrlInput);
    reply.status(200).send({ data: result });
  };
}
