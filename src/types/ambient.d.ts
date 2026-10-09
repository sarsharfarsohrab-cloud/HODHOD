// V8-only API used (behind a feature check) by the vendored ts-fsrs error classes.
interface ErrorConstructor {
  captureStackTrace?(target: object, constructorOpt?: Function): void
}

declare module 'bun:test' {
  type Fn = () => void | Promise<void>
  export function describe(name: string, fn: () => void): void
  export function test(name: string, fn: Fn, timeout?: number): void
  export function beforeEach(fn: Fn): void
  export function afterEach(fn: Fn): void
  export function beforeAll(fn: Fn): void
  export function afterAll(fn: Fn): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function expect(value: unknown): any
}
