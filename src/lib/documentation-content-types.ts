/** Shared quick-reference documentation page shape (user + platform admin guides). */
export type DocPage = {
  id: string;
  title: string;
  route?: string;
  /** Clerk UserButton custom profile tab slug (e.g. appearance, billing). */
  clerkTab?: string;
  purpose: string;
  howItWorks: string[];
  requirements: string[];
  doNots: string[];
};

export type DocSection = {
  id: string;
  title: string;
  description: string;
  pages: DocPage[];
};
