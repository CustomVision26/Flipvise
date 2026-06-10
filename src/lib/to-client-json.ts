/** Plain JSON clone for Server → Client Component props (dates → ISO strings, drops `undefined`). */
export function toClientJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
