export function assert(
  value: unknown,
  message = `expected a truthy value`,
  errorType: new (message: string) => Error = Error
): asserts value {
  if (!value) {
    throw new errorType(message);
  }
}
