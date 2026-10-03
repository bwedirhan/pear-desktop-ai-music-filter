// Copyright (c) 2026 bwedirhan. MIT License.
import { z } from '@hono/zod-openapi';

export const SwitchRepeatSchema = z.object({
  iteration: z.number(),
});
