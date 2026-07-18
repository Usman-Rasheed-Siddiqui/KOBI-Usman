export function cn(...values: Array<string | false | null | undefined>) { return values.filter(Boolean).join(" "); }
export function timeAgo(value?: string) {
  if (!value) return "Unknown";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
export function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)); }
