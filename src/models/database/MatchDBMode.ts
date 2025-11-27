import { z } from 'zod';

export const MatchDBSchema = z.object({
    match_id: z.string(),
    data: z.record(z.string(), z.any()),
    region: z.string().optional(),
    is_processed: z.boolean().default(false),
    created_at: z.string().optional()
});

export type MatchDB = z.infer<typeof MatchDBSchema>;
