'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Apple,
  BookmarkPlus,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Coffee,
  History,
  Home,
  LoaderCircle,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Scale,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

type View = 'today' | 'history' | 'progress' | 'settings';
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink';
type Meal = {
  id: string;
  date: string;
  consumed_at: string;
  meal_type: MealType;
  food_name: string;
  quantity: number;
  calories: number;
  calorie_low: number | null;
  calorie_high: number | null;
  confidence: 'high' | 'medium_high' | 'medium' | 'low';
  notes: string | null;
  source: string;
};
type WeightEntry = { id: string; weight_kg: number; recorded_at: string };
type StepEntry = { id: string; date: string; steps: number };
type SavedFood = {
  id: string;
  food_name: string;
  meal_type: MealType;
  quantity: number;
  calories: number;
  notes: string | null;
  times_logged: number;
  last_used_at: string | null;
};
type EstimateMeal = Omit<Meal, 'id' | 'date' | 'consumed_at' | 'source'>;
type Estimate = {
  reply: string;
  follow_up: string | null;
  meals: EstimateMeal[];
};
type FormSubmitEvent = Parameters<
  NonNullable<React.ComponentProps<'form'>['onSubmit']>
>[0];

const supabase = createClient();
const USER_ID_DOMAIN = 'caloriechat.local';
const mealLabels: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
  drink: 'Drinks',
};
const mealIcons: Record<MealType, string> = {
  breakfast: '☀️',
  lunch: '🍚',
  dinner: '🍲',
  snack: '🍎',
  drink: '🥤',
};
const nav = [
  { id: 'today' as const, label: 'Today', icon: Home },
  { id: 'history' as const, label: 'History', icon: History },
  { id: 'progress' as const, label: 'Progress', icon: ChartNoAxesCombined },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
];

function singaporeDate(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
function readableDate(value: string) {
  return new Intl.DateTimeFormat('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Singapore',
  }).format(new Date(`${value}T12:00:00+08:00`));
}
function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}
function identifierToEmail(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  return normalized.includes('@')
    ? normalized
    : `${normalized}@${USER_ID_DOMAIN}`;
}
function accountLabel(user: User) {
  const email = user.email ?? '';
  return email.endsWith(`@${USER_ID_DOMAIN}`)
    ? email.slice(0, -(USER_ID_DOMAIN.length + 1))
    : email;
}

export default function CalorieChat() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<View>('today');
  const [selectedDate, setSelectedDate] = useState(singaporeDate());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [steps, setSteps] = useState<StepEntry[]>([]);
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>([]);
  const [goal, setGoal] = useState(1900);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mealModal, setMealModal] = useState<Meal | 'new' | null>(null);
  const [savedFoodModal, setSavedFoodModal] = useState<
    SavedFood | 'new' | null
  >(null);
  const [demoLogin, setDemoLogin] = useState<{
    identifier: string;
    password: string;
  } | null>(null);

  const loadData = useCallback(async (activeUser: User) => {
    setLoading(true);
    setError('');
    await supabase
      .from('user_settings')
      .upsert(
        { user_id: activeUser.id },
        { onConflict: 'user_id', ignoreDuplicates: true },
      );
    const [
      mealResult,
      weightResult,
      stepResult,
      settingResult,
      savedFoodResult,
    ] = await Promise.all([
      supabase
        .from('meals')
        .select('*')
        .gte('date', singaporeDate(new Date(Date.now() - 31 * 86400000)))
        .order('consumed_at', { ascending: false }),
      supabase
        .from('weight_entries')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(60),
      supabase
        .from('step_entries')
        .select('*')
        .gte('date', singaporeDate(new Date(Date.now() - 31 * 86400000)))
        .order('date', { ascending: false }),
      supabase.from('user_settings').select('*').single(),
      supabase
        .from('saved_foods')
        .select('*')
        .order('last_used_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
    ]);
    const firstError =
      mealResult.error ||
      weightResult.error ||
      stepResult.error ||
      settingResult.error ||
      savedFoodResult.error;
    if (firstError) setError(firstError.message);
    setMeals((mealResult.data ?? []) as Meal[]);
    setWeights((weightResult.data ?? []) as WeightEntry[]);
    setSteps((stepResult.data ?? []) as StepEntry[]);
    setSavedFoods((savedFoodResult.data ?? []) as SavedFood[]);
    setGoal(settingResult.data?.daily_calorie_goal ?? 1900);
    setLoading(false);
  }, []);

  useEffect(() => {
    let prefillAttempts = 0;
    const prefillTimer = window.setInterval(() => {
      prefillAttempts += 1;
      const identifier = document.body.dataset.demoLoginId ?? '';
      const password = document.body.dataset.demoLoginPassword ?? '';
      if (identifier || password || prefillAttempts >= 40) {
        setDemoLogin({ identifier, password });
        window.clearInterval(prefillTimer);
      }
    }, 50);
    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
      if (data.user) void loadData(data.user);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) void loadData(session.user);
    });
    return () => {
      window.clearInterval(prefillTimer);
      data.subscription.unsubscribe();
    };
  }, [loadData]);

  if (authLoading || (!user && !demoLogin)) return <FullScreenLoader />;
  if (!user)
    return (
      <AuthScreen
        defaultIdentifier={demoLogin?.identifier ?? ''}
        defaultPassword={demoLogin?.password ?? ''}
      />
    );

  const dateMeals = meals.filter((meal) => meal.date === selectedDate);
  const eaten = dateMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const daySteps =
    steps.find((entry) => entry.date === selectedDate)?.steps ?? 0;
  const latestWeight = weights[0];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7faf7_0%,#f2f6f2_100%)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="hidden w-64 shrink-0 border-r border-black/[.055] bg-[#fbfcfa] px-5 py-7 lg:flex lg:flex-col">
          <Brand />
          <Navigation view={view} setView={setView} />
          <div className="mt-auto rounded-2xl border border-border bg-secondary/50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" /> Better estimates
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Add portions, preparation, or a nutrition label whenever you can.
            </p>
          </div>
          <button
            onClick={() => void supabase.auth.signOut()}
            className="mt-5 flex items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted"
          >
            <CircleUserRound className="size-9 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {accountLabel(user)}
              </span>
              <span className="text-xs text-muted-foreground">Sign out</span>
            </span>
            <LogOut className="size-4 text-muted-foreground" />
          </button>
        </aside>
        <section className="min-w-0 flex-1 pb-[calc(6.25rem+env(safe-area-inset-bottom))] lg:pb-10">
          <AppHeader
            view={view}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
          {error && (
            <div className="mx-auto mt-5 max-w-6xl px-4 sm:px-8 lg:px-12">
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            </div>
          )}
          {loading ? (
            <FullScreenLoader compact />
          ) : (
            <>
              {view === 'today' && (
                <TodayView
                  meals={dateMeals}
                  eaten={eaten}
                  goal={goal}
                  steps={daySteps}
                  latestWeight={latestWeight}
                  savedFoods={savedFoods}
                  date={selectedDate}
                  userId={user.id}
                  onAdd={() => setMealModal('new')}
                  onManageSaved={setSavedFoodModal}
                  onEdit={setMealModal}
                  onSaved={() => loadData(user)}
                />
              )}
              {view === 'history' && (
                <HistoryView
                  date={selectedDate}
                  meals={dateMeals}
                  eaten={eaten}
                  goal={goal}
                  steps={daySteps}
                  weights={weights}
                  onDate={setSelectedDate}
                  onEdit={setMealModal}
                />
              )}
              {view === 'progress' && (
                <ProgressView
                  meals={meals}
                  weights={weights}
                  goal={goal}
                  onSaved={() => loadData(user)}
                  userId={user.id}
                />
              )}
              {view === 'settings' && (
                <SettingsView
                  goal={goal}
                  userId={user.id}
                  email={accountLabel(user)}
                  onSaved={() => loadData(user)}
                  onSignOut={() => void supabase.auth.signOut()}
                />
              )}
            </>
          )}
        </section>
      </div>
      <Navigation view={view} setView={setView} mobile />
      {mealModal && (
        <MealModal
          value={mealModal === 'new' ? null : mealModal}
          date={selectedDate}
          userId={user.id}
          onClose={() => setMealModal(null)}
          onSaved={() => {
            setMealModal(null);
            void loadData(user);
          }}
        />
      )}
      {savedFoodModal && (
        <SavedFoodModal
          value={savedFoodModal === 'new' ? null : savedFoodModal}
          userId={user.id}
          onClose={() => setSavedFoodModal(null)}
          onSaved={() => {
            setSavedFoodModal(null);
            void loadData(user);
          }}
        />
      )}
    </main>
  );
}

function Brand() {
  return (
    <div className="mb-10 flex items-center gap-3 px-2">
      <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(26,127,90,.24)]">
        <Apple className="size-5" />
      </span>
      <span className="text-xl font-bold tracking-[-0.04em]">Calorie Chat</span>
    </div>
  );
}

function Navigation({
  view,
  setView,
  mobile = false,
}: {
  view: View;
  setView: (view: View) => void;
  mobile?: boolean;
}) {
  if (mobile)
    return (
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-black/[.06] bg-white/95 px-2 pb-[max(9px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_35px_rgba(26,54,43,.06)] backdrop-blur-xl lg:hidden">
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition active:scale-95 ${view === id ? 'bg-primary/[.08] text-primary' : 'text-muted-foreground'}`}
          >
            <Icon className="size-[21px]" strokeWidth={view === id ? 2.5 : 2} />
            {label}
          </button>
        ))}
      </nav>
    );
  return (
    <nav className="space-y-1.5">
      {nav.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setView(id)}
          className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition ${view === id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
        >
          <Icon className="size-[18px]" />
          {label}
        </button>
      ))}
    </nav>
  );
}

function AppHeader({
  view,
  selectedDate,
  setSelectedDate,
}: {
  view: View;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}) {
  const titles = {
    today: 'Today',
    history: 'History',
    progress: 'Progress',
    settings: 'Settings',
  };
  const today = singaporeDate();
  return (
    <header className="sticky top-0 z-30 flex min-h-[72px] items-center justify-between border-b border-black/[.045] bg-[#f7faf7]/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:px-8 lg:static lg:px-12 lg:pt-0">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.17em] text-primary">
          {view === 'today' ? readableDate(today) : 'Calorie Chat'}
        </p>
        <h1 className="mt-0.5 text-[22px] font-extrabold tracking-[-.035em]">
          {titles[view]}
        </h1>
      </div>
      {(view === 'today' || view === 'history') && (
        <label className="relative">
          <CalendarDays className="pointer-events-none absolute left-3 top-3.5 size-4 text-primary" />
          <input
            aria-label="Selected date"
            type="date"
            value={selectedDate}
            max={today}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="h-11 w-[154px] rounded-2xl border border-black/[.06] bg-white pl-9 pr-2 text-[13px] font-semibold shadow-sm sm:w-auto sm:pr-3"
          />
        </label>
      )}
    </header>
  );
}

function TodayView({
  meals,
  eaten,
  goal,
  steps,
  latestWeight,
  savedFoods,
  date,
  userId,
  onAdd,
  onManageSaved,
  onEdit,
  onSaved,
}: {
  meals: Meal[];
  eaten: number;
  goal: number;
  steps: number;
  latestWeight?: WeightEntry;
  savedFoods: SavedFood[];
  date: string;
  userId: string;
  onAdd: () => void;
  onManageSaved: (food: SavedFood | 'new') => void;
  onEdit: (meal: Meal) => void;
  onSaved: () => void;
}) {
  const percent = Math.min(100, Math.round((eaten / goal) * 100));
  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-6 pt-3 sm:px-8 sm:pt-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)] lg:gap-7 lg:px-12 lg:py-9">
      <div className="min-w-0 space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#153b30] px-5 pb-5 pt-5 text-white shadow-[0_22px_55px_rgba(14,54,41,.2)] sm:px-7 sm:pb-7">
          <div className="pointer-events-none absolute -right-14 -top-16 size-52 rounded-full bg-[#55bf85]/20 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#9fdbbb]">
                Daily energy
              </p>
              <p className="mt-1 text-sm text-white/65">
                {eaten <= goal
                  ? 'You’re right on track'
                  : `${eaten - goal} kcal over goal`}
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur">
              {Math.round((eaten / goal) * 100)}%
            </span>
          </div>
          <div className="relative mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:mt-5 sm:grid-cols-[1fr_210px_1fr]">
            <div className="hidden sm:block">
              <p className="text-3xl font-bold tracking-[-0.05em]">{eaten}</p>
              <p className="mt-1 text-xs text-white/55">eaten today</p>
            </div>
            <CalorieRing eaten={eaten} goal={goal} percent={percent} dark />
            <div className="pr-2 text-right sm:pr-0">
              <p className="text-3xl font-bold tracking-[-0.05em]">
                {Math.abs(goal - eaten)}
              </p>
              <p className="mt-1 text-xs text-white/55">
                kcal {eaten > goal ? 'over' : 'left'}
              </p>
            </div>
          </div>
          <div className="relative mt-3 grid grid-cols-2 gap-2.5 border-t border-white/10 pt-4 sm:mt-4">
            <button
              onClick={onAdd}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white font-bold text-[#153b30] transition active:scale-[.98]"
            >
              <Plus className="size-[18px]" /> Manual log
            </button>
            <button
              onClick={() => onManageSaved('new')}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 font-bold text-white transition active:scale-[.98]"
            >
              <BookmarkPlus className="size-[18px]" /> Save a food
            </button>
          </div>
        </section>
        <QuickFoods
          foods={savedFoods}
          date={date}
          userId={userId}
          onManage={onManageSaved}
          onSaved={onSaved}
        />
        <div className="lg:hidden">
          <ChatCard onSaved={onSaved} />
        </div>
        <MealList meals={meals} onEdit={onEdit} />
      </div>
      <div className="min-w-0 space-y-5 lg:sticky lg:top-6 lg:self-start">
        <div className="hidden lg:block">
          <ChatCard onSaved={onSaved} />
        </div>
        <section className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={Utensils}
            color="blue"
            value={steps.toLocaleString()}
            label="Steps"
            meta="Today"
          />
          <MetricCard
            icon={Scale}
            color="orange"
            value={latestWeight ? `${latestWeight.weight_kg} kg` : '—'}
            label="Latest weight"
            meta={
              latestWeight
                ? new Date(latestWeight.recorded_at).toLocaleDateString(
                    'en-SG',
                    { day: 'numeric', month: 'short' },
                  )
                : 'No entry'
            }
          />
        </section>
      </div>
    </div>
  );
}

function QuickFoods({
  foods,
  date,
  userId,
  onManage,
  onSaved,
}: {
  foods: SavedFood[];
  date: string;
  userId: string;
  onManage: (food: SavedFood | 'new') => void;
  onSaved: () => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  async function logFood(food: SavedFood) {
    setAdding(food.id);
    setNotice('');
    const now = new Date().toISOString();
    const { error } = await supabase.from('meals').insert({
      user_id: userId,
      date,
      consumed_at: now,
      meal_type: food.meal_type,
      food_name: food.food_name,
      quantity: food.quantity,
      calories: food.calories,
      confidence: 'high',
      notes: food.notes,
      source: 'saved_food',
    });
    if (!error) {
      await supabase
        .from('saved_foods')
        .update({
          times_logged: food.times_logged + 1,
          last_used_at: now,
          updated_at: now,
        })
        .eq('id', food.id);
      setNotice(`${food.food_name} added · ${food.calories} kcal`);
      onSaved();
    } else {
      setNotice(error.message);
    }
    setAdding(null);
  }
  return (
    <section>
      <div className="mb-3 flex items-end justify-between px-1">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-primary">
            One-tap log
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-[-0.025em]">
            Your usuals
          </h2>
        </div>
        {foods.length > 0 && (
          <button
            onClick={() => onManage('new')}
            className="min-h-11 px-1 text-sm font-semibold text-primary"
          >
            + New
          </button>
        )}
      </div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {foods.map((food) => (
          <div
            key={food.id}
            className="relative w-[142px] shrink-0 snap-start rounded-[1.4rem] border border-black/[.055] bg-card p-3.5 shadow-[0_8px_28px_rgba(32,60,49,.06)]"
          >
            <button
              onClick={() => onManage(food)}
              aria-label={`Edit ${food.food_name}`}
              className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <MoreHorizontal className="size-4" />
            </button>
            <span className="grid size-11 place-items-center rounded-2xl bg-[#eef7f1] text-xl">
              {mealIcons[food.meal_type]}
            </span>
            <p className="mt-3 line-clamp-2 min-h-10 text-sm font-bold leading-5">
              {food.food_name}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {food.calories} kcal
            </p>
            <button
              onClick={() => void logFood(food)}
              disabled={adding === food.id}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#e2f3e8] text-xs font-bold text-[#17613f] transition active:scale-[.97] disabled:opacity-60"
            >
              {adding === food.id ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}{' '}
              Add
            </button>
          </div>
        ))}
        <button
          onClick={() => onManage('new')}
          className="flex min-h-[180px] w-[126px] shrink-0 snap-start flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-primary/30 bg-primary/[.035] text-center text-primary"
        >
          <span className="grid size-11 place-items-center rounded-full bg-primary/10">
            <Plus className="size-5" />
          </span>
          <span className="mt-3 px-2 text-sm font-bold">
            {foods.length ? 'Save another' : 'Save your coffee'}
          </span>
        </button>
      </div>
      {notice && (
        <p className="mt-2 rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
          {notice}
        </p>
      )}
    </section>
  );
}

function CalorieRing({
  eaten,
  goal,
  percent,
  dark = false,
}: {
  eaten: number;
  goal: number;
  percent: number;
  dark?: boolean;
}) {
  return (
    <div className="relative mx-auto size-[152px] sm:size-[190px]">
      <svg
        className="size-full -rotate-90"
        viewBox="0 0 120 120"
        aria-label={`${eaten} of ${goal} calories`}
      >
        <circle
          cx="60"
          cy="60"
          r="51"
          fill="none"
          stroke={dark ? 'rgba(255,255,255,.12)' : 'var(--muted)'}
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r="51"
          fill="none"
          stroke={dark ? '#72d39c' : 'var(--primary)'}
          strokeWidth="8"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${percent} 100`}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <strong className="text-3xl tracking-[-0.05em] sm:text-4xl">
          {eaten}
        </strong>
        <span
          className={`mt-1 text-[11px] font-medium ${dark ? 'text-white/55' : 'text-muted-foreground'}`}
        >
          of {goal}
        </span>
      </div>
    </div>
  );
}

function MealList({
  meals,
  onEdit,
}: {
  meals: Meal[];
  onEdit: (meal: Meal) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between px-1">
        <div>
          <h2 className="text-lg font-bold">Meals</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {meals.length
              ? `${meals.length} entries · ${meals.reduce((sum, meal) => sum + meal.calories, 0)} kcal`
              : 'Nothing logged yet'}
          </p>
        </div>
      </div>
      {meals.length === 0 ? (
        <div className="rounded-[1.6rem] border border-dashed border-primary/20 bg-white/70 p-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-xl">
            🍽️
          </span>
          <div className="mt-3">
            <p className="font-semibold">Your plate is clear</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a meal or describe it to Calorie Chat.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[1.6rem] border border-black/[.055] bg-card shadow-[0_8px_30px_rgba(32,60,49,.045)]">
          {meals.map((meal, index) => (
            <button
              key={meal.id}
              onClick={() => onEdit(meal)}
              className={`group flex min-h-[82px] w-full items-center gap-3.5 px-4 py-3.5 text-left transition active:bg-secondary/70 sm:px-5 ${index ? 'border-t border-black/[.055]' : ''}`}
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#f0f7f2] text-xl">
                {mealIcons[meal.meal_type]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold tracking-[-0.01em]">
                  {meal.food_name}
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {mealLabels[meal.meal_type]} ·{' '}
                  {meal.quantity !== 1 ? `×${meal.quantity} · ` : ''}
                  {new Date(meal.consumed_at).toLocaleTimeString('en-SG', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </span>
              <span className="text-right">
                <strong className="block text-[15px]">{meal.calories}</strong>
                <span className="text-[11px] text-muted-foreground">kcal</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ChatCard({ onSaved }: { onSaved: () => void }) {
  const [message, setMessage] = useState('');
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function estimateMeal(event: FormSubmitEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError('');
    setEstimate(null);
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/estimate', {
      method: 'POST',
      headers: authHeaders(data.session?.access_token ?? ''),
      body: JSON.stringify({ message }),
    });
    const result = (await response.json()) as Estimate & { error?: string };
    if (!response.ok)
      setError(
        result.error === 'AI_SETUP_REQUIRED'
          ? 'Add your OpenAI API key to turn on AI estimates.'
          : (result.error ?? 'Unable to estimate this meal.'),
      );
    else setEstimate(result);
    setBusy(false);
  }
  async function saveEstimate() {
    if (!estimate) return;
    setBusy(true);
    setError('');
    const { data } = await supabase.auth.getUser();
    const now = new Date();
    const rows = estimate.meals.map((meal) => ({
      ...meal,
      user_id: data.user!.id,
      date: singaporeDate(),
      consumed_at: now.toISOString(),
      source: 'chatgpt_text',
      idempotency_key: crypto.randomUUID(),
    }));
    const { error: saveError } = await supabase.from('meals').insert(rows);
    if (saveError) setError(saveError.message);
    else {
      setEstimate(null);
      setMessage('');
      onSaved();
    }
    setBusy(false);
  }
  return (
    <section className="rounded-[2rem] border border-black/[.055] bg-white p-5 shadow-[0_14px_45px_rgba(32,60,49,.06)] sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-[#153b30] text-white shadow-[0_8px_24px_rgba(21,59,48,.18)]">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-bold">Ask Cal</h2>
            <span className="rounded-full bg-[#e5f4ea] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#17613f]">
              AI estimate
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Say what you ate, just as you would text it
          </p>
        </div>
      </div>
      {!estimate && (
        <div className="mt-5 rounded-2xl rounded-bl-md bg-[#f1f7f3] px-4 py-3.5 text-sm leading-6">
          <p className="font-semibold text-[#24493a]">What did you eat?</p>
          <p className="text-muted-foreground">
            Try “chicken rice and milk tea, normal sugar”
          </p>
        </div>
      )}
      {estimate && (
        <div className="mt-5 rounded-2xl bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold">{estimate.reply}</p>
          <div className="mt-3 space-y-2">
            {estimate.meals.map((meal, index) => (
              <div
                key={index}
                className="flex justify-between border-t pt-2 text-sm"
              >
                <span>
                  {meal.food_name}
                  <small className="block text-muted-foreground">
                    {meal.calorie_low}–{meal.calorie_high} kcal ·{' '}
                    {meal.confidence.replace('_', ' ')}
                  </small>
                </span>
                <strong>{meal.calories} kcal</strong>
              </div>
            ))}
          </div>
          {estimate.follow_up && (
            <p className="mt-3 text-xs text-muted-foreground">
              {estimate.follow_up}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Button onClick={saveEstimate} disabled={busy} className="flex-1">
              Save {estimate.meals.length > 1 ? 'meals' : 'meal'}
            </Button>
            <Button variant="outline" onClick={() => setEstimate(null)}>
              Edit
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">
          {error}
        </p>
      )}
      <form className="mt-4 flex items-end gap-2" onSubmit={estimateMeal}>
        <label className="sr-only" htmlFor="meal-chat">
          Describe your meal
        </label>
        <textarea
          id="meal-chat"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="I just ate…"
          rows={1}
          className="min-h-12 min-w-0 flex-1 resize-none rounded-2xl border border-input bg-[#fbfdfb] px-4 py-3 text-base leading-6 outline-none ring-primary/15 transition focus:ring-4 sm:text-sm"
        />
        <Button
          type="submit"
          size="icon-lg"
          className="size-12 rounded-2xl"
          disabled={busy}
          aria-label="Estimate meal"
        >
          {busy ? <LoaderCircle className="animate-spin" /> : <Send />}
        </Button>
      </form>
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-muted-foreground">
        <Sparkles className="mt-0.5 size-3 shrink-0" /> Estimates are never
        saved until you review them.
      </p>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  color,
  value,
  label,
  meta,
}: {
  icon: typeof Scale;
  color: 'blue' | 'orange';
  value: string;
  label: string;
  meta: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span
          className={`grid size-9 place-items-center rounded-xl ${color === 'blue' ? 'bg-[#eaf5ff] text-[#2780bd]' : 'bg-[#fff1e7] text-[#c06b32]'}`}
        >
          <Icon className="size-4" />
        </span>
        <span className="text-xs text-muted-foreground">{meta}</span>
      </div>
      <p className="mt-5 text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function HistoryView({
  date,
  meals,
  eaten,
  goal,
  steps,
  weights,
  onDate,
  onEdit,
}: {
  date: string;
  meals: Meal[];
  eaten: number;
  goal: number;
  steps: number;
  weights: WeightEntry[];
  onDate: (date: string) => void;
  onEdit: (meal: Meal) => void;
}) {
  const shift = (days: number) => {
    const d = new Date(`${date}T12:00:00+08:00`);
    d.setDate(d.getDate() + days);
    onDate(singaporeDate(d));
  };
  const dayWeight = weights.find(
    (entry) => singaporeDate(new Date(entry.recorded_at)) === date,
  );
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 lg:px-12 lg:py-9">
      <div className="mb-6 flex items-center justify-between rounded-2xl border bg-card p-3">
        <Button variant="ghost" size="icon" onClick={() => shift(-1)}>
          <ChevronLeft />
        </Button>
        <div className="text-center">
          <p className="font-bold">{readableDate(date)}</p>
          <p className="text-xs text-muted-foreground">
            {date === singaporeDate() ? 'Today' : 'Daily summary'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={date === singaporeDate()}
          onClick={() => shift(1)}
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary value={eaten.toString()} label="Calories" />
        <Summary
          value={calorieDifference(eaten, goal)}
          label={eaten > goal ? 'Over goal' : 'Remaining'}
        />
        <Summary value={steps ? steps.toLocaleString() : '—'} label="Steps" />
        <Summary
          value={dayWeight ? `${dayWeight.weight_kg} kg` : '—'}
          label="Weight"
        />
      </div>
      <MealList meals={meals} onEdit={onEdit} />
    </div>
  );
}
function calorieDifference(eaten: number, goal: number) {
  return Math.abs(goal - eaten).toString();
}
function Summary({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <strong className="text-xl">{value}</strong>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ProgressView({
  meals,
  weights,
  goal,
  userId,
  onSaved,
}: {
  meals: Meal[];
  weights: WeightEntry[];
  goal: number;
  userId: string;
  onSaved: () => void;
}) {
  const [weight, setWeight] = useState('');
  const [stepCount, setStepCount] = useState('');
  const [now] = useState(() => new Date());
  const last7 = Array.from({ length: 7 }, (_, index) =>
    singaporeDate(new Date(now.getTime() - (6 - index) * 86400000)),
  );
  const calories = last7.map((date) =>
    meals
      .filter((meal) => meal.date === date)
      .reduce((sum, meal) => sum + meal.calories, 0),
  );
  const logged = calories.filter(Boolean);
  const average = logged.length
    ? Math.round(logged.reduce((a, b) => a + b, 0) / logged.length)
    : 0;
  async function saveWeight(event: FormSubmitEvent) {
    event.preventDefault();
    if (!weight) return;
    await supabase.from('weight_entries').insert({
      user_id: userId,
      weight_kg: Number(weight),
      recorded_at: new Date().toISOString(),
    });
    setWeight('');
    onSaved();
  }
  async function saveSteps(event: FormSubmitEvent) {
    event.preventDefault();
    if (!stepCount) return;
    await supabase.from('step_entries').upsert(
      {
        user_id: userId,
        date: singaporeDate(),
        steps: Number(stepCount),
        source: 'manual',
      },
      { onConflict: 'user_id,date' },
    );
    setStepCount('');
    onSaved();
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-8 lg:px-12 lg:py-9">
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary
          value={average.toString()}
          label="Average kcal · logged days"
        />
        <Summary
          value={calories
            .filter((value) => value > 0 && value <= goal)
            .length.toString()}
          label="Days under goal · last 7"
        />
        <Summary
          value={weights[0] ? `${weights[0].weight_kg} kg` : '—'}
          label="Current weight"
        />
      </div>
      <section className="rounded-3xl border bg-card p-5 sm:p-7">
        <h2 className="font-bold">7-day calories</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Compared with your {goal} kcal goal
        </p>
        <div className="mt-8 flex h-52 items-end gap-2">
          {calories.map((value, index) => (
            <div
              key={last7[index]}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <span className="text-[10px] text-muted-foreground">
                {value || ''}
              </span>
              <div
                className={`w-full max-w-12 rounded-t-lg ${value > goal ? 'bg-orange-400' : 'bg-primary'}`}
                style={{
                  height: `${Math.max(4, Math.min(100, (value / goal) * 100))}%`,
                }}
              />
              <span className="text-[10px] font-medium text-muted-foreground">
                {new Date(`${last7[index]}T12:00:00`)
                  .toLocaleDateString('en', { weekday: 'short' })
                  .slice(0, 1)}
              </span>
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        <QuickEntry
          title="Log weight"
          suffix="kg"
          value={weight}
          setValue={setWeight}
          onSubmit={saveWeight}
        />
        <QuickEntry
          title="Update today’s steps"
          suffix="steps"
          value={stepCount}
          setValue={setStepCount}
          onSubmit={saveSteps}
        />
      </div>
    </div>
  );
}
function QuickEntry({
  title,
  suffix,
  value,
  setValue,
  onSubmit,
}: {
  title: string;
  suffix: string;
  value: string;
  setValue: (value: string) => void;
  onSubmit: (event: FormSubmitEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border bg-card p-5">
      <h3 className="font-bold">{title}</h3>
      <div className="mt-4 flex gap-2">
        <div className="flex flex-1 items-center rounded-xl border bg-background pr-3">
          <input
            required
            min="0"
            step={suffix === 'kg' ? '0.1' : '1'}
            type="number"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 outline-none"
          />
          <span className="text-xs text-muted-foreground">{suffix}</span>
        </div>
        <Button type="submit" className="h-11">
          Save
        </Button>
      </div>
    </form>
  );
}

function SettingsView({
  goal,
  userId,
  email,
  onSaved,
  onSignOut,
}: {
  goal: number;
  userId: string;
  email: string;
  onSaved: () => void;
  onSignOut: () => void;
}) {
  const [newGoal, setNewGoal] = useState(goal.toString());
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState(false);
  async function submit(event: FormSubmitEvent) {
    event.preventDefault();
    const date = singaporeDate();
    await Promise.all([
      supabase.from('user_settings').upsert({
        user_id: userId,
        daily_calorie_goal: Number(newGoal),
        timezone: 'Asia/Singapore',
        target_weight: target ? Number(target) : null,
        updated_at: new Date().toISOString(),
      }),
      supabase.from('daily_goals').upsert(
        {
          user_id: userId,
          effective_date: date,
          calorie_goal: Number(newGoal),
        },
        { onConflict: 'user_id,effective_date' },
      ),
    ]);
    setSaved(true);
    onSaved();
    setTimeout(() => setSaved(false), 2000);
  }
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8 lg:px-12 lg:py-9">
      <form onSubmit={submit} className="rounded-3xl border bg-card p-6 sm:p-8">
        <h2 className="text-lg font-bold">Your goals</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Changes apply from today. Previous goals remain in your history.
        </p>
        <label className="mt-6 block text-sm font-semibold">
          Daily calorie goal
          <input
            type="number"
            min="500"
            max="10000"
            value={newGoal}
            onChange={(event) => setNewGoal(event.target.value)}
            className="mt-2 block h-11 w-full rounded-xl border bg-background px-3 font-normal"
          />
        </label>
        <label className="mt-5 block text-sm font-semibold">
          Target weight (optional)
          <input
            type="number"
            min="20"
            max="500"
            step="0.1"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className="mt-2 block h-11 w-full rounded-xl border bg-background px-3 font-normal"
          />
        </label>
        <label className="mt-5 block text-sm font-semibold">
          Timezone
          <input
            disabled
            value="Asia/Singapore"
            className="mt-2 block h-11 w-full rounded-xl border bg-muted px-3 font-normal text-muted-foreground"
          />
        </label>
        <Button type="submit" className="mt-7 h-11 px-5">
          {saved ? 'Saved!' : 'Save settings'}
        </Button>
      </form>
      <div className="mt-4 flex items-center gap-3 rounded-2xl border bg-card p-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Signed in as</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{email}</p>
        </div>
        <Button type="button" variant="outline" onClick={onSignOut}>
          <LogOut /> Sign out
        </Button>
      </div>
    </div>
  );
}

function SavedFoodModal({
  value,
  userId,
  onClose,
  onSaved,
}: {
  value: SavedFood | null;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(value?.food_name ?? '');
  const [type, setType] = useState<MealType>(value?.meal_type ?? 'drink');
  const [calories, setCalories] = useState(value?.calories.toString() ?? '');
  const [quantity, setQuantity] = useState(value?.quantity.toString() ?? '1');
  const [notes, setNotes] = useState(value?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormSubmitEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const payload = {
      user_id: userId,
      food_name: name.trim(),
      meal_type: type,
      quantity: Number(quantity),
      calories: Number(calories),
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const result = value
      ? await supabase.from('saved_foods').update(payload).eq('id', value.id)
      : await supabase.from('saved_foods').insert(payload);
    if (result.error) {
      setError(
        result.error.code === '23505'
          ? 'You already have a saved food with this name.'
          : result.error.message,
      );
      setBusy(false);
      return;
    }
    onSaved();
  }

  async function remove() {
    if (!value) return;
    setBusy(true);
    setError('');
    const { error: deleteError } = await supabase
      .from('saved_foods')
      .delete()
      .eq('id', value.id);
    if (deleteError) {
      setError(deleteError.message);
      setBusy(false);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-[#102e25]/50 backdrop-blur-sm sm:place-items-center sm:p-6">
      <form
        onSubmit={submit}
        className="max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-card px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:rounded-[2rem] sm:p-7"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border sm:hidden" />
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-[#e6f4eb] text-primary">
            <Coffee className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-[-0.025em]">
              {value ? 'Edit saved food' : 'Save a usual'}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Add it to today with one tap next time.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="size-11 rounded-full"
          >
            <X />
          </Button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Food or drink" wide>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Morning coffee"
            />
          </Field>
          <Field label="Type">
            <select
              value={type}
              onChange={(event) => setType(event.target.value as MealType)}
            >
              {Object.entries(mealLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Calories">
            <input
              required
              type="number"
              inputMode="numeric"
              min="0"
              value={calories}
              onChange={(event) => setCalories(event.target.value)}
              placeholder="120"
            />
          </Field>
          <Field label="Quantity">
            <input
              required
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
          <Field label="Notes (optional)" wide>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Oat milk, no sugar"
            />
          </Field>
        </div>
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          {value && (
            <Button
              type="button"
              variant="destructive"
              onClick={remove}
              disabled={busy}
              className="h-12 rounded-2xl"
            >
              <Trash2 /> Delete
            </Button>
          )}
          <Button
            type="submit"
            className="ml-auto h-12 rounded-2xl px-6"
            disabled={busy}
          >
            {busy ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <BookmarkPlus />
            )}
            {value ? 'Save changes' : 'Save to usuals'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function MealModal({
  value,
  date,
  userId,
  onClose,
  onSaved,
}: {
  value: Meal | null;
  date: string;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(value?.food_name ?? '');
  const [type, setType] = useState<MealType>(value?.meal_type ?? 'lunch');
  const [calories, setCalories] = useState(value?.calories.toString() ?? '');
  const [quantity, setQuantity] = useState(value?.quantity.toString() ?? '1');
  const [low, setLow] = useState(value?.calorie_low?.toString() ?? '');
  const [high, setHigh] = useState(value?.calorie_high?.toString() ?? '');
  const [notes, setNotes] = useState(value?.notes ?? '');
  const [saveAsUsual, setSaveAsUsual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormSubmitEvent) {
    event.preventDefault();
    setBusy(true);
    const payload = {
      user_id: userId,
      date,
      consumed_at: value?.consumed_at ?? new Date().toISOString(),
      meal_type: type,
      food_name: name,
      quantity: Number(quantity),
      calories: Number(calories),
      calorie_low: low ? Number(low) : null,
      calorie_high: high ? Number(high) : null,
      confidence: value?.confidence ?? 'high',
      notes: notes || null,
      source: value?.source ?? 'manual',
      updated_at: new Date().toISOString(),
    };
    const result = value
      ? await supabase.from('meals').update(payload).eq('id', value.id)
      : await supabase.from('meals').insert(payload);
    if (result.error) {
      setError(result.error.message);
      setBusy(false);
      return;
    }
    if (!value && saveAsUsual) {
      const usualResult = await supabase.from('saved_foods').insert({
        user_id: userId,
        food_name: name.trim(),
        meal_type: type,
        quantity: Number(quantity),
        calories: Number(calories),
        notes: notes.trim() || null,
      });
      if (usualResult.error && usualResult.error.code !== '23505') {
        console.error('Could not save usual food:', usualResult.error.message);
      }
    }
    onSaved();
    setBusy(false);
  }
  async function remove() {
    if (!value) return;
    setBusy(true);
    const { error: deleteError } = await supabase
      .from('meals')
      .delete()
      .eq('id', value.id);
    if (deleteError) setError(deleteError.message);
    else onSaved();
    setBusy(false);
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-[#153a2d]/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-6">
      <form
        onSubmit={submit}
        className="max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-card px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:rounded-[2rem] sm:p-7"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border sm:hidden" />
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {value ? 'Edit meal' : 'Add a meal'}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {readableDate(date)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="size-11 rounded-full"
          >
            <X />
          </Button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Food name" wide>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Chicken rice"
            />
          </Field>
          <Field label="Meal type">
            <select
              value={type}
              onChange={(event) => setType(event.target.value as MealType)}
            >
              {Object.entries(mealLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Total calories">
            <input
              required
              type="number"
              inputMode="numeric"
              min="0"
              value={calories}
              onChange={(event) => setCalories(event.target.value)}
            />
          </Field>
          <Field label="Quantity">
            <input
              required
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
          <Field label="Low estimate">
            <input
              type="number"
              min="0"
              value={low}
              onChange={(event) => setLow(event.target.value)}
            />
          </Field>
          <Field label="High estimate">
            <input
              type="number"
              min="0"
              value={high}
              onChange={(event) => setHigh(event.target.value)}
            />
          </Field>
          <Field label="Notes" wide>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Optional details"
            />
          </Field>
        </div>
        {!value && (
          <div className="mt-5 flex min-h-14 items-center gap-3 rounded-2xl border border-primary/15 bg-[#f0f8f3] px-4 py-3">
            <input
              id="save-as-usual"
              type="checkbox"
              checked={saveAsUsual}
              onChange={(event) => setSaveAsUsual(event.target.checked)}
              className="size-5 accent-primary"
            />
            <label
              htmlFor="save-as-usual"
              className="min-w-0 flex-1 cursor-pointer"
            >
              <span className="block text-sm font-bold">
                Save to Your usuals
              </span>
              <span className="block text-xs text-muted-foreground">
                Log this same item with one tap next time.
              </span>
            </label>
          </div>
        )}
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          {value && (
            <Button
              type="button"
              variant="destructive"
              onClick={remove}
              disabled={busy}
              className="h-12 rounded-2xl"
            >
              <Trash2 /> Delete
            </Button>
          )}
          <Button
            type="submit"
            className="ml-auto h-12 rounded-2xl px-5"
            disabled={busy}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <Pencil />}{' '}
            {value ? 'Save changes' : 'Add meal'}
          </Button>
        </div>
      </form>
    </div>
  );
}
function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`text-sm font-semibold ${wide ? 'sm:col-span-2' : ''}`}>
      {label}
      <span className="mt-2 block [&>input]:h-11 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:bg-background [&>input]:px-3 [&>input]:font-normal [&>select]:h-11 [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:bg-background [&>select]:px-3 [&>select]:font-normal [&>textarea]:w-full [&>textarea]:rounded-xl [&>textarea]:border [&>textarea]:bg-background [&>textarea]:p-3 [&>textarea]:font-normal">
        {children}
      </span>
    </label>
  );
}

function AuthScreen({
  defaultIdentifier,
  defaultPassword,
}: {
  defaultIdentifier: string;
  defaultPassword: string;
}) {
  const [identifier, setIdentifier] = useState(defaultIdentifier);
  const [password, setPassword] = useState(defaultPassword);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setIdentifier(defaultIdentifier);
      setPassword(defaultPassword);
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [defaultIdentifier, defaultPassword]);

  async function submit(event: FormSubmitEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const email = identifierToEmail(identifier);
    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { user_id: identifier.trim() } },
          });
    setMessage(
      result.error?.message ??
        (mode === 'signup' && !result.data.session
          ? 'Check your email to confirm your account.'
          : 'Welcome to Calorie Chat.'),
    );
    setBusy(false);
  }
  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top_left,#dff4e7,transparent_42%),var(--background)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:p-5">
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-5xl items-center gap-10 sm:min-h-[calc(100dvh-40px)] lg:grid-cols-2">
        <section className="hidden lg:block">
          <Brand />
          <p className="mt-20 text-sm font-semibold uppercase tracking-[.18em] text-primary">
            Eat. Ask. Track.
          </p>
          <h1 className="mt-4 max-w-md text-5xl font-bold leading-[1.05] tracking-[-.055em]">
            A calorie tracker that speaks your language.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-8 text-muted-foreground">
            Describe a meal naturally, review a sensible estimate, then watch
            your daily total update.
          </p>
        </section>
        <form
          onSubmit={submit}
          className="mx-auto w-full max-w-md rounded-[2rem] border border-black/[.055] bg-card p-6 shadow-[0_24px_70px_rgba(24,59,47,.12)] sm:p-9"
        >
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
              Welcome
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-.04em]">
              {mode === 'login' ? 'Sign in' : 'Create your account'}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in with your User ID or your email address.
            </p>
          </div>
          <label className="block text-sm font-semibold">
            User ID or email
            <input
              required
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border bg-background px-4 font-normal"
            />
          </label>
          <label className="mt-5 block text-sm font-semibold">
            Password
            <input
              required
              minLength={6}
              type="password"
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border bg-background px-4 font-normal"
            />
          </label>
          {message && (
            <p className="mt-4 rounded-xl bg-secondary p-3 text-sm">
              {message}
            </p>
          )}
          <Button
            type="submit"
            disabled={busy}
            className="mt-6 h-12 w-full rounded-xl"
          >
            {busy && <LoaderCircle className="animate-spin" />}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setMessage('');
            }}
            className="mt-3 min-h-11 w-full rounded-xl text-sm font-semibold text-primary"
          >
            {mode === 'login'
              ? 'New here? Create an account'
              : 'Already have an account? Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
function FullScreenLoader({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`grid place-items-center ${compact ? 'min-h-[55vh]' : 'min-h-screen bg-background'}`}
    >
      <div className="text-center">
        <LoaderCircle className="mx-auto size-7 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Loading your day…</p>
      </div>
    </div>
  );
}
