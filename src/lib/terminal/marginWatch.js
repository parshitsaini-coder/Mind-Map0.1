// Pure: when does the margin warning fire? Once on the way from a healthy / unknown state into warn or danger.
// Going from warn to danger does not fire again (the stop-out event covers that); recovering re-arms it.
export function marginTransition(prev, next) {
  const bad = (s) => s === 'warn' || s === 'danger'
  return { state: next, fire: bad(next) && !bad(prev) }
}
