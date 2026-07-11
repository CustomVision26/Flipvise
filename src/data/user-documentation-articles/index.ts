import type { DocArticle } from "@/lib/user-documentation-article-types";
import { GETTING_STARTED_ARTICLES } from "@/data/user-documentation-articles/getting-started";
import { DASHBOARD_ARTICLES } from "@/data/user-documentation-articles/dashboard";
import { DECKS_STUDY_ARTICLES } from "@/data/user-documentation-articles/decks-study";
import { INBOX_ARTICLES } from "@/data/user-documentation-articles/inbox";
import { HELP_CENTER_ARTICLES } from "@/data/user-documentation-articles/help-center";
import { CONTACT_US_ARTICLES } from "@/data/user-documentation-articles/contact-us";
import { PRICING_BILLING_ARTICLES } from "@/data/user-documentation-articles/pricing-billing";
import { ACCOUNT_CLERK_ARTICLES } from "@/data/user-documentation-articles/account-clerk";
import { TEAM_ADMIN_ARTICLES } from "@/data/user-documentation-articles/team-admin";
import { INVITES_ONBOARDING_ARTICLES } from "@/data/user-documentation-articles/invites-onboarding";
import { AFFILIATE_PORTAL_ARTICLES } from "@/data/user-documentation-articles/affiliate-portal";
import { OFFLINE_MOBILE_ARTICLES } from "@/data/user-documentation-articles/offline-mobile";
import { TEACHER_TOOLS_ARTICLES } from "@/data/user-documentation-articles/teacher-tools";

const ALL_ARTICLES: DocArticle[] = [
  ...GETTING_STARTED_ARTICLES,
  ...DASHBOARD_ARTICLES,
  ...DECKS_STUDY_ARTICLES,
  ...INBOX_ARTICLES,
  ...HELP_CENTER_ARTICLES,
  ...CONTACT_US_ARTICLES,
  ...PRICING_BILLING_ARTICLES,
  ...ACCOUNT_CLERK_ARTICLES,
  ...TEAM_ADMIN_ARTICLES,
  ...INVITES_ONBOARDING_ARTICLES,
  ...AFFILIATE_PORTAL_ARTICLES,
  ...OFFLINE_MOBILE_ARTICLES,
  ...TEACHER_TOOLS_ARTICLES,
];

export const USER_DOCUMENTATION_ARTICLES_BY_PAGE_ID: Readonly<Record<string, DocArticle>> =
  Object.fromEntries(ALL_ARTICLES.map((article) => [article.pageId, article]));

export function getUserDocumentationArticle(pageId: string): DocArticle | null {
  return USER_DOCUMENTATION_ARTICLES_BY_PAGE_ID[pageId] ?? null;
}

export function hasUserDocumentationArticle(pageId: string): boolean {
  return pageId in USER_DOCUMENTATION_ARTICLES_BY_PAGE_ID;
}

export const USER_DOCUMENTATION_ARTICLE_COUNT = ALL_ARTICLES.length;
