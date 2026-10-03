// Copyright (c) 2026 bwedirhan. MIT License.
import { z } from '@hono/zod-openapi';

export const SeekSchema = z.object({
  seconds: z.number(),
});
