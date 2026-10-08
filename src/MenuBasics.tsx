import { useState } from "react";
import type { Profile } from "./model";
export function MenuBasics({
  profile,
  onSave,
  onCancel,
}: {
  profile: Profile;
  onSave: (profile: Profile) => void;
  onCancel?: () => void;
}) {
  const [budget, setBudget] = useState(
    profile.budget ? String(profile.budget) : "",
  );
  const [meals, setMeals] = useState(profile.meals);
  return (
    <form
      className="card menu-basics"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ ...profile, budget: Number(budget), meals });
      }}
    >
      <h2>Make room for your week.</h2>
      <p>
        Choose your meal rhythm and calorie target. You can change these
        anytime.
      </p>
      <label>
        Meals per day
        <select
          aria-label="Meals per day"
          value={meals}
          onChange={(event) => setMeals(Number(event.target.value) as 3 | 4)}
        >
          <option value={3}>3 meals</option>
          <option value={4}>4 meals</option>
        </select>
      </label>
      <label>
        Daily calorie budget (kcal)
        <input
          required
          type="number"
          min={800}
          max={6000}
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
          placeholder="A target you choose"
        />
      </label>
      <button className="primary">Save menu preferences</button>
      {onCancel && (
        <button type="button" className="text-button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}
