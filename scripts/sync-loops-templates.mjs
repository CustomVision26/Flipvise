/**
 * One-off sync: rename Loops transactional templates and publish polished LMX.
 * Usage: node scripts/sync-loops-templates.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadApiKey() {
  const envPath = resolve(root, ".env.local");
  const text = readFileSync(envPath, "utf8");
  const match = text.match(/^LOOPS_API_KEY=(.+)$/m);
  if (!match) throw new Error("LOOPS_API_KEY not found in .env.local");
  return match[1].trim();
}

const API_KEY = loadApiKey();
const BASE = "https://app.loops.so/api/v1";

const STYLE =
  '<Style backgroundColor="" backgroundXPadding="0" backgroundYPadding="0" bodyColor="" bodyXPadding="0" bodyYPadding="0" bodyFontFamily="Default" bodyFontCategory="sans-serif" borderColor="" borderWidth="0" borderRadius="4" buttonBodyColor="" buttonBodyXPadding="16" buttonBodyYPadding="12" buttonBorderColor="" buttonBorderWidth="0" buttonBorderRadius="4" buttonTextColor="" buttonTextFormat="0" buttonTextFontSize="16" dividerColor="" dividerBorderWidth="1" textBaseColor="" textBaseFontSize="14" textBaseLineHeight="150" textBaseLetterSpacing="0" textLinkColor="" heading1Color="" heading1FontSize="28" heading1LineHeight="125" heading1LetterSpacing="0" heading2Color="" heading2FontSize="24" heading2LineHeight="125" heading2LetterSpacing="0" heading3Color="" heading3FontSize="20" heading3LineHeight="125" heading3LetterSpacing="0" />';

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function renameTransactional(transactionalId, name) {
  await api(`/transactional-emails/${transactionalId}`, {
    method: "POST",
    body: { name },
  });
  console.log(`Renamed ${transactionalId} → ${name}`);
}

async function publishTemplate(transactionalId, content) {
  const tx = await api(`/transactional-emails/${transactionalId}`);
  let messageId = tx.draftEmailMessageId;
  let revisionId = tx.draftEmailMessageContentRevisionId;

  if (!messageId) {
    const draft = await api(`/transactional-emails/${transactionalId}/draft`, {
      method: "POST",
    });
    messageId = draft.draftEmailMessageId;
    revisionId = draft.draftEmailMessageContentRevisionId;
  }

  const msg = await api(`/email-messages/${messageId}`);
  const updated = await api(`/email-messages/${messageId}`, {
    method: "POST",
    body: {
      expectedRevisionId: revisionId ?? msg.contentRevisionId,
      ...content,
    },
  });

  await api(`/transactional-emails/${transactionalId}/publish`, { method: "POST" });
  console.log(`Published ${transactionalId} (message ${updated.id})`);
}

const templates = [
  {
    transactionalId: "cmolr7lfw045p0iy6bnyjmu2y",
    name: "Flipvise Quiz Result",
    content: {
      subject: "{DATA_VARIABLE:subjectLine}",
      previewText: "Your Flipvise quiz performance summary.",
      emailFormat: "styled",
      lmx: `${STYLE}
<Paragraph align="center"><Strong>Quiz results</Strong></Paragraph>
<Paragraph></Paragraph>
<Paragraph>Dear {data.userName},</Paragraph>
<Paragraph></Paragraph>
<Paragraph>Thank you for completing your quiz. Below is a summary of your performance.</Paragraph>
<Paragraph></Paragraph>
<Paragraph><Strong>Deck:</Strong> {data.deckName}<Br /><Strong>Total questions:</Strong> {data.total}<Br /><Strong>Correct:</Strong> {data.correct}<Br /><Strong>Incorrect:</Strong> {data.incorrect}<Br /><Strong>Unanswered:</Strong> {data.unanswered}<Br /><Strong>Score:</Strong> {data.percent}%<Br /><Strong>Time taken:</Strong> {data.elapsedSeconds} seconds</Paragraph>
<Paragraph></Paragraph>
<Paragraph><Em>{data.performanceMessage}</Em></Paragraph>
<Paragraph></Paragraph>
<Button href="{data.viewUrl}" align="center">View results in Flipvise</Button>
<Paragraph></Paragraph>
<Paragraph>If you have any questions, please contact our support team.</Paragraph>
<Paragraph></Paragraph>
<Paragraph>Kind regards,<Br /><Strong>The Flipvise Team</Strong></Paragraph>
<Paragraph align="center">© 2026 Flipvise. All rights reserved.</Paragraph>
<Paragraph></Paragraph>`,
    },
  },
  {
    transactionalId: "cmokrpkhy07bd0i05mnxifucw",
    name: "Flipvise Team Quiz Result — Workspace Owner",
    content: {
      subject: "{DATA_VARIABLE:subjectLine}",
      previewText: "A team member completed a quiz in your workspace.",
      emailFormat: "styled",
      lmx: `${STYLE}
<Paragraph align="center"><Strong>Team quiz results</Strong></Paragraph>
<Paragraph></Paragraph>
<Paragraph>Dear {data.userName},</Paragraph>
<Paragraph></Paragraph>
<Paragraph>A quiz attempt has been completed in workspace <Strong>{data.teamName}</Strong>. Below is a summary of the results.</Paragraph>
<Paragraph></Paragraph>
<Paragraph><Strong>Workspace:</Strong> {data.teamName}<Br /><Strong>Completed by:</Strong> {data.memberName}<Br /><Strong>Deck:</Strong> {data.deckName}<Br /><Strong>Total questions:</Strong> {data.total}<Br /><Strong>Correct:</Strong> {data.correct}<Br /><Strong>Incorrect:</Strong> {data.incorrect}<Br /><Strong>Unanswered:</Strong> {data.unanswered}<Br /><Strong>Score:</Strong> {data.percent}%<Br /><Strong>Time taken:</Strong> {data.elapsedSeconds} seconds</Paragraph>
<Paragraph></Paragraph>
<Paragraph><Em>{data.performanceMessage}</Em></Paragraph>
<Paragraph></Paragraph>
<Button href="{data.viewUrl}" align="center">View results in Flipvise</Button>
<Paragraph></Paragraph>
<Paragraph>If you have any questions, please contact our support team.</Paragraph>
<Paragraph></Paragraph>
<Paragraph>Kind regards,<Br /><Strong>The Flipvise Team</Strong></Paragraph>
<Paragraph align="center">© 2026 Flipvise. All rights reserved.</Paragraph>
<Paragraph></Paragraph>`,
    },
  },
  {
    transactionalId: "cmonp2tq60obp0i03nez7u36s",
    name: "You're Invited to a Flipvise Workspace",
    content: {
      subject: "{DATA_VARIABLE:subjectLine}",
      previewText: "Accept your Flipvise team workspace invitation.",
      emailFormat: "styled",
      lmx: `${STYLE}
<Paragraph align="center"><Strong>Workspace invitation</Strong></Paragraph>
<Paragraph></Paragraph>
<Paragraph>Dear {data.inviteeName} | {data.inviteeEmail},</Paragraph>
<Paragraph></Paragraph>
<Paragraph><Strong>{data.inviterName}</Strong> has invited you to join the workspace <Strong>{data.workspaceName}</Strong>. Your assigned role is <Strong>{data.roleLabel}</Strong>.</Paragraph>
<Paragraph></Paragraph>
<Paragraph>This workspace enables you to collaborate, access shared resources, and participate in team activities.</Paragraph>
<Paragraph></Paragraph>
<Button href="{data.acceptInvitationUrl}" align="center">Accept invitation</Button>
<Paragraph></Paragraph>
<Paragraph>If the button above does not work, copy and paste the following link into your browser:</Paragraph>
<Paragraph>{data.acceptInvitationUrl}</Paragraph>
<Paragraph></Paragraph>
<Paragraph>If you do not yet have a Flipvise account, select <Strong>Accept invitation</Strong> and sign up using this email address.</Paragraph>
<Paragraph></Paragraph>
<Paragraph>This invitation expires in {data.expiresInDays} days if it is not accepted.</Paragraph>
<Paragraph></Paragraph>
<Paragraph>If you were not expecting this invitation, you may safely ignore this email.</Paragraph>
<Paragraph></Paragraph>
<Paragraph>Kind regards,<Br /><Strong>The Flipvise Team</Strong></Paragraph>
<Paragraph align="center">© 2026 Flipvise. All rights reserved.</Paragraph>
<Paragraph></Paragraph>`,
    },
  },
  {
    transactionalId: "cmonwffo400830i1d0bzsxcr2",
    name: "You're Invited as a Flipvise Affiliate",
    content: {
      subject: "{DATA_VARIABLE:subjectLine}",
      previewText: "Accept your Flipvise affiliate program invitation.",
      emailFormat: "styled",
      lmx: `${STYLE}
<Paragraph align="center"><Strong>Affiliate invitation</Strong></Paragraph>
<Paragraph></Paragraph>
<Paragraph>Dear {data.affiliateName} | {data.inviteeEmail},</Paragraph>
<Paragraph></Paragraph>
<Paragraph><Strong>{data.inviterName}</Strong> has invited you to join the Flipvise <Strong>Affiliate Program</Strong>.</Paragraph>
<Paragraph>As an affiliate, you will receive access to our <Strong>{data.planLabel}</Strong> ({data.planAssigned}) tools, resources, and collaboration opportunities within the platform.</Paragraph>
<Paragraph></Paragraph>
<Paragraph><Strong>Important information:</Strong><Br /><Br />• If you currently maintain an active paid subscription, accepting this invitation will transition your account to the affiliate plan.<Br /><Br />• Any unused portion of your existing subscription will be <Strong>prorated and refunded</Strong> to your original payment method.<Br /><Br />• Upon acceptance, your account will receive a <Strong>complimentary affiliate plan</Strong> through {data.affiliateEndsAt}, unless extended by the Flipvise management team.<Br /><Br />• If you choose not to accept, your current subscription and billing will remain <Strong>unchanged</Strong>.</Paragraph>
<Paragraph></Paragraph>
<Paragraph>Please review the details below and accept the invitation if you wish to proceed.</Paragraph>
<Button href="{data.acceptAffiliateUrl}" align="center">Accept invitation</Button>
<Paragraph></Paragraph>
<Paragraph>If you do not yet have a Flipvise account, select <Strong>Accept invitation</Strong> and sign up using this email address.</Paragraph>
<Paragraph></Paragraph>
<Paragraph>If you do not wish to join, you may ignore this email. This invitation expires in {data.inviteExpiresInDays} days ({data.inviteExpiresAt}).</Paragraph>
<Paragraph></Paragraph>
<Paragraph>If you have any questions, please contact our support team.</Paragraph>
<Paragraph></Paragraph>
<Paragraph>Kind regards,<Br /><Strong>The Flipvise Team</Strong></Paragraph>
<Paragraph align="center">© 2026 Flipvise. All rights reserved.</Paragraph>
<Paragraph></Paragraph>`,
    },
  },
  {
    transactionalId: "cmrhwzvyt33xm0j123lgsfbf5",
    name: "Your Flipvise Refund Receipt",
    content: {
      subject: "{DATA_VARIABLE:subjectLine}",
      previewText: "Your Flipvise prorated refund receipt.",
      emailFormat: "styled",
      lmx: `${STYLE}
<Paragraph>Hi {data.userDisplayName},</Paragraph>
<Paragraph></Paragraph>
<Paragraph><Strong>{data.statusHeadline}</Strong></Paragraph>
<Paragraph></Paragraph>
<Paragraph>{data.bodyMessage}</Paragraph>
<Paragraph></Paragraph>
<Paragraph><Strong>Account email:</Strong> {data.userEmail}<Br /><Strong>Plan:</Strong> {data.planLabel}<Br /><Strong>Account deleted:</Strong> {data.deletedAt}<Br /><Strong>Refund amount:</Strong> {data.refundAmount}<Br /><Strong>Reference:</Strong> {data.stripeRefundId}</Paragraph>
<Paragraph></Paragraph>
<Paragraph>Refunds are returned to your original payment method. Most financial institutions post credits within <Strong>5–10 business days</Strong>.</Paragraph>
<Paragraph></Paragraph>
<Paragraph>If you have questions regarding this refund, please contact us at <Link href="{data.contactUrl}">{data.contactUrl}</Link>.</Paragraph>
<Paragraph></Paragraph>
<Paragraph>— The Flipvise Team<Br /><Link href="{data.homeUrl}">{data.homeUrl}</Link></Paragraph>`,
    },
  },
  {
    transactionalId: "cmp7y0k50052k0jxi4ypl8oa1",
    name: "Your Flipvise Account Has Been Suspended",
    content: {
      subject: "{DATA_VARIABLE:subjectLine}",
      previewText: "Important notice regarding your Flipvise account access.",
      emailFormat: "styled",
      lmx: `${STYLE}
<Paragraph align="center"><Strong>{data.statusHeadLine}</Strong></Paragraph>
<Paragraph></Paragraph>
<Paragraph>Dear {data.userName},</Paragraph>
<Paragraph></Paragraph>
<Paragraph>{data.statusMessage}</Paragraph>
<Paragraph></Paragraph>
<Paragraph><Strong>Account email:</Strong> {data.userEmail}<Br /><Strong>Status:</Strong> {data.accountState}<Br /><Strong>Effective date:</Strong> {data.actionAt}</Paragraph>
<Paragraph></Paragraph>
<Paragraph>If you believe this action was made in error, please contact our support team for further review.</Paragraph>
<Paragraph></Paragraph>
<Paragraph>Kind regards,<Br /><Strong>The Flipvise Team</Strong></Paragraph>
<Paragraph align="center"><Link href="{data.homeUrl}">{data.homeUrl}</Link></Paragraph>
<Paragraph></Paragraph>`,
    },
  },
  {
    transactionalId: "cmp7xofxx04n40j23l04zvc3n",
    name: "Your Flipvise Account Has Been Restored",
    content: {
      subject: "{DATA_VARIABLE:subjectLine}",
      previewText: "Your Flipvise account access has been restored.",
      emailFormat: "styled",
      lmx: `${STYLE}
<Paragraph align="center"><Strong>{data.statusHeadline}</Strong></Paragraph>
<Paragraph></Paragraph>
<Paragraph>Dear {data.userName},</Paragraph>
<Paragraph></Paragraph>
<Paragraph>{data.statusMessage}</Paragraph>
<Paragraph></Paragraph>
<Paragraph><Strong>Account email:</Strong> {data.userEmail}<Br /><Strong>Status:</Strong> {data.accountState}<Br /><Strong>Restored on:</Strong> {data.actionAt}</Paragraph>
<Paragraph></Paragraph>
<Button href="{data.signInUrl}" align="center">Sign in to Flipvise</Button>
<Paragraph></Paragraph>
<Paragraph>If you experience any difficulty signing in, please contact our support team.</Paragraph>
<Paragraph></Paragraph>
<Paragraph>Kind regards,<Br /><Strong>The Flipvise Team</Strong></Paragraph>
<Paragraph align="center"><Link href="{data.homeUrl}">{data.homeUrl}</Link></Paragraph>
<Paragraph></Paragraph>`,
    },
  },
  {
    transactionalId: "cmoogowcs01nj0izyjd7yqoyf",
    name: "Confirm Your Flipvise Affiliate Plan Update",
    content: {
      subject: "{DATA_VARIABLE:subjectLine}",
      previewText: "Confirm your updated Flipvise affiliate plan arrangement.",
      emailFormat: "styled",
      lmx: `${STYLE}
<Paragraph align="center"><Strong>Affiliate plan update</Strong></Paragraph>
<Paragraph></Paragraph>
<Paragraph>Dear {data.affiliateName} | {data.inviteeEmail},</Paragraph>
<Paragraph></Paragraph>
<Paragraph><Strong>{data.inviterName}</Strong> from the Flipvise management team has updated your affiliate arrangement. Your approved plan is <Strong>{data.planLabel}</Strong> ({data.planAssigned}).</Paragraph>
<Paragraph>Please confirm this change so your account can be updated.</Paragraph>
<Button href="{data.confirmArrangementChangeUrl}" align="center">Confirm arrangement change</Button>
<Paragraph></Paragraph>
<Paragraph>Upon acceptance, your complimentary affiliate plan will extend to <Strong>{data.affiliateEndsAt}</Strong> (previously ending <Strong>{data.previousAffiliateEndsAt}</Strong>).</Paragraph>
<Paragraph></Paragraph>
<Paragraph><Strong>Current plan:</Strong> {data.currentPlanLabel}<Br /><Strong>Current plan end date:</Strong> {data.currentEndsAtFormatted}</Paragraph>
<Paragraph></Paragraph>
<Button href="{data.dashboardInboxUrl}" align="center">Go to dashboard inbox</Button>
<Paragraph></Paragraph>
<Paragraph><Strong>Billing update:</Strong><Br /><Br />• If you previously maintained an active paid subscription, it has been adjusted accordingly.<Br /><Br />• Any unused portion of your prior subscription has been <Strong>prorated and refunded</Strong> to your original payment method.<Br /><Br />• After confirmation, your account will reflect the <Strong>complimentary affiliate plan</Strong>.</Paragraph>
<Paragraph></Paragraph>
<Paragraph>If you have any questions regarding your plan or billing, please contact our support team.</Paragraph>
<Paragraph></Paragraph>
<Paragraph>If you do not wish to accept this change, you may ignore this email. This confirmation link expires on {data.confirmationExpiresAt}.</Paragraph>
<Paragraph></Paragraph>
<Paragraph>Kind regards,<Br /><Strong>The Flipvise Team</Strong></Paragraph>
<Paragraph align="center">© 2026 Flipvise. All rights reserved.</Paragraph>
<Paragraph></Paragraph>`,
    },
  },
];

for (const t of templates) {
  await renameTransactional(t.transactionalId, t.name);
  await publishTemplate(t.transactionalId, t.content);
}

console.log("All Loops templates synced.");
