# Loops sample — Team workspace invitation (no Flipvise account)

Use this when creating a **Transactional email** in [Loops](https://app.loops.so). After publishing, paste the template ID into `LOOPS_TEAM_INVITATION_TRANSACTIONAL_ID`.

## When this email sends

| Recipient | Delivery |
|-----------|----------|
| Email has **no** Clerk account | **Loops** transactional email |
| Email matches an existing Flipvise account | **Dashboard inbox** (+ optional native push) — **no Loops send** |

## Setup in Loops

1. **Transactional emails** → **Create transactional**
2. Name: `Flipvise — team workspace invitation`
3. **Subject:** `{DATA_VARIABLE:subjectLine}`
4. Paste the body below (LMX)
5. **Publish** the template (draft templates return 404 from the API)
6. Copy the transactional ID into Render / `.env.local`

## Data variables (all sent by Flipvise)

| Variable | Sent by app | Use in template |
|----------|-------------|-----------------|
| `subjectLine` | Yes | Email subject |
| `acceptInvitationUrl` | Yes | Primary accept button — `/invite/team/{token}` |
| `dashboardInboxUrl` | Yes | Sent by app but not needed in body for no-account recipients |
| `inviteeEmail` | Yes | Recipient email |
| `inviteeName` | Yes | Invitee name from the form (required; email local-part used as fallback if somehow empty) |
| `workspaceName` | Yes | Team workspace name |
| `roleLabel` | Yes | `Member` or `Team admin` |
| `inviterName` | Yes | Person who sent the invite |
| `expiresInDays` | Yes | Accept-link validity (days) |

In LMX body: `{data:variableName}` (case-sensitive). Subject: `{DATA_VARIABLE:subjectLine}`.

---

## Sample subject

```
{DATA_VARIABLE:subjectLine}
```

*(App sends e.g. `You're invited to Acme Team`)*

---

## Test send

After publishing, use **Send test** in Loops with sample values, or send a team invite from **Team Admin → Invite Members** to an email that does **not** have a Clerk account.

Registered users should **not** receive this Loops email — confirm they only see the invite in **Dashboard → Inbox**.
