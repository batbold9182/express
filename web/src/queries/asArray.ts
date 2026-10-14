/**
 * The API's lists are arrays. If one ever isn't — a null, or an error object that came back with a
 * 200 — treat it as an empty list rather than letting `.map` throw during render and take the page
 * down. Applied in the query functions, so no component has to defend itself.
 */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
