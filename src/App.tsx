import { referenceEstimate } from "./nutrition";
import { dietFor } from "./diet.js";
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
  Bell,
  ArrowLeft,
  Trash2,
  X,
  Pencil,
} from "lucide-react";
import {
  conflict,
  dateKey,
  days,
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
  proteinTarget: 60,
  fibreTarget: 25,
};
const uid = () => crypto.randomUUID();
const internalMenuPrompt = (text: string) =>
  /^Generate a complete seven-day draft menu with [34] meals per day, respecting all preferences, dislikes and allergies, around /i.test(
    text,
  ) ||
  /^Swap (Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Breakfast|Lunch|Snacks|Dinner)\. Return a complete revised seven-day draft,/i.test(
    text,
  );
function read() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && Array.isArray(s.chat))
      s.chat = s.chat.filter(
        (c: { role: string; text: string }) =>
          !(c.role === "user" && internalMenuPrompt(c.text)),
      );
    if (s && Array.isArray(s.chat))
      s.chat = s.chat.map((c: { role: string; text: string }) =>
        c.role === "user"
          ? {
              ...c,
              text: c.text.replace(
                /\. Prepare a food preview or ask for portion clarification\.$/,
                "",
              ),
            }
          : c,
      );
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
          Dietary preference
          <select
            aria-label="Dietary preference"
            value={dietFor(p)}
            onChange={(e) => set("diet", e.target.value)}
            required
          >
            <option value="">Choose your diet</option>
            <option value="vegetarian">
              Vegetarian (no meat, fish or eggs)
            </option>
            <option value="eggetarian">
              Eggetarian (eggs, no meat or fish)
            </option>
            <option value="vegan">Vegan (no animal ingredients)</option>
            <option value="non-vegetarian">Non-vegetarian</option>
          </select>
        </label>
        <label>
          Food preferences
          <input
            value={p.preferences}
            onChange={(e) => set("preferences", e.target.value)}
            placeholder="North Indian, South Indian, quick lunches…"
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
        <div className="two-col">
          <label>
            Daily protein target (g)
            <input
              type="number"
              min="1"
              max="500"
              value={p.proteinTarget ?? 60}
              onChange={(e) =>
                set(
                  "proteinTarget",
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              required
            />
          </label>
          <label>
            Daily fibre target (g)
            <input
              type="number"
              min="1"
              max="100"
              value={p.fibreTarget ?? 25}
              onChange={(e) =>
                set(
                  "fibreTarget",
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              required
            />
          </label>
        </div>
        <small>
          Editable starting targets: 60 g protein and 25 g fibre. Choose targets
          that suit you.
        </small>
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
        <small>
          Editable anytime. Only confirmed food counts toward intake.
        </small>
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
function IntakeRing({
  label,
  title,
  value,
  target,
  unit,
  unknown = 0,
}: {
  label: string;
  title: string;
  value: number;
  target: number;
  unit: string;
  unknown?: number;
}) {
  const progress = Math.min(100, Math.max(0, (value / (target || 1)) * 100));
  return (
    <div className="intake-indicator">
      <div
        className="ring"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-valuetext={`${value} of ${target} ${unit}${unknown ? `; ${unknown} entries missing nutrition` : ""}`}
      >
        <svg className="calorie-ring" viewBox="0 0 145 145" aria-hidden="true">
          <circle className="calorie-track" cx="72.5" cy="72.5" r="67" />
          <circle
            className="calorie-progress"
            cx="72.5"
            cy="72.5"
            r="67"
            pathLength="100"
            strokeDasharray="100"
            strokeDashoffset={100 - progress}
          />
        </svg>
        <div>
          <strong>{Math.round(value * 10) / 10}</strong>
          <span>
            / {target} {unit}
          </span>
        </div>
      </div>
      <strong>{title}</strong>
      <small>
        {unknown
          ? `Known total · ${unknown} ${unknown === 1 ? "entry" : "entries"} missing data`
          : "eaten · estimated"}
      </small>
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
  const [swapping, setSwapping] = useState("");
  const [swapPreview, setSwapPreview] = useState<{
    day: string;
    index: number;
    meal: Meal;
  } | null>(null);
  const [ai, setAi] = useState(false);
  const [manual, setManual] = useState(false);
  const [ledger, setLedger] = useState(false);
  const [logDate, setLogDate] = useState(dateKey());
  const [food, setFood] = useState({
    name: "",
    portion: "",
    calories: "",
    protein: "",
    fibre: "",
    assumptions: "User-entered nutrition estimate",
  });
  const [editId, setEditId] = useState("");
  const [editing, setEditing] = useState(false);
  const [openDay, setOpenDay] = useState("Mon");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [privacy, setPrivacy] = useState(false);
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
  const aiSucceeded = useRef(false);
  const recognition = useRef<any>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const draftStart = useRef<HTMLDivElement>(null);
  const scrollToDraft = useRef(false);
  useEffect(() => {
    if (screen === "menu" && state.draft.length && scrollToDraft.current) {
      scrollToDraft.current = false;
      draftStart.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
      draftStart.current?.focus({ preventScroll: true });
    }
  }, [state.draft, screen]);
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
      .then((d) => {
        if (!aiSucceeded.current) setAi(d.configured === true);
      })
      .catch(() => {
        if (!aiSucceeded.current) setAi(false);
      });
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
    if (!(manual || ledger || privacy || deleteConfirm || mealEdit)) return;
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
  }, [manual, ledger, privacy, deleteConfirm, !!mealEdit]);
  const p = state.profile;
  const t = totals(state.foods, p?.budget || 0, day);
  const paused = state.paused === day;
  const update = (patch: Partial<State>) =>
    setState((s) => ({ ...s, ...patch }));
  const ask = async (
    message: string,
    source: "chat" | "menu" = "chat",
    target?: { day: string; index: number },
    logOptions?: { logDate: string; editId: string },
  ) => {
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
    if (target) {
      setSwapping(`${target.day}-${target.index}`);
      setSwapPreview(null);
    }
    setError("");
    if (source === "chat") {
      setProposal(null);
      setText("");
      setState((s) => ({
        ...s,
        chat: [...s.chat, { id: uid(), role: "user", text: message }],
      }));
    }
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          operation: source,
          context: {
            profile: {
              ...p,
              name: undefined,
              height: undefined,
              weight: undefined,
            },
            today: day,
            weekday: days[(new Date().getDay() + 6) % 7],
            foodLogs: state.foods.filter((f) => f.date === day),
            nutrients: { protein: t.protein, fibre: t.fibre },
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            eaten: t.eaten,
            remaining: t.remaining,
            paused,
            plan:
              source === "chat"
                ? state.plan
                : state.draft.length
                  ? state.draft
                  : state.plan,
            history: state.chat.slice(-12),
            currentPreview: proposal,
            consumedOn: logOptions?.logDate,
          },
        }),
        signal: AbortSignal.timeout(65000),
      });
      const raw = await readApiJson(response);
      if (epoch !== requestEpoch.current) return;
      if (!response.ok) throw Error(raw.error || "AI is unavailable.");
      const result = validateResponse(raw, p);
      if (
        /\b(craving|wish to eat|want to eat|thinking of eating)\b/i.test(
          message,
        ) &&
        !/\b(ate|eaten|had)\b/i.test(message) &&
        result.kind === "log"
      )
        throw Error(
          "A planning request cannot be logged as intake. Please retry.",
        );
      if (source === "chat")
        setState((s) => ({
          ...s,
          chat: [
            ...s.chat,
            { id: uid(), role: "assistant", text: result.message },
          ],
        }));
      if (target) {
        const current = (state.draft.length ? state.draft : state.plan).find(
          (d) => d.day === target.day,
        )?.meals[target.index];
        const replacement = result.days
          .find((d) => d.day === target.day)
          ?.meals.find((m) => m.slot === current?.slot);
        if (result.kind !== "plan" || !replacement || !current)
          throw Error(
            "No usable meal alternative was returned. Your plan is unchanged.",
          );
        if (
          replacement.name === current.name &&
          replacement.portion === current.portion
        )
          throw Error(
            "Gemini returned the same meal. Try Swap again or edit it manually. Your plan is unchanged.",
          );
        setSwapPreview({
          ...target,
          meal: { ...replacement, approved: false },
        });
      } else if (source === "menu" && result.kind === "plan") {
        scrollToDraft.current = true;
        setSwapPreview(null);
        setProposal(null);
        setOpenDay(result.days[0].day);
        update({
          draft: result.days.map((d) => ({
            ...d,
            meals: d.meals.map((m) => ({ ...m, approved: false })),
          })),
        });
        setScreen("menu");
      } else if (result.kind !== "message")
        setProposal({
          kind: result.kind,
          date: day,
          logDate: logOptions?.logDate,
          editId: logOptions?.editId,
          adjustments: result.adjustments,
          basis:
            result.kind === "adjustment"
              ? {
                  intake: JSON.stringify(
                    state.foods.filter((f) => f.date === day),
                  ),
                  meal: JSON.stringify(
                    state.plan
                      .find((d) => d.day === result.adjustments[0]?.day)
                      ?.meals.find(
                        (m) => m.slot === result.adjustments[0]?.meal.slot,
                      ),
                  ),
                }
              : undefined,
          foods: result.foods,
          days: result.days.map((d) => ({
            ...d,
            meals: d.meals.map((m) => ({ ...m, approved: false })),
          })),
        });
      aiSucceeded.current = true;
      setAi(true);
    } catch (e) {
      if (epoch === requestEpoch.current) {
        const failure = e as Error;
        setError(
          ["TimeoutError", "AbortError"].includes(failure.name)
            ? "The AI response took too long. Retry, or log manually; nothing was changed."
            : /failed to fetch|networkerror|load failed/i.test(failure.message)
              ? "Couldn't reach the AI service. Check your connection and retry; your saved food and menu are unchanged."
              : failure.message,
        );
      }
    } finally {
      if (epoch === requestEpoch.current) {
        setBusy(false);
        setSwapping("");
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
        placeholder="Food, cravings, or just a chat…"
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
    setSwapPreview(null);
    setSwapping("");
    setProposal(null);
    setEditing(false);
    setScreen("home");
    if (changed)
      setError(
        "Meal count changed. Your approved plan and food history are preserved. Generate a revised draft to approve.",
      );
  };
  const estimateEntry = () => {
    if (!food.name.trim() || busy) return;
    const description = [food.name.trim(), food.portion.trim()]
      .filter(Boolean)
      .join(" ");
    const standard = referenceEstimate(description);
    setManual(false);
    setError("");
    setScreen("home");
    if (standard) {
      setProposal({
        kind: "log",
        foods: [standard],
        days: [],
        date: day,
        logDate,
        editId,
        sourceLabel: "Standard food reference · estimated",
      });
    } else {
      ask(
        `I ate ${description}. Please estimate calories, protein and fibre with visible portion/preparation assumptions.`,
        "chat",
        undefined,
        { logDate, editId },
      );
    }
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
    if (
      [food.protein, food.fibre].some(
        (v) =>
          v !== "" &&
          (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 1000),
      )
    ) {
      setError(
        "Enter valid protein and fibre grams, or leave them blank if unknown.",
      );
      return;
    }
    setUndo(state.foods);
    const item: Food = {
      id: editId || uid(),
      date: logDate,
      name: food.name.trim(),
      portion: food.portion.trim(),
      calories: Number(food.calories),
      protein: food.protein === "" ? null : Number(food.protein),
      fibre: food.fibre === "" ? null : Number(food.fibre),
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
            protein: f.protein == null ? "" : String(f.protein),
            fibre: f.fibre == null ? "" : String(f.fibre),
            assumptions: f.assumptions,
          }
        : {
            name: state.pending,
            portion: "",
            calories: "",
            protein: "",
            fibre: "",
            assumptions: "User-entered nutrition estimate",
          },
    );
    setManual(true);
  };
  const accept = () => {
    if (!proposal) return;
    if (proposal.date && proposal.date !== day) {
      setProposal(null);
      setError(
        "This preview is from another day. Ask again for today's intake and menu.",
      );
      return;
    }
    if (proposal.kind === "adjustment") {
      try {
        validateResponse({ ...proposal, message: "Meal adjustment" }, p!);
        const a = proposal.adjustments![0];
        const weekday = days[(new Date().getDay() + 6) % 7];
        const current = state.plan
          .find((d) => d.day === weekday)
          ?.meals.find((m) => m.slot === a.meal.slot);
        if (a.day !== weekday || !current)
          throw Error(
            "This adjustment no longer matches today's saved menu. Ask again.",
          );
        if (
          proposal.basis &&
          (proposal.basis.intake !==
            JSON.stringify(state.foods.filter((f) => f.date === day)) ||
            proposal.basis.meal !== JSON.stringify(current))
        )
          throw Error(
            "Your intake or menu changed since this suggestion. Ask again for an updated adjustment.",
          );
        update({
          draft: state.draft.map((d) =>
            d.day !== a.day
              ? d
              : {
                  ...d,
                  meals: d.meals.map((m) =>
                    m.slot === a.meal.slot ? { ...a.meal, approved: false } : m,
                  ),
                },
          ),
          plan: state.plan.map((d) =>
            d.day !== a.day
              ? d
              : {
                  ...d,
                  meals: d.meals.map((m) =>
                    m.slot === a.meal.slot ? { ...a.meal, approved: true } : m,
                  ),
                },
          ),
        });
        setProposal({
          kind: "log",
          fromCraving: true,
          date: day,
          foods: proposal.foods,
          days: [],
        });
        setError("");
      } catch (e) {
        setError((e as Error).message);
      }
      return;
    }
    if (proposal.kind === "log") {
      try {
        validateResponse({ ...proposal, message: "Food preview" }, p!);
      } catch (e) {
        setError((e as Error).message);
        setProposal(null);
        return;
      }
      setUndo(state.foods);
      update({
        foods: [
          ...state.foods.filter(
            (f) => !proposal.editId || f.id !== proposal.editId,
          ),
          ...proposal.foods.map((f) => ({
            ...f,
            id: uid(),
            date: proposal.logDate || day,
          })),
        ],
        pending: "",
      });
    } else {
      setSwapPreview(null);
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
      {swapPreview?.day === d && swapPreview.index === i && (
        <div
          className="card swap-preview"
          role="region"
          aria-label={`Proposed ${m.slot} swap`}
        >
          <span className="eyebrow">PROPOSED SWAP</span>
          <h3>{swapPreview.meal.name}</h3>
          <p>{swapPreview.meal.portion}</p>
          <strong>{swapPreview.meal.calories} kcal estimated</strong>
          <small>{swapPreview.meal.ingredients.join(" · ")}</small>
          <small>{swapPreview.meal.assumptions}</small>
          <small>
            Your current meal stays until you choose. This changes the draft
            only; it does not log intake.
          </small>
          <div className="actions">
            <button
              className="primary"
              onClick={() => {
                const source = state.draft.length ? state.draft : state.plan;
                update({
                  draft: source.map((day) => ({
                    ...day,
                    meals: day.meals.map((meal, index) =>
                      day.day === d && index === i ? swapPreview.meal : meal,
                    ),
                  })),
                });
                setSwapPreview(null);
              }}
            >
              Add swap to draft
            </button>
            <button onClick={() => setSwapPreview(null)}>Keep this meal</button>
          </div>
        </div>
      )}
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
              "menu",
              { day: d, index: i },
            )
          }
        >
          {swapping === `${d}-${i}` ? "Finding a swap…" : "Swap"}
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
            <IntakeRing
              label="Daily calorie intake"
              title="Calories"
              value={t.eaten}
              target={p?.budget || 0}
              unit="kcal"
            />
            <IntakeRing
              label="Daily protein intake"
              title="Protein"
              value={t.protein.value}
              target={p?.proteinTarget || 60}
              unit="g"
              unknown={t.protein.unknown}
            />
            <IntakeRing
              label="Daily fibre intake"
              title="Fibre"
              value={t.fibre.value}
              target={p?.fibreTarget || 25}
              unit="g"
              unknown={t.fibre.unknown}
            />
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
                      /^[iI] (ate|had|have eaten|just ate)\b/.test(
                        state.pending,
                      )
                        ? state.pending
                        : `I ate ${state.pending}`,
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
                Thinking…
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
              {proposal.sourceLabel && <small>{proposal.sourceLabel}</small>}
              <h2>
                {proposal.kind === "log"
                  ? "Count this as eaten?"
                  : proposal.kind === "adjustment"
                    ? "Make room for your craving?"
                    : "Your plan, revised."}
              </h2>
              {proposal.kind === "log" ? (
                proposal.foods.map((f, i) => (
                  <div className="preview-food" key={i}>
                    <strong>
                      {f.name} <span>{f.calories} kcal est.</span>
                    </strong>
                    <p>{f.portion}</p>
                    <small>
                      {f.protein ?? "unknown"} g protein ·{" "}
                      {f.fibre ?? "unknown"} g fibre
                    </small>
                    <small>{f.assumptions}</small>
                  </div>
                ))
              ) : proposal.kind === "adjustment" ? (
                <>
                  <p>
                    Considering:{" "}
                    {proposal.foods
                      .map(
                        (f) =>
                          `${f.portion} ${f.name} (${f.calories} kcal estimated)`,
                      )
                      .join(", ")}
                  </p>
                  {proposal.adjustments?.map((a) => (
                    <div className="preview-food" key={a.meal.slot}>
                      <strong>
                        Today's revised {a.meal.slot.toLowerCase()}:{" "}
                        {a.meal.name}
                      </strong>
                      <p>{a.meal.portion}</p>
                      <small>
                        {a.meal.calories} kcal · {a.meal.protein ?? "unknown"} g
                        protein · {a.meal.fibre ?? "unknown"} g fibre
                      </small>
                      <p>{a.meal.assumptions}</p>
                    </div>
                  ))}
                  <p>
                    {Math.round(
                      t.remaining -
                        proposal.foods.reduce((sum, f) => sum + f.calories, 0),
                    )}{" "}
                    kcal would remain after this craving. The revised meal is
                    planned, not eaten.
                  </p>
                  <small>
                    Approve changes only this meal. The craving counts only when
                    you confirm eating it.
                  </small>
                </>
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
                    ? proposal.fromCraving
                      ? "I ate it — log food"
                      : "Confirm & log"
                    : proposal.kind === "adjustment"
                      ? `Approve ${proposal.adjustments?.[0].meal.slot.toLowerCase() || "meal"} adjustment`
                      : "Review revised draft"}{" "}
                  <Check size={17} />
                </button>
                <button onClick={() => setProposal(null)}>
                  {proposal.kind === "adjustment"
                    ? "Reject adjustment"
                    : proposal.kind === "log"
                      ? "Dismiss preview"
                      : "Keep my plan"}
                </button>
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
                        protein: proposal.foods.some((f) => f.protein == null)
                          ? ""
                          : String(
                              proposal.foods.reduce(
                                (sum, f) => sum + (f.protein || 0),
                                0,
                              ),
                            ),
                        fibre: proposal.foods.some((f) => f.fibre == null)
                          ? ""
                          : String(
                              proposal.foods.reduce(
                                (sum, f) => sum + (f.fibre || 0),
                                0,
                              ),
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
              <Plus size={15} /> Log food
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
                "menu",
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
                {ai
                  ? "Create your draft, then review it before saving."
                  : "AI isn't connected yet. You can still log food manually in Chat."}
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
            <div className="notice" ref={draftStart} tabIndex={-1}>
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
              ["Diet", p ? dietFor(p) || "Choose your diet" : ""],
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
          <button className="settings-row" onClick={() => setEditing(true)}>
            <strong>Protein / fibre targets</strong>
            <span>
              {p?.proteinTarget ?? 60} g / {p?.fibreTarget ?? 25} g ›
            </span>
          </button>
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
      {(manual || ledger || privacy || deleteConfirm || mealEdit) && (
        <div
          className="overlay"
          onClick={() => {
            setManual(false);
            setLedger(false);
            setPrivacy(false);
            setDeleteConfirm(false);
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
                setMealEdit(null);
              }}
            >
              <X size={22} />
            </button>
            {manual && (
              <>
                <h2>{editId ? "Edit food log" : "Log what you ate"}</h2>
                <p>
                  Tell us what you ate, including any amount you know—like “2
                  eggs” or “1 katori dal”. We'll estimate the nutrition for you
                  to review.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (food.calories === "") estimateEntry();
                    else saveManual();
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
                    Portion (optional if included above)
                    <input
                      aria-label="Portion"
                      value={food.portion}
                      onChange={(e) =>
                        setFood({ ...food, portion: e.target.value })
                      }
                      placeholder="2 samosas, 1 roti, 100 g cooked rice…"
                    />
                  </label>
                  <button
                    className="primary"
                    type={food.calories === "" ? "submit" : "button"}
                    disabled={busy || !food.name.trim()}
                    onClick={food.calories === "" ? undefined : estimateEntry}
                  >
                    Estimate & review
                  </button>
                  <details open={!!editId || !!food.calories}>
                    <summary>Enter nutrition myself</summary>
                    <label>
                      Estimated calories
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        value={food.calories}
                        onChange={(e) =>
                          setFood({ ...food, calories: e.target.value })
                        }
                      />
                    </label>
                    <div className="two-col">
                      <label>
                        Protein (g)
                        <input
                          type="number"
                          min="0"
                          max="1000"
                          step="any"
                          value={food.protein}
                          placeholder="Unknown"
                          onChange={(e) =>
                            setFood({ ...food, protein: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Fibre (g)
                        <input
                          type="number"
                          min="0"
                          max="1000"
                          step="any"
                          value={food.fibre}
                          placeholder="Unknown"
                          onChange={(e) =>
                            setFood({ ...food, fibre: e.target.value })
                          }
                        />
                      </label>
                    </div>
                    <small>
                      Leave blank if unknown. Missing values are flagged in
                      today's totals.
                    </small>
                    <label>
                      Source / assumptions
                      <input
                        value={food.assumptions}
                        onChange={(e) =>
                          setFood({ ...food, assumptions: e.target.value })
                        }
                      />
                    </label>
                  </details>
                  <label>
                    Date
                    <input
                      required
                      type="date"
                      value={logDate}
                      onChange={(e) => setLogDate(e.target.value)}
                    />
                  </label>
                  {food.calories !== "" && (
                    <button className="primary">
                      {editId ? "Save changes" : "Confirm & log"}{" "}
                      <Check size={17} />
                    </button>
                  )}
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
                      <small>
                        {f.protein ?? "unknown"} g protein ·{" "}
                        {f.fibre ?? "unknown"} g fibre
                      </small>
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
                  AI is online: your message, dietary preferences, calorie and
                  nutrient targets, today's confirmed food logs, current plan,
                  preview and recent messages are sent through our server to
                  Google Gemini. Height, weight and your name are omitted from
                  chat context.
                </p>
                <p>
                  Our server does not persist these payloads or log them
                  routinely. Google processes it under its API terms. Free-tier
                  content may be used to improve Google products; avoid sharing
                  sensitive details. Data is not encrypted by this app; avoid
                  shared browsers.
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
                    setSwapPreview(null);
                    setSwapping("");
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
