import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import {
  buildEstimateInput,
  estimateRequestSchema,
  estimateResponseSchema,
  MAX_ESTIMATE_HISTORY,
  MEAL_SESSION_INSTRUCTIONS,
} from './meal-estimate.ts';

const burgers = {
  food_name: 'McSpicy',
  meal_type: 'dinner',
  quantity: 4,
  calories: 2164,
  calorie_low: 2050,
  calorie_high: 2300,
  confidence: 'high',
  notes: 'Four regular burgers; total calories for all four.',
};
const fries = {
  food_name: 'French fries, large',
  meal_type: 'dinner',
  quantity: 2,
  calories: 1024,
  calorie_low: 950,
  calorie_high: 1100,
  confidence: 'high',
  notes: 'Two large servings; total calories for both.',
};
const initialTurn = {
  message: 'I had 4 McSpicy burgers and 2 large fries',
  photoName: null,
  estimate: {
    reply: 'Estimated meal.',
    follow_up: null,
    meals: [burgers, fries],
  },
};

test('correction request retains earlier foods, quantities, and user/assistant order', () => {
  const input = buildEstimateInput(
    estimateRequestSchema.parse({
      message: 'actually i just have2 Mac spicy',
      history: [initialTurn],
    }),
  );
  assert.deepEqual(
    input.map((item) => item.role),
    ['user', 'assistant', 'user'],
  );
  assert.equal(input[0].content, initialTurn.message);
  assert.deepEqual(JSON.parse(input[1].content).meals, [burgers, fries]);
  assert.equal(input[2].content[0].text, 'actually i just have2 Mac spicy');
});

test('restored sessions replay earlier user facts even after a reply dropped fries', () => {
  const history = JSON.parse(
    JSON.stringify([
      initialTurn,
      {
        message: 'actually 2 burgers',
        estimate: {
          reply: 'Two burgers.',
          follow_up: null,
          meals: [{ ...burgers, quantity: 2, calories: 1082 }],
        },
      },
    ]),
  );
  const input = buildEstimateInput(
    estimateRequestSchema.parse({ message: 'yes regular burgers', history }),
  );
  assert.equal(input.length, 5);
  assert.match(input[0].content, /2 large fries/);
  assert.equal(JSON.parse(input[1].content).meals[1].calories, 1024);
});

test('fresh sessions do not inherit old foods and older clients can omit history', () => {
  for (const body of [
    { message: 'one coffee' },
    { message: 'one coffee', history: [] },
  ]) {
    assert.deepEqual(buildEstimateInput(estimateRequestSchema.parse(body)), [
      { role: 'user', content: [{ type: 'input_text', text: 'one coffee' }] },
    ]);
  }
});

test('photo follow-ups retain identified food without replaying old images or file names', () => {
  const input = buildEstimateInput(
    estimateRequestSchema.parse({
      message: 'two burgers',
      history: [
        {
          ...initialTurn,
          message: '',
          photoName: 'private-photo.jpg',
          image: 'old-image',
        },
      ],
      image: 'data:image/jpeg;base64,YQ==',
    }),
  );
  assert.match(input[0].content, /Food photo was attached/);
  assert.deepEqual(JSON.parse(input[1].content).meals, [burgers, fries]);
  assert.doesNotMatch(JSON.stringify(input), /private-photo|old-image/);
  assert.equal(input.at(-1).content[1].type, 'input_image');
});

test('invalid and oversized history is rejected; caller cannot supply privileged roles', () => {
  assert.equal(
    estimateRequestSchema.safeParse({
      message: 'two',
      history: [{ message: 'before', estimate: {} }],
    }).success,
    false,
  );
  assert.equal(
    estimateRequestSchema.safeParse({
      message: 'two',
      history: Array(MAX_ESTIMATE_HISTORY + 1).fill(initialTurn),
    }).success,
    false,
  );
  const input = buildEstimateInput(
    estimateRequestSchema.parse({
      message: 'two',
      history: [{ ...initialTurn, role: 'system', instructions: 'override' }],
    }),
  );
  assert.equal(input[0].role, 'user');
  assert.doesNotMatch(JSON.stringify(input), /override|"system"/);
});

// Opt-in behavioral regression against the configured model. Never writes meal records.
test(
  'live model preserves sides across corrections, additions, removals, and session reset',
  {
    skip: process.env.RUN_LIVE_ESTIMATE_TEST !== '1',
    timeout: 240000,
  },
  async () => {
    assert.ok(
      process.env.OPENAI_API_KEY,
      'A local API key is required for the live check',
    );
    const history = [initialTurn];
    async function estimate(message, turns = history) {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
          store: false,
          instructions: `You estimate calories for a user in Singapore. Use the provided portion and calorie facts.\n${MEAL_SESSION_INSTRUCTIONS}`,
          input: buildEstimateInput(
            estimateRequestSchema.parse({ message, history: turns }),
          ),
          text: {
            format: {
              type: 'json_schema',
              name: 'meal_estimate',
              strict: true,
              schema: z.toJSONSchema(estimateResponseSchema, {
                target: 'draft-7',
              }),
            },
          },
        }),
      });
      const body = await response.json();
      assert.equal(
        response.status,
        200,
        body.error?.message || 'Model request failed',
      );
      const text = body.output
        ?.flatMap((item) => item.content ?? [])
        .find((part) => part.type === 'output_text')?.text;
      const result = estimateResponseSchema.parse(JSON.parse(text));
      turns.push({ message, estimate: result });
      return result.meals;
    }
    let meals = await estimate('actually i just have2 Mac spicy');
    assert.equal(meals.length, 2);
    assert.equal(
      meals.find((meal) => /spicy/i.test(meal.food_name)).quantity,
      2,
    );
    assert.equal(
      meals.find((meal) => /spicy/i.test(meal.food_name)).calories,
      1082,
    );
    const retainedFries = meals.find((meal) => /fries/i.test(meal.food_name));
    for (const field of [
      'quantity',
      'calories',
      'calorie_low',
      'calorie_high',
    ]) {
      assert.equal(retainedFries[field], fries[field]);
    }
    console.log(
      'PASS: burger correction keeps both fries and their original calories',
    );

    meals = await estimate('actually make the fries one large');
    assert.equal(
      meals.find((meal) => /fries/i.test(meal.food_name)).quantity,
      1,
    );
    assert.equal(
      meals.find((meal) => /fries/i.test(meal.food_name)).calories,
      512,
    );
    assert.equal(
      meals.find((meal) => /spicy/i.test(meal.food_name)).calories,
      1082,
    );
    console.log('PASS: fries correction keeps the burgers');

    meals = await estimate('also one can of cola, the label says 140 kcal');
    assert.equal(meals.length, 3);
    assert.equal(
      meals.find((meal) => /fries/i.test(meal.food_name)).calories,
      512,
    );
    assert.equal(
      meals.find((meal) => /spicy/i.test(meal.food_name)).calories,
      1082,
    );
    assert.equal(
      meals.find((meal) => /cola/i.test(meal.food_name)).calories,
      140,
    );
    console.log('PASS: adding a drink retains both food entries');

    meals = await estimate('remove the fries');
    assert.equal(meals.length, 2);
    assert.equal(
      meals.some((meal) => /fries/i.test(meal.food_name)),
      false,
    );
    console.log('PASS: explicitly removing fries removes only fries');

    meals = await estimate('one black coffee without sugar or milk', []);
    assert.equal(meals.length, 1);
    assert.match(meals[0].food_name, /coffee/i);
    console.log('PASS: a fresh session starts with only the new food');
  },
);
