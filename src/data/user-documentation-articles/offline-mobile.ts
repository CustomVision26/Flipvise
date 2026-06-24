import type { DocArticle } from "@/lib/user-documentation-article-types";

function a(
  pageId: string,
  title: string,
  intro: string,
  sections: DocArticle["sections"],
): DocArticle {
  return { pageId, title, intro, sections };
}

export const OFFLINE_MOBILE_ARTICLES: DocArticle[] = [
  a(
    "offline-mobile",
    "Offline & Mobile App — In-Depth Guide",
    "Flipvise runs on iPhone and Android and lets you study downloaded decks with no internet connection. Your offline changes sync back to your account when you reconnect.",
    [
      {
        id: "install",
        title: "Installing Flipvise on your phone",
        bullets: [
          "Native app: install the Flipvise app on Android (Google Play) or iOS (App Store).",
          "Or install the website: open Flipvise in your mobile browser and choose “Add to Home Screen” to use it as an app (PWA).",
          "The app shares the same account, decks, and plan as the website — there is nothing extra to set up.",
        ],
      },
      {
        id: "download",
        title: "Make your decks available offline",
        paragraphs: [
          "Before you can study offline, download your content while you still have a connection.",
        ],
        bullets: [
          "Sign in and open your dashboard inside the mobile app.",
          "Tap “Make available offline” (next to Add Deck) to copy your decks and cards onto the device.",
          "Run it again any time to refresh the offline copy with your latest changes.",
        ],
      },
      {
        id: "studying-offline",
        title: "Studying without a connection",
        bullets: [
          "When the device is offline, Flipvise opens an on-device Study view.",
          "Choose a downloaded deck and flip through its cards (question ↔ answer).",
          "Your place, edits, and quiz results are stored locally on the device.",
          "An amber banner shows across the app while you are offline.",
        ],
      },
      {
        id: "sync",
        title: "Syncing across devices",
        paragraphs: [
          "Changes you make offline are queued on the device and reconciled with your account using last-write-wins by time.",
        ],
        bullets: [
          "Tap “Sync”, or simply reopen Flipvise while online, to upload offline changes and download updates from your other devices.",
          "Syncing is authenticated by a secure per-device token created the first time you tap “Make available offline”.",
          "If a sync cannot complete, your changes stay safe on the device and upload on the next successful sync.",
        ],
      },
      {
        id: "limits",
        title: "What does NOT work offline",
        table: {
          headers: ["Feature", "Offline"],
          rows: [
            ["Study downloaded decks", "Yes"],
            ["Create / edit decks & cards", "Yes (syncs later)"],
            ["AI flashcard generation", "No — needs a connection"],
            ["Sign in / sign up", "No"],
            ["Billing & plan changes", "No"],
            ["Team admin & inbox", "No"],
          ],
        },
      },
      {
        id: "tips",
        title: "Tips & cautions",
        bullets: [
          "Download decks before travelling or going somewhere with poor signal.",
          "Sync before signing out on a device so no offline changes are lost.",
          "Deleting the app removes its on-device database — re-download after reinstalling.",
        ],
      },
    ],
  ),
];
