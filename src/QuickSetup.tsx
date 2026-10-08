import { useState } from "react";
import type { Profile } from "./model";
export function QuickSetup({
  profile,
  onSave,
  onBack,
  onAdvanced,
}: {
  profile: Profile;
  onSave: (profile: Profile) => void;
  onBack: () => void;
  onAdvanced: () => void;
}) {
  const [diet, setDiet] = useState(profile.diet || "");
  const [allergies, setAllergies] = useState("");
  const [language, setLanguage] = useState(profile.language);
  const [budget, setBudget] = useState("");
  return (
    <section className="form-screen quick-setup">
      <button className="back" onClick={onBack}>
        ← Back
      </button>
      <p className="eyebrow">JUST THE ESSENTIALS</p>
      <h1>Food, your way.</h1>
      <p className="subtitle">A few preferences, then let’s talk food.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            ...profile,
            diet: diet as Profile["diet"],
            allergies: allergies.trim(),
            language,
            budget: budget ? Number(budget) : 0,
            height: 0,
            weight: 0,
            activity: "",
            goal: "",
            proteinTarget: 0,
            fibreTarget: 0,
          });
        }}
      >
        <label>
          Dietary preference
          <select
            aria-label="Dietary preference"
            required
            value={diet}
            onChange={(event) => setDiet(event.target.value)}
          >
            <option value="">Choose what you eat</option>
            <option value="vegetarian">
              Vegetarian — no meat, fish or eggs
            </option>
            <option value="eggetarian">
              Eggetarian — eggs, no meat or fish
            </option>
            <option value="vegan">Vegan — no animal ingredients</option>
            <option value="non-vegetarian">Non-vegetarian</option>
          </select>
        </label>
        <label>
          Allergies
          <input
            required
            pattern={".*\\S.*"}
            title="Enter your allergies or choose No known allergies"
            maxLength={300}
            value={allergies}
            onChange={(event) => setAllergies(event.target.value)}
            placeholder="e.g. peanuts, milk"
          />
        </label>
        <button
          type="button"
          className="secondary"
          onClick={() => setAllergies("None")}
        >
          No known allergies — None
        </button>
        <label>
          Language
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option>English</option>
            <option>Hindi</option>
            <option>Mix</option>
          </select>
        </label>
        <details>
          <summary>Add a calorie target (optional)</summary>
          <p>
            You can log food and chat without one. A target helps with
            budget-based choices and menu planning.
          </p>
          <label>
            Daily calorie budget (kcal)
            <input
              type="number"
              min={800}
              max={6000}
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              placeholder="A target you choose"
            />
          </label>
        </details>
        <p className="setup-note">
          No measurements needed. Add goals and targets later in Profile.
          Ingredients are checked against your exclusions; check packaging and
          preparation for allergens.
        </p>
        <button className="primary" type="submit">
          Start using Nudge
        </button>
      </form>
      <button className="text-button" onClick={onAdvanced}>
        Set up with measurements instead
      </button>
    </section>
  );
}
