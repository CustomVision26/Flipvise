import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { stripStoredLearnerLatex } = await import("../src/db/queries/cards");
  const result = await stripStoredLearnerLatex();
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
