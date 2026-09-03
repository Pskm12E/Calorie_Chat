# Calorie Chat

A mobile-first personal calorie and fitness tracker. Log meals manually or describe them naturally for an AI-assisted calorie estimate, review the assumptions, and save the result to a private Supabase account.

## Included

- Email/password authentication with Supabase Auth
- Secure per-user meals, settings, weights, steps, and dated calorie goals
- Today dashboard with calorie ring and remaining/over-goal state
- Manual meal add, edit, and delete
- AI meal estimates through the OpenAI Responses API with optional web search
- Daily history, 7-day calorie overview, weight and step entry
- Validated authenticated API routes for future integrations
- Responsive desktop and mobile navigation

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the Supabase URL and publishable key.
3. Add a server-side `OPENAI_API_KEY`.
4. Apply the migration in `supabase/migrations`.
5. Run `npm install`, then `npm run dev`.

The local app runs at `http://localhost:3000`.

## Security

The OpenAI key is server-only and must never use a `NEXT_PUBLIC_` prefix. All health-data tables use Row Level Security policies that compare `auth.uid()` with the row owner.
