export function explicitlyCompletedMeals(message, count) {
  return /^(?:i\s+(?:have\s+)?(?:already\s+)?(?:had|eaten|finished)\s+all\s+(?:(?:3|three|4|four)\s+)?(?:my\s+)?meals\b|all\s+(?:my\s+)?(?:3\s+|three\s+|4\s+|four\s+)?meals\s+(?:are\s+)?(?:done|finished)\b)/i.test(
    message.trim(),
  )
    ? count === 4
      ? ["Breakfast", "Lunch", "Snacks", "Dinner"]
      : ["Breakfast", "Lunch", "Dinner"]
    : [];
}
