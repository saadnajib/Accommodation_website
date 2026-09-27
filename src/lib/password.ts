/** Mirrors the API's password policy (min 10 chars, letters and numbers). Returns an error message or undefined. */
export function passwordProblem(pw: string) {
  if (pw.length < 10) return 'Use at least 10 characters'
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Use both letters and numbers'
  return undefined
}
