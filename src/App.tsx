import { readApiJson } from "./api";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Mic,
  MessageCircle,
  NotebookText,
  UserRound,
  ChevronDown,
  Check,
  Plus,
  Footprints,
  Bell,
  ArrowLeft,
  Trash2,
  X,
  Pencil,
} from "lucide-react";
import {
  conflict,
  dateKey,
  emptyState,
  estimate,
  totals,
  validateResponse,
  type State,
  type Profile,
  type Food,
  type Meal,
  type Proposal,
} from "./model";
const KEY = "nudge.local.v1";
const initialProfile: Profile = {
  name: "",
  height: 165,
  weight: 62,
  activity: "Medium",
  goal: "Maintain",
  meals: 3,
  preferences: "",
  dislikes: "",
  allergies: "",
  language: "English",
  budget: 0,
  cycle: false,
};
const uid = () => crypto.randomUUID();
function read() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    return s && Array.isArray(s.foods) && Array.isArray(s.chat)
      ? (s as State)
      : emptyState();
  } catch {
    return emptyState();
  }
}
function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? "logo small" : "logo"} aria-label="Nudge logo">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <g
          transform="rotate(16 50 50)"
          fill="none"
          stroke="currentColor"
          strokeWidth="15"
          strokeLinecap="round"
        >
          <path d="M35 73V35 M35 47C35 23 73 23 73 48V73" />
          <path d="M16 46V57" strokeWidth="9" />
        </g>
      </svg>
    </span>
  );
}
function Languages({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="languages" aria-label="Language">
      {["English", "Hindi", "Mix"].map((l) => (
        <button
          key={l}
          className={value === l ? "selected" : ""}
          aria-pressed={value === l}
          onClick={() => onChange(l)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
function ProfileForm({
  profile,
  onSave,
  onBack,
}: {
  profile: Profile;
  onSave: (p: Profile) => void;
  onBack: () => void;
}) {
  const [p, setP] = useState(profile);
  const [mode, setMode] = useState<"manual" | "estimate">("manual");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [special, setSpecial] = useState(false);
  const [maintenance, setMaintenance] = useState(0);
  const [error, setError] = useState("");
  const set = (k: keyof Profile, v: unknown) => setP({ ...p, [k]: v });
  const propose = () => {
    try {
      if (special)
        throw Error(
          "Use a personally chosen budget instead of an adult estimate for these circumstances.",
        );
      const m = estimate(p.weight, p.height, Number(age), sex, p.activity);
      setMaintenance(m);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="form-screen">
      <button className="back" onClick={onBack}>
        <ArrowLeft size={18} /> Back
      </button>
      <h1>
        {profile.budget ? "Your details, your rules." : "Let’s get to know you"}
      </h1>
      <p className="subtitle">A few basics. Then we’ll figure out the menu.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            p.budget < 800 ||
            p.budget > 6000 ||
            p.height < 100 ||
            p.height > 250 ||
            p.weight < 25 ||
            p.weight > 350 ||
            !p.allergies.trim()
          ) {
            setError(
              "Check your measurements, allergies, and daily budget (800–6,000 kcal).",
            );
            return;
          }
          onSave(p);
        }}
      >
        <label>
          Name{" "}
          <input
            value={p.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="What should we call you?"
            maxLength={60}
          />
        </label>
        <div className="two">
          <label>
            Height (cm)
            <input
              required
              type="number"
              min="100"
              max="250"
              value={p.height}
              onChange={(e) =>
                set(
                  "height",
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
            />
          </label>
          <label>
            Weight (kg)
            <input
              required
              type="number"
              step="0.1"
              min="25"
              max="350"
              value={p.weight}
              onChange={(e) =>
                set(
                  "weight",
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
            />
          </label>
        </div>
        <label>
          Activity level
          <select
            value={p.activity}
            onChange={(e) => set("activity", e.target.value)}
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </label>
        <div className="two">
          <label>
            Your goal
            <select
              value={p.goal}
              onChange={(e) => set("goal", e.target.value)}
            >
              <option value="Lose">Lose weight</option>
              <option value="Maintain">Maintain weight</option>
              <option value="Gain">Gain weight</option>
            </select>
          </label>
          <label>
            Meals per day
            <select
              value={p.meals}
              onChange={(e) => set("meals", Number(e.target.value))}
            >
              <option value={3}>3 meals</option>
              <option value={4}>4 meals, with snacks</option>
            </select>
          </label>
        </div>
        <label>
          Food preferences
          <input
            value={p.preferences}
            onChange={(e) => set("preferences", e.target.value)}
            placeholder="Vegetarian, Indian, quick lunches…"
          />
        </label>
        <label>
          Dislikes
          <input
            value={p.dislikes}
            onChange={(e) => set("dislikes", e.target.value)}
            placeholder="Comma-separated foods"
          />
        </label>
        <label>
          Allergies
          <input
            required
            value={p.allergies}
            onChange={(e) => set("allergies", e.target.value)}
            placeholder="e.g. peanuts, milk"
          />
        </label>
        <button
          type="button"
          className="text-button"
          onClick={() => set("allergies", "None")}
        >
          No known allergies — None
        </button>
        <small>
          Ingredients are checked against your exclusions. Cross-contact cannot
          be guaranteed.
        </small>
        <h2>Your daily budget</h2>
        <div className="segmented">
          <button
            type="button"
            className={mode === "manual" ? "active" : ""}
            onClick={() => setMode("manual")}
          >
            Enter my own
          </button>
          <button
            type="button"
            className={mode === "estimate" ? "active" : ""}
            onClick={() => setMode("estimate")}
          >
            Help me estimate
          </button>
        </div>
        {mode === "estimate" && (
          <div className="estimate">
            <p>
              This adult calorie estimate uses your weight, height, age and sex.
              The original study uses different adjustments for females and
              males. You can enter your own budget instead. Activity levels are
              rough estimates, not measurements.
            </p>
            <div className="two">
              <label>
                Age
                <input
                  type="number"
                  min="18"
                  max="100"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </label>
              <label>
                Sex for calorie estimate
                <select value={sex} onChange={(e) => setSex(e.target.value)}>
                  <option value="">Choose</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={special}
                onChange={(e) => setSpecial(e.target.checked)}
              />
              Pregnancy or circumstances needing a personalised estimate
            </label>
            <small>
              For under-18s or special circumstances, use a budget chosen with
              appropriate professional guidance. You can enter your own without
              sharing age or sex.
            </small>
            <button type="button" className="secondary" onClick={propose}>
              Calculate estimate
            </button>
            {maintenance > 0 && (
              <div className="estimate-result">
                <strong>
                  Estimated maintenance: {maintenance.toLocaleString()} kcal/day
                </strong>
                <small>
                  RMR = 10 × kg + 6.25 × cm − 5 × age{" "}
                  {sex === "male" ? "+ 5" : "− 161"}. Activity multiplier:{" "}
                  {p.activity === "Low"
                    ? "1.2"
                    : p.activity === "Medium"
                      ? "1.55"
                      : "1.725"}
                  . This estimates maintenance, not your goal target.
                </small>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => set("budget", maintenance)}
                >
                  Use maintenance budget
                </button>
                {p.goal !== "Maintain" && (
                  <>
                    <small>
                      Optional{" "}
                      {p.goal === "Lose"
                        ? "250 kcal reduction"
                        : "250 kcal increase"}{" "}
                      for your selected goal. This is a starting preference, not
                      a clinical recommendation; only applied if you accept.
                    </small>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        set(
                          "budget",
                          maintenance + (p.goal === "Lose" ? -250 : 250),
                        )
                      }
                    >
                      Accept proposed{" "}
                      {maintenance + (p.goal === "Lose" ? -250 : 250)} kcal
                      budget
                    </button>
                  </>
                )}
                <a
                  href="https://pubmed.ncbi.nlm.nih.gov/2305711/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Original study (1990)
                </a>
              </div>
            )}
          </div>
        )}
        <label>
          Daily calorie budget (kcal)
          <input
            required
            type="number"
            min="800"
            max="6000"
            value={p.budget || ""}
            onChange={(e) => set("budget", Number(e.target.value))}
            placeholder="Enter a budget you choose"
          />
        </label>
        <small>Editable anytime. Steps do not increase this budget.</small>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary" type="submit">
          {profile.budget ? "Save changes" : "Continue"} <ArrowUp size={17} />
        </button>
      </form>
    </div>
  );
}
export default function App() {
  const [state, setState] = useState<State>(read);
  const [screen, setScreen] = useState(state.profile ? "home" : "starter");
  const [language, setLanguage] = useState(
    state.profile?.language || "English",
  );
  const [text, setText] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(
    state.proposal || null,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(false);
  const [manual, setManual] = useState(false);
  const [ledger, setLedger] = useState(false);
  const [logDate, setLogDate] = useState(dateKey());
  const [food, setFood] = useState({
    name: "",
    portion: "",
    calories: "",
    assumptions: "User-entered nutrition estimate",
  });
  const [editId, setEditId] = useState("");
  const [editing, setEditing] = useState(false);
  const [openDay, setOpenDay] = useState("Mon");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [stepEdit, setStepEdit] = useState(false);
  const [stepValue, setStepValue] = useState("");
  const [mealEdit, setMealEdit] = useState<{
    day: string;
    index: number;
    meal: Meal;
  } | null>(null);
  const [recording, setRecording] = useState(false);
  const [undo, setUndo] = useState<Food[] | null>(null);
  const [day, setDay] = useState(dateKey());
  const lock = useRef(false);
  const requestEpoch = useRef(0);
  const recognition = useRef<any>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      setError(
        "Local storage is full or unavailable. Keep this page open and free storage before closing.",
      );
    }
  }, [state]);
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => setAi(d.configured === true))
      .catch(() => setAi(false));
    const timer = setInterval(() => setDay(dateKey()), 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [state.chat, busy]);
  useEffect(() => () => recognition.current?.abort(), []);
  useEffect(() => {
    setState((s) => ({ ...s, proposal }));
  }, [proposal]);
  useEffect(() => {
    if (!(manual || ledger || privacy || deleteConfirm || stepEdit || mealEdit))
      return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>(".modal");
    const controls = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),input,select,a[href]",
        ) || [],
      );
    controls()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setManual(false);
        setLedger(false);
        setPrivacy(false);
        setDeleteConfirm(false);
        setStepEdit(false);
        setMealEdit(null);
      }
      if (e.key === "Tab") {
        const items = controls();
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [manual, ledger, privacy, deleteConfirm, stepEdit, !!mealEdit]);
  const p = state.profile;
  const t = totals(state.foods, p?.budget || 0, day);
  const paused = state.paused === day;
  const update = (patch: Partial<State>) =>
    setState((s) => ({ ...s, ...patch }));
  const ask = async (message: string) => {
    if (lock.current || !p || !message.trim()) return;
    if (/^i (?:don['’]t|do not) care today[.!]?$/i.test(message.trim())) {
      setState((s) => ({
        ...s,
        paused: dateKey(),
        chat: [...s.chat, { id: uid(), role: "user", text: message }],
      }));
      setText("");
      return;
    }
    const epoch = requestEpoch.current;
    lock.current = true;
    setBusy(true);
    setError("");
    setText("");
    setState((s) => ({
      ...s,
      chat: [...s.chat, { id: uid(), role: "user", text: message }],
    }));
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          context: {
            profile: {
              ...p,
              name: undefined,
              height: undefined,
              weight: undefined,
            },
            today: day,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            eaten: t.eaten,
            remaining: t.remaining,
            paused,
            plan: state.draft.length ? state.draft : state.plan,
            history: state.chat.slice(-6),
          },
        }),
        signal: AbortSignal.timeout(65000),
      });
      const raw = await readApiJson(response);
      if (epoch !== requestEpoch.current) return;
      if (!response.ok) throw Error(raw.error || "AI is unavailable.");
      const result = validateResponse(raw, p);
      if (/^i\s+want\b/i.test(message) && result.kind === "log")
        throw Error(
          "A planning request cannot be logged as intake. Please retry.",
        );
      setState((s) => ({
        ...s,
        chat: [
          ...s.chat,
          { id: uid(), role: "assistant", text: result.message },
        ],
      }));
      if (result.kind !== "message")
        setProposal({
          kind: result.kind,
          foods: result.foods,
          days: result.days.map((d) => ({
            ...d,
            meals: d.meals.map((m) => ({ ...m, approved: false })),
          })),
        });
      setAi(true);
    } catch (e) {
      if (epoch === requestEpoch.current) setError((e as Error).message);
    } finally {
      if (epoch === requestEpoch.current) {
        setBusy(false);
        lock.current = false;
      }
    }
  };
  const dictate = () => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError(
        "Dictation is not supported in this browser. Please type your message.",
      );
      return;
    }
    if (recording) {
      recognition.current?.stop();
      return;
    }
    try {
      const r = new SR();
      recognition.current = r;
      r.lang = language === "English" ? "en-IN" : "hi-IN";
      r.onstart = () => setRecording(true);
      r.onend = () => setRecording(false);
      r.onerror = () => {
        setRecording(false);
        setError("Microphone access or dictation failed. Please type instead.");
      };
      r.onresult = (e: any) =>
        setText((v) => `${v} ${e.results[0][0].transcript}`.trim());
      r.start();
    } catch {
      setRecording(false);
      setError("Could not start dictation. Please type instead.");
    }
  };
  const input = (welcome = false) => (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        if (welcome) {
          update({ pending: text });
          setText("");
          setScreen("onboarding");
        } else ask(text);
      }}
    >
      <button
        type="button"
        aria-label={recording ? "Stop dictation" : "Start dictation"}
        className={recording ? "recording" : ""}
        onClick={dictate}
      >
        <Mic size={22} />
      </button>
      <input
        aria-label="Message"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Tell me what you ate…"
        maxLength={4000}
      />
      <button
        className="send"
        aria-label="Send message"
        disabled={busy || !text.trim()}
      >
        <ArrowUp size={22} />
      </button>
    </form>
  );
  const saveProfile = (next: Profile) => {
    requestEpoch.current++;
    lock.current = false;
    setBusy(false);
    const changed = !!p && p.meals !== next.meals;
    update({ profile: next, draft: changed ? [] : state.draft });
    setLanguage(next.language);
    setProposal(null);
    setEditing(false);
    setScreen("home");
    if (changed)
      setError(
        "Meal count changed. Your approved plan and food history are preserved. Generate a revised draft to approve.",
      );
  };
  const saveManual = () => {
    if (
      !food.name.trim() ||
      !food.portion.trim() ||
      food.calories === "" ||
      !Number.isFinite(Number(food.calories)) ||
      Number(food.calories) < 0 ||
      Number(food.calories) > 10000
    ) {
      setError("Enter a food, portion, and valid calorie estimate.");
      return;
    }
    setUndo(state.foods);
    const item: Food = {
      id: editId || uid(),
      date: logDate,
      name: food.name.trim(),
      portion: food.portion.trim(),
      calories: Number(food.calories),
      assumptions: food.assumptions,
    };
    update({
      foods: editId
        ? state.foods.map((f) => (f.id === editId ? item : f))
        : [...state.foods, item],
      pending: "",
    });
    setManual(false);
    setEditId("");
    setError("");
  };
  const showManual = (f?: Food) => {
    setEditId(f?.id || "");
    setLogDate(f?.date || day);
    setFood(
      f
        ? {
            name: f.name,
            portion: f.portion,
            calories: String(f.calories),
            assumptions: f.assumptions,
          }
        : {
            name: state.pending,
            portion: "",
            calories: "",
            assumptions: "User-entered nutrition estimate",
          },
    );
    setManual(true);
  };
  const accept = () => {
    if (!proposal) return;
    if (proposal.kind === "log") {
      setUndo(state.foods);
      update({
        foods: [
          ...state.foods,
          ...proposal.foods.map((f) => ({ ...f, id: uid(), date: day })),
        ],
        pending: "",
      });
    } else {
      update({ draft: proposal.days });
      setScreen("menu");
    }
    setProposal(null);
  };
  const mealCard = (m: Meal, d: string, i: number, draft: boolean) => (
    <div className="meal" key={m.slot}>
      <div className="meal-heading">
        <strong>{m.slot}</strong>
        <span>{m.calories} kcal est.</span>
      </div>
      <h3>{m.name}</h3>
      {p && conflict(m, p) && (
        <p className="error">
          {conflict(m, p)}. Update or regenerate this plan before using it.
        </p>
      )}
      <p>{m.portion}</p>
      <small>{m.ingredients.join(" · ")}</small>
      <small>{m.assumptions}</small>
      <div className="meal-actions">
        <button
          onClick={() => setMealEdit({ day: d, index: i, meal: { ...m } })}
        >
          <Pencil size={14} /> Edit
        </button>
        <button
          disabled={busy}
          onClick={() =>
            ask(
              `Swap ${d} ${m.slot}. Return a complete revised seven-day draft, preserving other meals and all exclusions.`,
            )
          }
        >
          Swap
        </button>
        {draft && (
          <button
            onClick={() =>
              update({
                draft: state.draft.map((x) =>
                  x.day === d
                    ? {
                        ...x,
                        meals: x.meals.map((v, j) =>
                          j === i ? { ...v, approved: !v.approved } : v,
                        ),
                      }
                    : x,
                ),
              })
            }
          >
            <Check size={14} />
            {m.approved ? "Approved" : "Approve meal"}
          </button>
        )}
      </div>
    </div>
  );
  if (screen === "starter")
    return (
      <main className="app starter">
        <div className="starter-center">
          <Logo />
          <h1>
            Nudge<span className="orange-dot">.</span>
          </h1>
          <p>Your personal menu curator.</p>
          <h2>
            A little nudge.
            <br />A lot less overthinking.
          </h2>
        </div>
        <button className="primary" onClick={() => setScreen("welcome")}>
          Let’s get started <ArrowUp size={18} />
        </button>
        <small className="starter-foot">A plan you have a say in.</small>
      </main>
    );
  if (screen === "welcome")
    return (
      <main className="app welcome">
        <header>
          <button
            className="icon"
            aria-label="Back"
            onClick={() => setScreen("starter")}
          >
            <ArrowLeft />
          </button>
          <Languages value={language} onChange={setLanguage} />
        </header>
        <div className="welcome-message">
          <Logo small />
          <div className="bubble assistant">
            {language === "Hindi"
              ? "आज क्या खाया? चलो तय करें आगे क्या खाना है।"
              : language === "Mix"
                ? "Aaj kya khaya? Let’s figure out what’s next."
                : "What did you eat today? Let’s figure out what’s next."}
          </div>
        </div>
        <div className="welcome-bottom">
          <p className="muted">
            No perfect days required. Just your next meal.
          </p>
          {input(true)}
          <button
            className="text-button"
            onClick={() => setScreen("onboarding")}
          >
            Set up my menu first <ArrowUp size={14} />
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      </main>
    );
  if (screen === "onboarding" || editing)
    return (
      <main className="app">
        <ProfileForm
          profile={p || { ...initialProfile, language }}
          onSave={saveProfile}
          onBack={() => {
            if (p) setEditing(false);
            else setScreen("welcome");
          }}
        />
      </main>
    );
  return (
    <main className="app shell">
      <header className="topbar">
        <span className="eyebrow">
          {screen === "home"
            ? "YOUR DAY, A LITTLE SIMPLER"
            : screen === "menu"
              ? "GOOD FOOD. LESS GUESSWORK."
              : "MAKE IT YOURS"}
        </span>
        <button
          className="icon"
          aria-label="Privacy information"
          onClick={() => setPrivacy(true)}
        >
          <Bell size={21} />
        </button>
      </header>
      {screen === "home" && (
        <>
          <div className="home-heading">
            <h1>
              {p?.name
                ? `Hey, ${p.name.split(" ")[0]}.`
                : "A little room for you."}
            </h1>
            <p className="subtitle">Let’s make your next meal easy.</p>
          </div>
          <section className="calorie-panel">
            <div
              className="ring"
              style={{
                background: `conic-gradient(#FF784F ${Math.min(100, (t.eaten / (p?.budget || 1)) * 100)}%, #FFE5D4 0)`,
              }}
            >
              <div>
                <strong>{t.eaten.toLocaleString()}</strong>
                <span>/ {p?.budget.toLocaleString()} kcal</span>
                <small>eaten · estimated</small>
              </div>
            </div>
            <div className="step-panel">
              <Footprints color="#FF784F" size={29} />
              <strong>{state.steps[day]?.toLocaleString() ?? "—"}</strong>
              <span>Steps</span>
              <button
                className="text-button"
                onClick={() => {
                  setStepValue(String(state.steps[day] || ""));
                  setStepEdit(true);
                }}
              >
                {state.steps[day] === undefined ? "Add manually" : "Edit steps"}
              </button>
              <small>No device connected</small>
            </div>
            <div className="remaining">
              <span>
                {t.remaining < 0
                  ? `${Math.abs(t.remaining).toLocaleString()} kcal over budget`
                  : `${t.remaining.toLocaleString()} kcal remaining`}
              </span>
              <button
                onClick={() => {
                  setLogDate(day);
                  setLedger(true);
                }}
                aria-label="Open food ledger"
              >
                <NotebookText size={17} /> Ledger
              </button>
            </div>
          </section>
          <div className="day-label">
            TODAY{" "}
            <span>
              {new Date().toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          {state.pending && (
            <div className="card pending">
              <strong>Your first entry is still here.</strong>
              <p>{state.pending}</p>
              <small>
                Nothing counted yet. Confirm a portion and estimate first.
              </small>
              <div className="actions">
                <button
                  className="secondary"
                  onClick={() =>
                    ask(
                      `I ate ${state.pending}. Prepare a food preview or ask for portion clarification.`,
                    )
                  }
                >
                  Estimate with AI
                </button>
                <button onClick={() => showManual()}>Enter manually</button>
              </div>
            </div>
          )}
          <section className="chat" aria-label="Conversation">
            {!state.chat.length && (
              <div className="chat-line">
                <Logo small />
                <div className="bubble assistant">
                  <strong>A plan that fits your day.</strong>
                  <p>
                    Log what you ate, ask about a portion, or make room for
                    something you fancy.
                  </p>
                </div>
              </div>
            )}
            {state.chat.map((c) => (
              <div className={`chat-line ${c.role}`} key={c.id}>
                {c.role === "assistant" && <Logo small />}
                <div className={`bubble ${c.role}`}>{c.text}</div>
              </div>
            ))}
            {busy && (
              <p className="thinking" role="status">
                Thinking through your menu…
              </p>
            )}
            <div ref={chatEnd} />
          </section>
          {proposal && (
            <section className="card proposal">
              <span className="eyebrow">
                {proposal.kind === "log"
                  ? "FOOD LOG PREVIEW"
                  : "A LITTLE MENU ADJUSTMENT"}
              </span>
              <h2>
                {proposal.kind === "log"
                  ? "Count this as eaten?"
                  : "Your plan, revised."}
              </h2>
              {proposal.kind === "log" ? (
                proposal.foods.map((f, i) => (
                  <div className="preview-food" key={i}>
                    <strong>
                      {f.name} <span>{f.calories} kcal est.</span>
                    </strong>
                    <p>{f.portion}</p>
                    <small>{f.assumptions}</small>
                  </div>
                ))
              ) : (
                <>
                  <p>
                    A complete seven-day draft with {p?.meals} meals per day.
                  </p>
                  <small>
                    Nothing changes until you approve. Planned meals are
                    separate from food eaten.
                  </small>
                </>
              )}
              <div className="actions">
                <button className="primary" onClick={accept}>
                  {proposal.kind === "log"
                    ? "Confirm & log"
                    : "Review revised draft"}{" "}
                  <Check size={17} />
                </button>
                <button onClick={() => setProposal(null)}>Keep my plan</button>
                {proposal.kind === "log" && (
                  <button
                    onClick={() => {
                      showManual();
                      setFood({
                        name: proposal.foods.map((f) => f.name).join(", "),
                        portion: proposal.foods
                          .map((f) => f.portion)
                          .join(", "),
                        calories: String(
                          proposal.foods.reduce((s, f) => s + f.calories, 0),
                        ),
                        assumptions: proposal.foods
                          .map((f) => f.assumptions)
                          .join("; "),
                      });
                      setProposal(null);
                    }}
                  >
                    Correct preview
                  </button>
                )}
              </div>
            </section>
          )}
          <div className="quick-actions">
            <button onClick={() => showManual()}>
              <Plus size={15} /> Log manually
            </button>
            <button
              disabled={busy}
              onClick={() =>
                ask(
                  "Help me adjust portions to fit what I want today. Ask what food if needed.",
                )
              }
            >
              Adjust portions
            </button>
            <button
              disabled={busy}
              onClick={() =>
                ask("Help me swap a meal. Ask which meal if needed.")
              }
            >
              Swap meal
            </button>
          </div>
          {paused && (
            <p className="notice">
              Suggestions paused today. Logging and requested help still work.{" "}
              <button onClick={() => update({ paused: "" })}>Resume</button>
            </p>
          )}
          {!ai && (
            <p className="notice">
              AI is not configured or reachable. Manual logging works; no
              simulated AI responses.
            </p>
          )}
          {undo && (
            <p className="notice">
              Ledger updated.{" "}
              <button
                onClick={() => {
                  update({ foods: undo });
                  setUndo(null);
                }}
              >
                Undo
              </button>
            </p>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button
                onClick={() => {
                  const last = [...state.chat]
                    .reverse()
                    .find((c) => c.role === "user");
                  if (last) ask(last.text);
                }}
              >
                Retry AI
              </button>
            </div>
          )}
          {input()}
        </>
      )}
      {screen === "menu" && (
        <section className="menu-screen">
          <h1>Your weekly menu</h1>
          <p className="subtitle">A plan you get a say in.</p>
          <div className="menu-summary">
            <span>{p?.meals} meals / day</span>
            <span>{p?.budget.toLocaleString()} kcal budget</span>
          </div>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              ask(
                `Generate a complete seven-day draft menu with ${p?.meals} meals per day, respecting all preferences, dislikes and allergies, around ${p?.budget} kcal/day. Include oil and visible nutrition assumptions.`,
              )
            }
          >
            {busy
              ? "Creating your draft…"
              : state.plan.length || state.draft.length
                ? "Create revised draft"
                : "Create my weekly draft"}{" "}
            <Plus size={18} />
          </button>
          {!state.plan.length && !state.draft.length && (
            <div className="empty card">
              <NotebookText size={34} />
              <h2>Your week starts here.</h2>
              <p>
                Seven days, {p?.meals} meals a day. Made around your
                preferences, not the other way around.
              </p>
              <small>
                AI setup is required to generate a menu. You can still log food
                manually on Home.
              </small>
            </div>
          )}
          {state.plan.length > 0 &&
            state.plan[0].meals.length !== p?.meals &&
            !state.draft.length && (
              <p className="notice">
                Your saved plan still has {state.plan[0].meals.length} meals per
                day. Create and approve a revised {p?.meals}-meal draft to
                replace it. Food history is preserved.
              </p>
            )}
          {state.draft.length > 0 && (
            <div className="notice">
              Draft for review. Your saved plan stays unchanged until approval.{" "}
              <button onClick={() => update({ draft: [] })}>
                Discard draft
              </button>
            </div>
          )}
          {(state.draft.length ? state.draft : state.plan).map((d) => (
            <section className="day-card" key={d.day}>
              <button
                className="day-toggle"
                aria-expanded={openDay === d.day}
                onClick={() => setOpenDay(openDay === d.day ? "" : d.day)}
              >
                <strong>{d.day}</strong>
                <span>
                  {d.meals.reduce((s, m) => s + m.calories, 0)} kcal planned
                </span>
                <ChevronDown
                  className={openDay === d.day ? "rotate" : ""}
                  size={20}
                />
              </button>
              {openDay === d.day && (
                <div className="day-content">
                  {d.meals.map((m, i) =>
                    mealCard(m, d.day, i, !!state.draft.length),
                  )}
                  {!!state.draft.length && (
                    <button
                      className="primary"
                      onClick={() => {
                        if (d.meals.some((m) => conflict(m, p!))) {
                          setError(
                            "This day conflicts with your current exclusions.",
                          );
                          return;
                        }
                        update({
                          draft: state.draft.map((x) =>
                            x.day === d.day
                              ? {
                                  ...x,
                                  meals: x.meals.map((m) => ({
                                    ...m,
                                    approved: true,
                                  })),
                                }
                              : x,
                          ),
                        });
                      }}
                    >
                      Approve {d.day} <Check size={16} />
                    </button>
                  )}
                </div>
              )}
            </section>
          ))}
          {state.draft.length > 0 && (
            <button
              className="primary"
              onClick={() => {
                try {
                  validateResponse(
                    {
                      message: "Approved",
                      kind: "plan",
                      foods: [],
                      days: state.draft,
                    },
                    p!,
                  );
                  update({
                    plan: state.draft.map((d) => ({
                      ...d,
                      meals: d.meals.map((m) => ({ ...m, approved: true })),
                    })),
                    draft: [],
                  });
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Approve & save full week <Check size={18} />
            </button>
          )}
          <small className="menu-foot">
            All nutrition is estimated. Approval saves your plan — it never logs
            intake. Check product labels and preparation for allergens.
          </small>
          {proposal?.kind === "plan" && (
            <div className="card">
              <h2>New draft ready</h2>
              <p>Review all seven days before saving.</p>
              <button className="primary" onClick={accept}>
                Review draft
              </button>
              <button className="text-button" onClick={() => setProposal(null)}>
                Keep my plan
              </button>
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}
      {screen === "profile" && (
        <section className="profile-screen">
          <h1>Your profile</h1>
          <p className="subtitle">Your goals. Your rules.</p>
          <div className="profile-card">
            <span className="avatar">
              {(p?.name || "You").slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{p?.name || "Your profile"}</strong>
              <small>Let’s keep this feeling like you.</small>
            </div>
            <button aria-label="Edit profile" onClick={() => setEditing(true)}>
              <Pencil size={20} />
            </button>
          </div>
          <h3 className="section-label">YOUR BASICS</h3>
          <div className="settings-card">
            {[
              ["Height", `${p?.height} cm`],
              ["Weight", `${p?.weight} kg`],
              ["Activity level", p?.activity],
            ].map(([k, v]) => (
              <button
                key={k}
                className="settings-row"
                onClick={() => setEditing(true)}
              >
                <strong>{k}</strong>
                <span>{v} ›</span>
              </button>
            ))}
          </div>
          <h3 className="section-label">GOALS & FOOD</h3>
          <div className="settings-card">
            {[
              ["Your goal", p?.goal],
              ["Meals per day", `${p?.meals} meals`],
              ["Daily calorie budget", `${p?.budget} kcal`],
              ["Food preferences", p?.preferences || "Add preferences"],
              ["Dislikes", p?.dislikes || "None"],
              ["Allergies", p?.allergies],
            ].map(([k, v]) => (
              <button
                key={k}
                className="settings-row"
                onClick={() => setEditing(true)}
              >
                <strong>{k}</strong>
                <span>{v} ›</span>
              </button>
            ))}
          </div>
          <h3 className="section-label">MAKE IT YOURS</h3>
          <div className="settings-card">
            <div className="settings-row">
              <strong>Language</strong>
              <Languages
                value={p?.language || language}
                onChange={(v) => {
                  setLanguage(v);
                  update({ profile: { ...p!, language: v } });
                }}
              />
            </div>
            <div className="settings-row">
              <div>
                <strong>Cycle-aware suggestions</strong>
                <small>
                  Optional preferences only. No inferred stages or calorie
                  changes.
                </small>
              </div>
              <button
                role="switch"
                aria-label="Cycle-aware suggestions"
                aria-checked={p?.cycle}
                className={`switch ${p?.cycle ? "on" : ""}`}
                onClick={() => update({ profile: { ...p!, cycle: !p?.cycle } })}
              >
                <span />
              </button>
            </div>
            <div className="settings-row">
              <div>
                <strong>Pause suggestions today</strong>
                <small>
                  No unsolicited nudges until tomorrow. Logging stays available.
                </small>
              </div>
              <button
                role="switch"
                aria-label="Pause suggestions today"
                aria-checked={paused}
                className={`switch ${paused ? "on" : ""}`}
                onClick={() => update({ paused: paused ? "" : day })}
              >
                <span />
              </button>
            </div>
          </div>
          <button className="privacy-link" onClick={() => setPrivacy(true)}>
            Local memory & privacy
          </button>
          <button
            className="delete-button"
            onClick={() => setDeleteConfirm(true)}
          >
            Delete my data
          </button>
        </section>
      )}
      <nav className="bottom-nav" aria-label="Main navigation">
        {[
          ["home", "Chat", MessageCircle],
          ["menu", "Menu", NotebookText],
          ["profile", "Profile", UserRound],
        ].map(([key, label, Icon]: any) => (
          <button
            key={key}
            className={screen === key ? "active" : ""}
            onClick={() => {
              setScreen(key);
              setError("");
            }}
          >
            <Icon size={24} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {(manual ||
        ledger ||
        privacy ||
        deleteConfirm ||
        stepEdit ||
        mealEdit) && (
        <div
          className="overlay"
          onClick={() => {
            setManual(false);
            setLedger(false);
            setPrivacy(false);
            setDeleteConfirm(false);
            setStepEdit(false);
            setMealEdit(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              manual
                ? "Confirm food log"
                : ledger
                  ? "Food ledger"
                  : privacy
                    ? "Privacy"
                    : "Edit or confirm"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="Close dialog"
              onClick={() => {
                setManual(false);
                setLedger(false);
                setPrivacy(false);
                setDeleteConfirm(false);
                setStepEdit(false);
                setMealEdit(null);
              }}
            >
              <X size={22} />
            </button>
            {manual && (
              <>
                <h2>{editId ? "Edit food log" : "Log what you ate"}</h2>
                <p>
                  Only confirmed food counts. Enter calories from a label or
                  your own estimate.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveManual();
                  }}
                >
                  <label>
                    Food
                    <input
                      autoFocus
                      required
                      value={food.name}
                      onChange={(e) =>
                        setFood({ ...food, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Portion
                    <input
                      required
                      value={food.portion}
                      onChange={(e) =>
                        setFood({ ...food, portion: e.target.value })
                      }
                      placeholder="2 samosas, 1 roti, 100 g cooked rice…"
                    />
                  </label>
                  <label>
                    Estimated calories
                    <input
                      required
                      type="number"
                      min="0"
                      max="10000"
                      value={food.calories}
                      onChange={(e) =>
                        setFood({ ...food, calories: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Source / assumptions
                    <input
                      value={food.assumptions}
                      onChange={(e) =>
                        setFood({ ...food, assumptions: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Date
                    <input
                      required
                      type="date"
                      value={logDate}
                      onChange={(e) => setLogDate(e.target.value)}
                    />
                  </label>
                  <button className="primary">
                    {editId ? "Save changes" : "Confirm & log"}{" "}
                    <Check size={17} />
                  </button>
                  {error && (
                    <p className="error" role="alert">
                      {error}
                    </p>
                  )}
                </form>
              </>
            )}
            {ledger && (
              <>
                <h2>Your food ledger</h2>
                <label>
                  Ledger date
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                  />
                </label>
                <p>
                  {totals(state.foods, p!.budget, logDate).eaten} kcal eaten ·
                  estimated
                </p>
                {state.foods.filter((f) => f.date === logDate).length === 0 && (
                  <p className="empty">Nothing logged for this day.</p>
                )}
                {state.foods
                  .filter((f) => f.date === logDate)
                  .map((f) => (
                    <div className="ledger-item" key={f.id}>
                      <strong>
                        {f.name}
                        <span>{f.calories} kcal</span>
                      </strong>
                      <p>{f.portion}</p>
                      <small>{f.assumptions}</small>
                      <div className="actions">
                        <button
                          onClick={() => {
                            setLedger(false);
                            showManual(f);
                          }}
                        >
                          <Pencil size={15} /> Edit
                        </button>
                        <button
                          onClick={() => {
                            setUndo(state.foods);
                            update({
                              foods: state.foods.filter((x) => x.id !== f.id),
                            });
                          }}
                        >
                          <Trash2 size={15} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
              </>
            )}
            {privacy && (
              <>
                <h2>A little privacy, too.</h2>
                <p>
                  Your profile, food logs, plans and conversations stay in this
                  browser’s local storage. There is no login or sync. Clearing
                  browser storage removes them.
                </p>
                <p>
                  AI is online: your message, dietary preferences, budget,
                  current plan and the last few messages are sent through our
                  server to the AI provider. Height, weight and your name are
                  omitted from chat context.
                </p>
                <p>
                  Our server does not persist these payloads or log them
                  routinely. Provider processing follows its API terms. Data is
                  not encrypted by this app; avoid shared browsers.
                </p>
                <small>
                  Voice dictation may use your browser provider’s speech
                  service. Microphone access is requested only when you tap it.
                </small>
              </>
            )}
            {deleteConfirm && (
              <>
                <h2>Delete all Nudge data?</h2>
                <p>
                  This clears your local profile, logs, plans and chats. Trace
                  data is kept separately.
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    requestEpoch.current++;
                    lock.current = false;
                    setBusy(false);
                    recognition.current?.abort();
                    localStorage.removeItem(KEY);
                    setState(emptyState());
                    setProposal(null);
                    setUndo(null);
                    setDeleteConfirm(false);
                    setScreen("starter");
                    setError("");
                  }}
                >
                  Delete my data
                </button>
                <button
                  className="text-button"
                  onClick={() => setDeleteConfirm(false)}
                >
                  Keep my data
                </button>
              </>
            )}
            {stepEdit && (
              <>
                <h2>Your steps today</h2>
                <p>
                  Manual entry. No device connection, and no automatic extra
                  food calories.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (Number(stepValue) >= 0 && Number(stepValue) <= 100000) {
                      update({
                        steps: { ...state.steps, [day]: Number(stepValue) },
                      });
                      setStepEdit(false);
                    }
                  }}
                >
                  <label>
                    Steps
                    <input
                      type="number"
                      required
                      min="0"
                      max="100000"
                      value={stepValue}
                      onChange={(e) => setStepValue(e.target.value)}
                    />
                  </label>
                  <button className="primary">Save steps</button>
                </form>
              </>
            )}
            {mealEdit && (
              <>
                <h2>
                  Edit {mealEdit.day} {mealEdit.meal.slot}
                </h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const m = mealEdit.meal;
                    const c = conflict(m, p!);
                    if (c) {
                      setError(c);
                      return;
                    }
                    const source = state.draft.length
                      ? state.draft
                      : state.plan;
                    update({
                      draft: source.map((d) => ({
                        ...d,
                        meals: d.meals.map((v, i) =>
                          d.day === mealEdit.day && i === mealEdit.index
                            ? { ...m, approved: false }
                            : v,
                        ),
                      })),
                    });
                    setMealEdit(null);
                    setError("");
                  }}
                >
                  <label>
                    Meal name
                    <input
                      required
                      value={mealEdit.meal.name}
                      onChange={(e) =>
                        setMealEdit({
                          ...mealEdit,
                          meal: { ...mealEdit.meal, name: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    Portions
                    <input
                      required
                      value={mealEdit.meal.portion}
                      onChange={(e) =>
                        setMealEdit({
                          ...mealEdit,
                          meal: { ...mealEdit.meal, portion: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    Ingredients (comma-separated)
                    <input
                      required
                      value={mealEdit.meal.ingredients.join(", ")}
                      onChange={(e) =>
                        setMealEdit({
                          ...mealEdit,
                          meal: {
                            ...mealEdit.meal,
                            ingredients: e.target.value
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Estimated calories
                    <input
                      required
                      type="number"
                      min="0"
                      max="10000"
                      value={mealEdit.meal.calories}
                      onChange={(e) =>
                        setMealEdit({
                          ...mealEdit,
                          meal: {
                            ...mealEdit.meal,
                            calories: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Nutrition assumptions
                    <input
                      required
                      value={mealEdit.meal.assumptions}
                      onChange={(e) =>
                        setMealEdit({
                          ...mealEdit,
                          meal: {
                            ...mealEdit.meal,
                            assumptions: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                  <small>
                    Edits create a draft. Your approved plan stays unchanged.
                  </small>
                  <button className="primary">Save draft edit</button>
                  {error && <p className="error">{error}</p>}
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
