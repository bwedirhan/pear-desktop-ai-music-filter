// Copyright (c) 2026 bwedirhan. MIT License.
import { z } from '@hono/zod-openapi';

export const SetFullscreenSchema = z.object({
  state: z.boolean(),
});
