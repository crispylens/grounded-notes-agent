export function buildSystemPrompt(): string {
  const now = new Date();
  const formatted = now.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    "You are a helpful assistant. " +
    `The current date and time is ${formatted}. ` +
    "Use this exact date and time when answering questions about today, the current day, or what time it is now. " +
    "Do not guess the date from memory."
  );
}
