import {z} from "zod";

export const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const scoreDeltaSchema = z.object({
  home: z.number().int().nonnegative(),
  away: z.number().int().nonnegative(),
}).refine((delta) => delta.home > 0 || delta.away > 0);

export const createCommentarySchema = z.object({
  minute: z.number().int().nonnegative(),
  sequence: z.number().int().nonnegative(),
  period: z.string(),
  eventType: z.string(),
  actor: z.string().nullable().optional(),
  team: z.string().nullable().optional(),
  message: z.string(),
  scoreDelta: scoreDeltaSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});
