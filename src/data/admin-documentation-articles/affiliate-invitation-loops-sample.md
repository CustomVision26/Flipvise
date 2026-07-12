# Loops sample — Affiliate invitation (no Flipvise account)

Use this when creating a **Transactional email** in [Loops](https://app.loops.so). After publishing, paste the template ID into `LOOPS_AFFILIATE_INVITATION_TRANSACTIONAL_ID`.

## When this email sends

| Recipient | Delivery |
|-----------|----------|
| Email has **no** Clerk account | **Loops** transactional email |
| Email matches an existing Flipvise account | **Dashboard inbox only** (no Loops send) |

Active affiliate **plan/end** changes always use **inbox only** — not this template.

## Setup in Loops

1. **Transactional emails** → **Create transactional**
2. Name: `Flipvise — affiliate invitation`
3. **Subject:** `{DATA_VARIABLE:subjectLine}`
4. Paste the body below (LMX)
5. **Publish** the template (draft templates return 404 from the API)
6. Copy the transactional ID into Render / `.env.local`

## Data variables (all sent by Flipvise)

| Variable | Sent by app | Use in template |
|----------|-------------|-----------------|
| `subjectLine` | Yes | Email subject |
| `acceptAffiliateUrl` | Yes | Primary accept button — `/affiliate/accept?token=` |
| `dashboardInboxUrl` | Yes | Secondary button — `/dashboard/inbox` |
| `inviteeEmail` | Yes | Recipient email |
| `affiliateName` | Yes | Display name from invite form |
| `planAssigned` | Yes | Plan slug |
| `planLabel` | Yes | Human-readable plan name |
| `affiliateEndsAt` | Yes | Grant end date (long format) |
| `inviteExpiresInDays` | Yes | Accept-link validity (days) |
| `inviteExpiresAt` | Yes | Accept-link expiry date (long format) |
| `inviterName` | Yes | Admin who sent the invite |

In LMX body: `{data:variableName}` (case-sensitive). Subject: `{DATA_VARIABLE:subjectLine}`.

---

## Sample subject

```
{DATA_VARIABLE:subjectLine}
```

*(App sends e.g. `You're invited as a Flipvise affiliate — Jane Smith`)*

---

## Sample body (LMX)

See the published template in Loops (`LOOPS_AFFILIATE_INVITATION_TRANSACTIONAL_ID`) or re-apply via the Loops API using the keys above.

Key buttons:

- **Accept invitation** → `{data.acceptAffiliateUrl}`
- **Go to dashboard inbox** → `{data.dashboardInboxUrl}`

---

## Test send

After publishing, use **Send test** in Loops with sample values, or invite a test email address that does **not** have a Clerk account from **Admin → Marketing Affiliates → Invite Affiliate**.
