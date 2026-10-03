// Copyright (c) 2026 bwedirhan. MIT License.
import { z } from '@hono/zod-openapi';

export const GoBackSchema = z.object({
  seconds: z.number(),
});
