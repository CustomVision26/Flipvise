import { redirect } from "next/navigation";
import { auth } from "@/lib/clerk-auth";
import {
  loadLiveClassroomBridgeData,
  userCanEnterLiveClassroomBridge,
} from "@/lib/live-classroom-bridge";
import { redirectPathForMissingLiveClassroomAddon } from "@/lib/live-classroom-access";
import { LiveClassroomBridge } from "@/components/live-classroom-bridge";

export default async function LiveClassroomBridgePage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const canEnter = await userCanEnterLiveClassroomBridge(userId);
  if (!canEnter) {
    redirect(await redirectPathForMissingLiveClassroomAddon());
  }

  const data = await loadLiveClassroomBridgeData();
  if (!data) redirect("/");

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-8">
      <LiveClassroomBridge data={data} />
    </div>
  );
}
