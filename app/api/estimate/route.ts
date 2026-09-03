import { NextResponse } from 'next/server';
import { authenticatedClient } from '@/lib/supabase/api';

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reply: { type: 'string' },
    follow_up: { type: ['string', 'null'] },
    meals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          food_name: { type: 'string' },
          meal_type: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'snack', 'drink'],
          },
          quantity: { type: 'number' },
          calories: { type: 'integer' },
          calorie_low: { type: 'integer' },
          calorie_high: { type: 'integer' },
          confidence: {
            type: 'string',
            enum: ['high', 'medium_high', 'medium', 'low'],
          },
          notes: { type: 'string' },
        },
        required: [
          'food_name',
          'meal_type',
          'quantity',
          'calories',
          'calorie_low',
          'calorie_high',
          'confidence',
          'notes',
        ],
      },
    },
  },
  required: ['reply', 'follow_up', 'meals'],
};

export async function POST(request: Request) {
  const auth = await authenticatedClient(request);
  if ('error' in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json({ error: 'AI_SETUP_REQUIRED' }, { status: 503 });
  const body = (await request.json()) as { message?: string };
  if (!body.message?.trim())
    return NextResponse.json(
      { error: 'Describe what you ate.' },
      { status: 422 },
    );

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
      store: false,
      tools: [{ type: 'web_search' }],
      instructions: `You are a careful calorie logging assistant for a user in Singapore.
Return a useful estimate immediately, using reliable official nutrition or food-composition sources when web search improves accuracy.
Split multiple foods into separate meal entries. Calories are totals for the full entry, not per-unit values.
State important assumptions in notes. Use the user's stated calories or portion facts over your assumptions.
Infer meal type from wording and Singapore local time when possible. Ask at most one concise follow-up question.
Never describe an estimate as exact. Do not save anything; the user must review first.`,
      input: body.message.trim(),
      text: {
        format: {
          type: 'json_schema',
          name: 'meal_estimate',
          strict: true,
          schema,
        },
      },
    }),
  });
  const result = (await response.json()) as {
    output_text?: string;
    error?: { message?: string };
  };
  if (!response.ok)
    return NextResponse.json(
      { error: result.error?.message ?? 'Unable to estimate this meal.' },
      { status: 502 },
    );
  try {
    return NextResponse.json(JSON.parse(result.output_text ?? '{}'));
  } catch {
    return NextResponse.json(
      { error: 'The estimate could not be read. Please try again.' },
      { status: 502 },
    );
  }
}
