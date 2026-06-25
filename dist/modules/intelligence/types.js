import { z } from 'zod';
export const itemCategorySchema = z.enum([
    'opportunity',
    'project',
    'academic',
    'career',
    'personal',
    'idea',
    'knowledge',
]);
export const itemStatusSchema = z.enum([
    'backlog',
    'parking_lot',
    'in_progress',
    'completed',
    'archived',
]);
export const parsedDeadlineSchema = z.object({
    deadline_at: z.string().datetime({ message: 'Must be valid ISO-8601 datetime' }),
    description: z.string().optional(),
});
export const parsedItemSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    summary: z.string().optional(),
    category: itemCategorySchema,
    status: itemStatusSchema,
    importance_score: z.number().int().min(1).max(10),
    metadata: z.record(z.any()).default({}),
    deadlines: z.array(parsedDeadlineSchema).default([]),
});
