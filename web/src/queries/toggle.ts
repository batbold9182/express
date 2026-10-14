/**
 * What a user just chose by clicking: the value the *server* reported when they clicked (`from`) and
 * the value they moved it to (`to`). Works for a boolean (liked, following) or a whole list (comments).
 */
export type Choice<T> = { from: T; to: T };

/**
 * The value a control should show, given what the data says now and what the user last chose.
 *
 * Lists come from a cache that refreshes in the background, so a control cannot copy the server's
 * value once into `useState` — a refresh that arrives later would be ignored and the control would
 * keep showing the old state. Instead the user's choice wins only while the data still says what it
 * said when they clicked; as soon as a refresh reports something different, the data wins again.
 *
 * "Different" is `Object.is`: by value for a boolean, by reference for a list. TanStack Query keeps
 * the same reference when a refresh returns identical data (structural sharing), so an unchanged
 * list correctly keeps the user's choice and a changed one does not.
 */
export function resolveChoice<T>(serverValue: T, choice: Choice<T> | null): T {
  return choice !== null && Object.is(choice.from, serverValue) ? choice.to : serverValue;
}
