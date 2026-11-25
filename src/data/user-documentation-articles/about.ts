import type { DocArticle } from "@/lib/user-documentation-article-types";

export const ABOUT_ARTICLES: DocArticle[] = [
  {
    pageId: "about-us",
    title: "About Us — In-Depth Guide",
    intro:
      "The public About Us page explains Flipvise Studio LLC, the people behind the product, and the current application version.",
    sections: [
      {
        id: "open",
        title: "Opening the page",
        bullets: [
          "Guests and signed-in users can open /about.",
          "Leadership cards include only people a platform administrator has published.",
          "The footer links to About Us on every page.",
          "The guest header includes About. Signed-in users can open it from Help Center.",
        ],
      },
      {
        id: "version",
        title: "Version information",
        paragraphs: [
          "Web, Android, and iOS versions are read separately from the project. A release date is shown only when a published release note includes one.",
          "What's New stays empty until a platform administrator publishes a note.",
        ],
      },
      {
        id: "actions",
        title: "Where the buttons go",
        bullets: [
          "Explore Flipvise opens Documentation.",
          "View Plans and Explore Subscription Plans open Pricing.",
          "Contact actions open Contact Us, with a subject filled in when the card provides one.",
          "Get Started opens the homepage for guests and the dashboard for signed-in users.",
        ],
      },
    ],
  },
];
