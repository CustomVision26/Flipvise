import { requireEssayAddonAccess } from "@/lib/essay-access";
import { EssayGeneratorForm } from "@/components/essay-generator-form";

export default async function EssayGeneratePage() {
  await requireEssayAddonAccess("page");
  return <EssayGeneratorForm />;
}
