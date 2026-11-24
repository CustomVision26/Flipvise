import { z } from "zod";

export const ABOUT_FEATURE_AVAILABILITY = [
  "available",
  "premium",
  "team",
  "addon",
  "coming_soon",
  "hidden",
] as const;

export type AboutFeatureAvailability = (typeof ABOUT_FEATURE_AVAILABILITY)[number];

export const ABOUT_FEATURE_LABELS: Record<AboutFeatureAvailability, string> = {
  available: "Available",
  premium: "Premium Feature",
  team: "Team Feature",
  addon: "Add-on",
  coming_soon: "Coming Soon",
  hidden: "Hidden",
};

const RELEASE_PLATFORMS = ["web", "android", "ios", "all"] as const;

export type AboutLeader = {
  id: string;
  name: string;
  position: string;
  bio: string;
  initials: string;
  linkedInUrl: string;
  contactUrl: string;
  photoUrl: string;
};

export type AboutFeature = {
  id: string;
  title: string;
  description: string;
  availability: AboutFeatureAvailability;
};

export type AboutFaq = {
  id: string;
  question: string;
  answer: string;
};

export type AboutReleaseNote = {
  id: string;
  version: string;
  releasedOn: string;
  platform: (typeof RELEASE_PLATFORMS)[number];
  title: string;
  description: string;
  features: string[];
  improvements: string[];
  fixes: string[];
};

export type AboutContactAction = {
  id: string;
  title: string;
  description: string;
  href: string;
};

export type AboutValue = { id: string; title: string; body: string };
export type AboutAudience = { id: string; title: string; description: string };
export type AboutAiCard = { id: string; title: string; body: string };

export type AboutPageContent = {
  heroEyebrow: string;
  heroHeading: string;
  heroDescription: string;
  heroSlogan: string;
  whoHeading: string;
  whoParagraphs: string[];
  missionTitle: string;
  missionBody: string;
  visionTitle: string;
  visionBody: string;
  commitmentTitle: string;
  commitmentBody: string;
  values: AboutValue[];
  storyHeading: string;
  storyParagraphs: string[];
  leaders: AboutLeader[];
  featuresHeading: string;
  featuresDescription: string;
  features: AboutFeature[];
  audiencesHeading: string;
  audiences: AboutAudience[];
  aiHeading: string;
  aiParagraphs: string[];
  aiCards: AboutAiCard[];
  faqs: AboutFaq[];
  connectHeading: string;
  connectBody: string;
  contactActions: AboutContactAction[];
  ctaHeading: string;
  ctaDescription: string;
  releaseNotes: AboutReleaseNote[];
};

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max);

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isLinkedInUrl(value: string): boolean {
  if (!isHttpsUrl(value)) return false;
  const host = new URL(value).hostname.toLowerCase();
  return host === "linkedin.com" || host.endsWith(".linkedin.com");
}

function isStoredPhotoUrl(value: string): boolean {
  if (!isHttpsUrl(value)) return false;
  const host = new URL(value).hostname.toLowerCase();
  return (
    host.endsWith(".amazonaws.com") ||
    host.endsWith(".cloudfront.net") ||
    host.endsWith(".public.blob.vercel-storage.com")
  );
}

const optionalHttps = optionalText(500).refine(
  (value) => value === "" || isHttpsUrl(value),
  "Use an https link or leave the field empty.",
);

const optionalLinkedIn = optionalText(500).refine(
  (value) => value === "" || isLinkedInUrl(value),
  "LinkedIn links must start with https:// and use linkedin.com.",
);

const optionalPhoto = optionalText(500).refine(
  (value) => value === "" || isStoredPhotoUrl(value),
  "Photographs must be uploaded through the About Us editor.",
);

const internalHref = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine(
    (value) => value.startsWith("/") && !value.startsWith("//") && !value.includes("://"),
    "Contact links must be a path inside Flipvise, such as /contact.",
  );

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "Ids use lowercase letters, numbers, and hyphens.");

const releaseDate = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value),
    "Release dates use YYYY-MM-DD, or stay empty.",
  );

export const aboutPageContentSchema = z.object({
  heroEyebrow: text(80),
  heroHeading: text(160),
  heroDescription: text(800),
  heroSlogan: text(160),
  whoHeading: text(120),
  whoParagraphs: z.array(text(1200)).min(1).max(8),
  missionTitle: text(80),
  missionBody: text(800),
  visionTitle: text(80),
  visionBody: text(800),
  commitmentTitle: text(80),
  commitmentBody: text(800),
  values: z
    .array(z.object({ id: idSchema, title: text(80), body: text(400) }))
    .min(1)
    .max(12),
  storyHeading: text(120),
  storyParagraphs: z.array(text(1200)).min(1).max(8),
  leaders: z
    .array(
      z.object({
        id: idSchema,
        name: text(120),
        position: text(80),
        bio: text(2000),
        initials: z.string().trim().min(1).max(4),
        linkedInUrl: optionalLinkedIn,
        contactUrl: optionalHttps,
        photoUrl: optionalPhoto,
      }),
    )
    .min(1)
    .max(12),
  featuresHeading: text(160),
  featuresDescription: text(800),
  features: z
    .array(
      z.object({
        id: idSchema,
        title: text(80),
        description: text(600),
        availability: z.enum(ABOUT_FEATURE_AVAILABILITY),
      }),
    )
    .min(1)
    .max(24),
  audiencesHeading: text(120),
  audiences: z
    .array(z.object({ id: idSchema, title: text(80), description: text(400) }))
    .min(1)
    .max(12),
  aiHeading: text(160),
  aiParagraphs: z.array(text(1200)).min(1).max(8),
  aiCards: z
    .array(z.object({ id: idSchema, title: text(80), body: text(400) }))
    .min(1)
    .max(12),
  faqs: z
    .array(z.object({ id: idSchema, question: text(240), answer: text(1600) }))
    .min(1)
    .max(40),
  connectHeading: text(120),
  connectBody: text(800),
  contactActions: z
    .array(
      z.object({
        id: idSchema,
        title: text(80),
        description: text(400),
        href: internalHref,
      }),
    )
    .min(1)
    .max(12),
  ctaHeading: text(160),
  ctaDescription: text(800),
  releaseNotes: z
    .array(
      z.object({
        id: idSchema,
        version: text(32),
        releasedOn: releaseDate,
        platform: z.enum(RELEASE_PLATFORMS),
        title: text(160),
        description: optionalText(1200),
        features: z.array(text(300)).max(12),
        improvements: z.array(text(300)).max(12),
        fixes: z.array(text(300)).max(12),
      }),
    )
    .max(30),
});

const DEFAULT_ABOUT_PAGE_CONTENT: AboutPageContent = {
  heroEyebrow: "ABOUT FLIPVISE STUDIO",
  heroHeading: "Empowering Minds. Transforming Learning.",
  heroDescription:
    "Flipvise brings intelligent technology, interactive study tools, educational resources and collaborative learning together in one innovative platform designed to support learners, educators, families and organizations.",
  heroSlogan: "Learn Smarter. Teach Better. Grow Together.",
  whoHeading: "Who We Are",
  whoParagraphs: [
    "Flipvise is an innovative educational technology platform developed by Flipvise Studio LLC to make learning more interactive, organized, accessible and engaging.",
    "Our platform combines artificial intelligence, digital flashcards, interactive assessments, educational resource generation and collaborative learning tools to help individuals and organizations achieve their learning objectives.",
    "Whether preparing for an examination, developing classroom materials, supporting a child's education or organizing professional training, Flipvise provides a flexible environment where knowledge can be created, shared, practiced and assessed.",
    "We believe technology should simplify learning, empower educators and create meaningful opportunities for personal and professional growth.",
  ],
  missionTitle: "Our Mission",
  missionBody:
    "To empower learners, educators, families and organizations through intelligent, accessible and innovative educational technology that supports effective learning, knowledge retention and continuous development.",
  visionTitle: "Our Vision",
  visionBody:
    "To become a trusted educational technology platform that connects people with meaningful learning opportunities and supports the advancement of education through responsible innovation.",
  commitmentTitle: "Our Commitment",
  commitmentBody:
    "To continuously improve the learning experience by developing practical, reliable and user-focused technology that responds to the evolving needs of our educational community.",
  values: [
    {
      id: "innovation",
      title: "Innovation",
      body: "Developing practical solutions that improve how people learn and teach.",
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: "Supporting diverse learning needs and making educational tools easier to access.",
    },
    {
      id: "collaboration",
      title: "Collaboration",
      body: "Encouraging shared knowledge and meaningful learning experiences.",
    },
    {
      id: "integrity",
      title: "Integrity",
      body: "Promoting responsible technology use and academic honesty.",
    },
    {
      id: "continuous-improvement",
      title: "Continuous Improvement",
      body: "Learning from feedback and improving our platform.",
    },
    {
      id: "user-focused",
      title: "User-Focused Development",
      body: "Designing technology around the needs of our users.",
    },
  ],
  storyHeading: "The Story Behind Flipvise",
  storyParagraphs: [
    "Flipvise was created around a simple idea: learning should be more engaging, organized and adaptable to the needs of every individual.",
    "Students often face challenges when organizing study materials and preparing for examinations. Educators spend significant time preparing instructional resources, while parents seek practical ways to support their children's academic development.",
    "Flipvise was developed to address these challenges by bringing intelligent content generation, interactive study experiences, assessment tools and learning management capabilities together within a unified platform.",
    "Our goal is to continue developing solutions that help users spend less time organizing information and more time understanding, applying and retaining knowledge.",
  ],
  leaders: [
    {
      id: "akeme-thomas",
      name: "Akeme Thomas",
      position: "Founder",
      bio: "As Founder of Flipvise, Akeme Thomas represents the company's founding vision and commitment to developing innovative educational technology that supports learning, accessibility and personal development.",
      initials: "AT",
      linkedInUrl: "",
      contactUrl: "",
      photoUrl: "",
    },
    {
      id: "jason-pottinger",
      name: "Jason Pottinger",
      position: "Developer",
      bio: "Jason Pottinger is responsible for the technical development of Flipvise, including application architecture, software development, artificial intelligence integration, feature implementation, troubleshooting and continuous platform improvement. His approach focuses on transforming educational and business requirements into practical, innovative technology solutions.",
      initials: "JP",
      linkedInUrl: "",
      contactUrl: "",
      photoUrl: "",
    },
    {
      id: "jermaine-francis",
      name: "Jermaine Francis",
      position: "Operations Manager",
      bio: "As Operations Manager, Jermaine Francis supports the operational development of Flipvise, helping coordinate business processes, service delivery, organizational activities and initiatives that contribute to the platform's continued growth.",
      initials: "JF",
      linkedInUrl: "",
      contactUrl: "",
      photoUrl: "",
    },
  ],
  featuresHeading: "Technology That Supports Every Learning Journey",
  featuresDescription:
    "Explore the intelligent tools and interactive learning experiences that make Flipvise a versatile platform for education and professional development.",
  features: [
    {
      id: "smart-flashcards",
      title: "Smart Flashcards",
      description:
        "Create, organize and review digital flashcards designed to support knowledge retention, revision and examination preparation.",
      availability: "available",
    },
    {
      id: "ai-content",
      title: "AI Content Generation",
      description:
        "Generate educational content using artificial intelligence, including flashcards, quiz questions and other supported learning resources. Allowances depend on the selected plan.",
      availability: "available",
    },
    {
      id: "standard-review",
      title: "Standard Review",
      description:
        "Review study materials at your own pace through an interactive flashcard experience. Offline availability depends on the supported application platform and downloaded content.",
      availability: "available",
    },
    {
      id: "ai-recall",
      title: "AI Recall",
      description:
        "Strengthen active recall through an AI-assisted study experience that helps learners evaluate their understanding and improve their responses. Availability depends on subscription eligibility and internet connectivity.",
      availability: "premium",
    },
    {
      id: "quizzes",
      title: "Interactive Quizzes",
      description:
        "Test knowledge through multiple-choice, true-or-false, fill-in-the-blank and short-response questions, where supported.",
      availability: "available",
    },
    {
      id: "exam-mode",
      title: "Exam Mode",
      description:
        "Support structured assessments through timed examinations, controlled assessment sessions and performance reporting. Availability depends on the eligible team subscription.",
      availability: "team",
    },
    {
      id: "teacher-studio",
      title: "Teacher Resource Studio",
      description:
        "Help educators create and organize lesson plans, homework assignments, worksheets, study guides and other instructional resources.",
      availability: "team",
    },
    {
      id: "student-progress",
      title: "Student Progress Management",
      description:
        "Support educators in organizing student information, recording assessment results and generating academic progress reports.",
      availability: "team",
    },
    {
      id: "team-workspaces",
      title: "Team Workspaces",
      description:
        "Create collaborative learning environments where authorized administrators can organize members, educational resources, study decks and learning activities.",
      availability: "team",
    },
    {
      id: "live-classroom",
      title: "Flipvise Live Classroom",
      description:
        "Support interactive classroom activities through individual and collaborative learning competitions and other supported classroom experiences. Available as an eligible team add-on.",
      availability: "addon",
    },
    {
      id: "document-studio",
      title: "Document Generation Studio",
      description:
        "Support the creation of structured documents and educational writing resources using AI-assisted tools. Availability depends on the applicable subscription or add-on.",
      availability: "addon",
    },
    {
      id: "cross-platform",
      title: "Cross-Platform Learning",
      description:
        "Access Flipvise through supported web and mobile platforms, with availability and functionality depending on the platform and application release.",
      availability: "available",
    },
  ],
  audiencesHeading: "Built for Different Learning Journeys",
  audiences: [
    {
      id: "students",
      title: "Students",
      description:
        "Prepare for examinations, organize study materials, practice knowledge recall and monitor learning progress.",
    },
    {
      id: "teachers",
      title: "Teachers and Educators",
      description:
        "Create instructional materials, organize classroom resources, manage assessments and support student development.",
    },
    {
      id: "parents",
      title: "Parents and Families",
      description:
        "Support children's educational development through organized study materials and eligible collaborative learning workspaces.",
    },
    {
      id: "institutions",
      title: "Educational Institutions",
      description:
        "Support structured learning, classroom management, educational resource development and collaborative academic activities.",
    },
    {
      id: "organizations",
      title: "Businesses and Organizations",
      description:
        "Develop training materials, support employee learning, assess knowledge and organize professional development resources.",
    },
    {
      id: "independent",
      title: "Independent Learners",
      description:
        "Explore new subjects, develop professional skills and pursue continuous personal development.",
    },
  ],
  aiHeading: "Intelligent Technology. Responsible Learning.",
  aiParagraphs: [
    "Artificial intelligence is an important component of the Flipvise learning experience. Our AI-assisted tools are designed to support educational content creation, knowledge practice, productivity and learning development.",
    "Flipvise encourages users to approach AI-generated information responsibly, verify important information and maintain academic integrity.",
    "AI-generated content may contain inaccuracies or incomplete information and should be reviewed before being used for formal educational, professional or assessment purposes.",
    "Our goal is to support human learning and decision-making rather than replace educators, independent thinking or professional judgment.",
  ],
  aiCards: [
    { id: "human-centered", title: "Human-centered learning", body: "Tools are designed to support people who teach, study, and make decisions." },
    { id: "responsible-ai", title: "Responsible AI use", body: "AI assists content creation and practice. It does not replace review." },
    { id: "academic-integrity", title: "Academic integrity", body: "Learners and educators remain responsible for honest use of generated material." },
    { id: "verification", title: "Content verification", body: "Important information should be checked against trusted educational sources." },
    { id: "privacy", title: "Privacy awareness", body: "Personal information is handled according to the published Privacy Policy." },
    { id: "improvement", title: "Continuous platform improvement", body: "The product changes as the learning community's needs change." },
  ],
  faqs: [
    {
      id: "what-is-flipvise",
      question: "What is Flipvise?",
      answer:
        "Flipvise is an educational technology platform that combines digital flashcards, artificial intelligence, interactive assessments and learning management tools to support students, educators, families and organizations.",
    },
    {
      id: "who-can-use",
      question: "Who can use Flipvise?",
      answer:
        "Flipvise is designed to support students, teachers, parents, independent learners, educational institutions and organizations, subject to the platform's applicable age requirements and Terms of Service.",
    },
    {
      id: "free-plan",
      question: "Is Flipvise free to use?",
      answer:
        "Flipvise offers a free plan alongside paid subscription options. Available features, usage limits and additional capabilities depend on the selected subscription. Visit the Pricing page for current subscription information.",
    },
    {
      id: "how-ai",
      question: "How does Flipvise use artificial intelligence?",
      answer:
        "Flipvise uses AI to support educational content generation, interactive study experiences, learning resource creation and other supported capabilities. Users are encouraged to review AI-generated information for accuracy and relevance.",
    },
    {
      id: "teacher-resources",
      question: "Can teachers generate educational resources?",
      answer:
        "Yes. Eligible educational and team subscriptions provide tools for generating supported resources such as lesson plans, homework assignments, worksheets, study guides and assessments.",
    },
    {
      id: "parents",
      question: "Can parents use Flipvise to support their children?",
      answer:
        "Yes. Parents can use Flipvise to organize educational materials and support learning activities. Eligible team subscriptions also provide workspace and member management capabilities.",
    },
    {
      id: "schools",
      question: "Can schools and organizations use Flipvise?",
      answer:
        "Yes. Eligible team subscriptions provide collaborative workspaces, member administration, educational resources and supported assessment and reporting tools.",
    },
    {
      id: "ai-recall",
      question: "What is AI Recall?",
      answer:
        "AI Recall is an AI-assisted study experience designed to help learners practice active recall and evaluate their understanding of study materials. Access depends on subscription eligibility and requires internet connectivity.",
    },
    {
      id: "live-classroom",
      question: "What is Flipvise Live Classroom?",
      answer:
        "Flipvise Live Classroom is an eligible team add-on designed to support interactive classroom learning through structured activities and individual or collaborative learning competitions.",
    },
    {
      id: "offline",
      question: "Can I use Flipvise offline?",
      answer:
        "Supported native mobile application features may be available offline, including eligible downloaded study materials. AI-powered features, synchronization and other online services require internet connectivity.",
    },
    {
      id: "mobile",
      question: "Is Flipvise available on mobile devices?",
      answer:
        "Flipvise supports web-based access on compatible devices. Native mobile application availability depends on the current release status for each platform.",
    },
    {
      id: "exams",
      question: "Can Flipvise help me prepare for examinations?",
      answer:
        "Yes. Flipvise provides flashcards, quizzes, active recall tools and other supported study capabilities that can assist with examination preparation. Flipvise does not guarantee examination results.",
    },
    {
      id: "ai-accuracy",
      question: "Is AI-generated information always accurate?",
      answer:
        "No. AI-generated information can contain inaccuracies or omissions. Users should verify important information using appropriate educational materials and authoritative sources.",
    },
    {
      id: "privacy",
      question: "How does Flipvise handle personal information?",
      answer:
        "Flipvise handles personal information according to its published Privacy Policy. Users should review the Privacy Policy for information about data collection, usage, retention and applicable privacy rights.",
    },
    {
      id: "contact",
      question: "How can I contact Flipvise?",
      answer:
        "Users can contact Flipvise through the official Contact Us page or available Help Center and customer support channels.",
    },
    {
      id: "version",
      question: "How do I check my current Flipvise version?",
      answer:
        "The current application version is displayed in the Version & Release Information section of the About Us page. Version information may differ between web, Android and iOS platforms.",
    },
  ],
  connectHeading: "Connect With Flipvise",
  connectBody:
    "We value feedback, questions and opportunities to collaborate. Whether you are a learner, educator, parent, institution or organization, we welcome the opportunity to hear from you.",
  contactActions: [
    {
      id: "contact",
      title: "Contact Us",
      description: "Start a conversation with the Flipvise team.",
      href: "/contact",
    },
    {
      id: "support",
      title: "Customer Support",
      description: "Ask for help with your account or the product.",
      href: "/contact?subject=Customer%20support",
    },
    {
      id: "feedback",
      title: "Submit Feedback",
      description: "Share what is working and what should improve.",
      href: "/contact?subject=Feedback",
    },
    {
      id: "problem",
      title: "Report a Problem",
      description: "Tell us about something that is not working.",
      href: "/contact?subject=Report%20a%20problem",
    },
    {
      id: "partnership",
      title: "Partnership Inquiries",
      description: "Talk with us about a partnership.",
      href: "/contact?subject=Partnership%20inquiry",
    },
    {
      id: "institution",
      title: "Educational Institution Inquiries",
      description: "Ask about using Flipvise at a school or institution.",
      href: "/contact?subject=Educational%20institution%20inquiry",
    },
  ],
  ctaHeading: "Your Learning Journey Starts Here",
  ctaDescription:
    "Discover how Flipvise can help you learn smarter, teach more effectively and create meaningful opportunities for continuous growth.",
  releaseNotes: [],
};

export function defaultAboutPageContent(): AboutPageContent {
  return structuredClone(DEFAULT_ABOUT_PAGE_CONTENT);
}

export function parseAboutPageContent(
  input: unknown,
): { ok: true; content: AboutPageContent } | { ok: false; error: string } {
  const parsed = aboutPageContentSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") || "content";
    return { ok: false, error: `${path}: ${issue?.message ?? "Invalid About Us content."}` };
  }
  return { ok: true, content: parsed.data };
}

export function publicAboutFeatures(content: AboutPageContent): AboutFeature[] {
  return content.features.filter((feature) => feature.availability !== "hidden");
}

export function publishedReleaseNotes(content: AboutPageContent): AboutReleaseNote[] {
  return [...content.releaseNotes].sort((a, b) => {
    if (a.releasedOn && b.releasedOn && a.releasedOn !== b.releasedOn) {
      return a.releasedOn < b.releasedOn ? 1 : -1;
    }
    if (a.releasedOn && !b.releasedOn) return -1;
    if (!a.releasedOn && b.releasedOn) return 1;
    return a.version < b.version ? 1 : -1;
  });
}
