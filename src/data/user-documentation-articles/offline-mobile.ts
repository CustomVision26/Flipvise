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
          "If you reach the sign-in screen while offline, it is replaced by a short notice and an “Offline study” button — sign-in needs a connection, so this jumps straight to your downloaded decks.",
          "Signing out inside the mobile app drops you back into offline study (your downloaded decks), not the online sign-in page.",
        ],
      },
      {
        id: "appearance",
        title: "Appearance & browsing your decks offline",
        bullets: [
          "The offline study view matches the light/dark mode and interface color you set on the online dashboard — your choice is saved on the device the last time you opened the dashboard in the app.",
          "A faded Flipvise logo watermark sits behind the offline screens.",
          "Long deck libraries and card lists are split into pages, with page controls at the bottom of the list.",
          "Personal decks and their cards show Edit and Delete buttons offline; team decks stay read-only and are managed from the online dashboard.",
        ],
      },
      {
        id: "app-lock",
        title: "Locking the app with your device security",
        paragraphs: [
          "You can require your phone's own security credential — Face ID, Touch ID, fingerprint, or your device PIN/passcode — before the offline app will open your decks.",
        ],
        bullets: [
          "Open Settings (the gear in the offline study top bar) and turn on “Require unlock to open”.",
          "Turning the lock on or off asks for your device credential first, so it can't be changed by someone holding an unlocked phone.",
          "Once enabled, Flipvise asks to unlock when you open it and again after it has been in the background.",
          "Unlock uses biometrics when available and falls back to your device PIN/passcode.",
          "The option only appears when your device has biometrics enrolled or a screen lock set; without one, there is nothing to unlock with.",
          "This lock protects the on-device app and your downloaded decks. Your account itself is still protected by signing in online.",
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
