const PAKISTAN_TIME_ZONE = "Asia/Karachi";

export function isBirthdayReminder(dateOfBirth?: string, now = new Date()) {
  if (!dateOfBirth) return false;
  const month = Number(dateOfBirth.slice(5, 7));
  const day = Number(dateOfBirth.slice(8, 10));
  if (!month || !day) return false;

  const todayParts = new Intl.DateTimeFormat("en-CA", { timeZone: PAKISTAN_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).reduce<Record<string, string>>((parts, part) => {
    if (part.type !== "literal") parts[part.type] = part.value;
    return parts;
  }, {});
  const today = Date.UTC(Number(todayParts.year), Number(todayParts.month) - 1, Number(todayParts.day));
  let birthday = Date.UTC(Number(todayParts.year), month - 1, day);
  if (birthday < today) birthday = Date.UTC(Number(todayParts.year) + 1, month - 1, day);

  return (birthday - today) / 86400000 <= 7;
}
