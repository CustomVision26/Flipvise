/** Plain JSON clone for Server → Client Component props (dates → ISO strings, drops `undefined`). */
export function toClientJson<T>(value: T): T {
  const json = JSON.stringify(value);
  if (json === undefined) {
    throw new Error("toClientJson: value is not JSON-serializable");
  }
  return JSON.parse(json) as T;
}
