import { z } from 'zod';

export const MAX_ESTIMATE_HISTORY = 50;

export const estimateResponseSchema = z.object({
  reply: z.string().max(12000),
  follow_up: z.string().max(4000).nullable(),
  meals: z
    .array(
      z.object({
        food_name: z.string().max(1000),
        meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'drink']),
        quantity: z.number().nonnegative(),
        calories: z.number().int().nonnegative(),
        calorie_low: z.number().int().nonnegative(),
        calorie_high: z.number().int().nonnegative(),
        confidence: z.enum(['high', 'medium_high', 'medium', 'low']),
        notes: z.string().max(4000),
      }),
    )
    .max(50),
});

export const estimateRequestSchema = z
  .object({
    message: z.string().trim().max(2000).optional().default(''),
    image: z
      .string()
      .max(6_000_000)
      .regex(/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/)
      .optional(),
    history: z
      .array(
        z.object({
          message: z.string().max(2000),
          photoName: z.string().max(1000).nullable().optional(),
          estimate: estimateResponseSchema,
        }),
      )
      .max(MAX_ESTIMATE_HISTORY)
      .optional()
      .default([]),
  })
  .refine((value) => value.message.length > 0 || Boolean(value.image), {
    message: 'Describe your meal or add a photo.',
  });

type EstimateRequest = z.infer<typeof estimateRequestSchema>;
type InputContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string; detail: 'auto' };
type InputMessage = {
  role: 'user' | 'assistant';
  content: string | InputContent[];
};

// Replay validated turns with fixed roles; browser data can never add system instructions.
// Photo estimates retain their identified foods without storing or re-sending old images.
export function buildEstimateInput({
  message,
  image,
  history,
}: EstimateRequest): InputMessage[] {
  const input: InputMessage[] = [];
  for (const turn of history) {
    input.push({
      role: 'user',
      content: turn.photoName
        ? `${turn.message || 'Please estimate this food photo.'}\n[Food photo was attached; identified foods are in the following estimate.]`
        : turn.message,
    });
    input.push({ role: 'assistant', content: JSON.stringify(turn.estimate) });
  }

  const content: InputContent[] = [
    {
      type: 'input_text',
      text:
        message ||
        'Identify the visible food and estimate the portions and total calories.',
    },
  ];
  if (image)
    content.push({ type: 'input_image', image_url: image, detail: 'auto' });
  input.push({ role: 'user', content });
  return input;
}

export const MEAL_SESSION_INSTRUCTIONS = `The supplied conversation is ONE active, unsaved meal session. Each assistant meals array is a snapshot, not extra food to add again.
Use all supplied user messages and prior estimates to understand corrections, additions, removals, pronouns, and answers to follow-up questions.
Return the COMPLETE current meal in meals on every turn, because Save saves only this latest array. Never return only the changed item.
Change only the food, quantity, size, or preparation the user refers to. Retain all other foods, sides, drinks, quantities, and calorie estimates. Mention what changed and what was kept.
For example: after 4 McSpicy burgers and 2 large fries, "actually I just had 2 McSpicy" changes burgers to quantity 2 and keeps the 2 large fries. "Just 2" in a correction about burgers is not a request to delete unmentioned sides. Remove fries only if explicitly asked, such as "no fries". "Instead of everything, just coffee" replaces the whole meal.
When a quantity changes, scale that entry's TOTAL calories and calorie range once using the prior per-unit estimate; keep unchanged entries stable unless the user corrects their facts. Do not double-count previous snapshots.
User facts override assistant assumptions. If an earlier assistant reply accidentally omitted food without the user removing it, restore it from the earlier conversation. Ask one short question if the target of a correction is unclear instead of silently dropping food.
Newly mentioned foods or photos add to the current meal unless the user clearly requests a replacement. A fresh session has no history; do not invent previous foods.
Describe the result as an updated estimate, never as logged or saved. Nothing has been saved yet.`;
