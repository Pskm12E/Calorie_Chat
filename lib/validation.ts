import { z } from 'zod';

export const mealSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  consumed_at: z.iso.datetime(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'drink']),
  food_name: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().positive().max(1000).default(1),
  calories: z.coerce.number().int().min(0).max(20000),
  calorie_low: z.coerce.number().int().min(0).max(20000).nullable().optional(),
  calorie_high: z.coerce.number().int().min(0).max(20000).nullable().optional(),
  confidence: z
    .enum(['high', 'medium_high', 'medium', 'low'])
    .default('medium'),
  notes: z.string().max(2000).nullable().optional(),
  source: z
    .enum([
      'chatgpt_photo',
      'chatgpt_text',
      'manual',
      'nutrition_label',
      'saved_food',
    ])
    .default('manual'),
  idempotency_key: z.string().max(200).nullable().optional(),
});

export const weightSchema = z.object({
  weight_kg: z.coerce.number().min(20).max(500),
  recorded_at: z.iso.datetime(),
});

export const stepsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: z.coerce.number().int().min(0).max(200000),
  source: z.string().max(50).default('manual'),
});
