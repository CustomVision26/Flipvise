# Loops sample — Account deletion proration receipt

Use this when creating a **Transactional email** in [Loops](https://app.loops.so). After publishing, paste the template ID into `LOOPS_DELETION_PRORATION_RECEIPT_TRANSACTIONAL_ID`.

## Setup in Loops

1. **Transactional emails** → **Create transactional**
2. Name: `Flipvise — deletion proration receipt`
3. **Subject:** `{DATA_VARIABLE:subjectLine}`
4. Paste the body below (HTML or rich text)
5. **Publish** the template (draft templates return 404 from the API)
6. Copy the transactional ID into Render / `.env.local`

## Data variables (all sent by Flipvise)

| Variable | Sent by app | Use in template |
|----------|-------------|-----------------|
| `subjectLine` | Yes | Email subject |
| `statusHeadline` | Yes | Main heading |
| `bodyMessage` | Yes | Full paragraph (or replace with your own copy using the fields below) |
| `userDisplayName` | Yes | Hi, **{name}** |
| `userEmail` | Yes | Account email |
| `planLabel` | Yes | Plan name (Pro, Pro Plus, …) |
| `refundAmount` | Yes | Formatted amount (e.g. `$23.04 USD`) |
| `deletedAt` | Yes | Deletion date (long format) |
| `stripeRefundId` | Yes | Stripe refund ID or `Pending` |
| `homeUrl` | Yes | App homepage link |
| `contactUrl` | Yes | `/contact` support link |

Syntax in Loops: `{DATA_VARIABLE:variableName}` (case-sensitive).

---

## Sample subject

```
{DATA_VARIABLE:subjectLine}
```

*(App sends e.g. `Your Flipvise refund receipt — $23.04 USD`)*

---

## Sample body (HTML)

```html
<p>Hi {DATA_VARIABLE:userDisplayName},</p>

<h2>{DATA_VARIABLE:statusHeadline}</h2>

<p>{DATA_VARIABLE:bodyMessage}</p>

<table cellpadding="8" cellspacing="0" style="border-collapse: collapse; margin: 16px 0;">
  <tr>
    <td style="color: #666;">Account email</td>
    <td><strong>{DATA_VARIABLE:userEmail}</strong></td>
  </tr>
  <tr>
    <td style="color: #666;">Plan</td>
    <td><strong>{DATA_VARIABLE:planLabel}</strong></td>
  </tr>
  <tr>
    <td style="color: #666;">Account deleted</td>
    <td><strong>{DATA_VARIABLE:deletedAt}</strong></td>
  </tr>
  <tr>
    <td style="color: #666;">Refund amount</td>
    <td><strong>{DATA_VARIABLE:refundAmount}</strong></td>
  </tr>
  <tr>
    <td style="color: #666;">Reference</td>
    <td><strong>{DATA_VARIABLE:stripeRefundId}</strong></td>
  </tr>
</table>

<p>Refunds return to your original payment method. Most banks show the credit within <strong>5–10 business days</strong>.</p>

<p>If you have questions about this refund, contact us at <a href="{DATA_VARIABLE:contactUrl}">{DATA_VARIABLE:contactUrl}</a>.</p>

<p>— The Flipvise team<br />
<a href="{DATA_VARIABLE:homeUrl}">{DATA_VARIABLE:homeUrl}</a></p>
```

---

## Sample body (plain text)

```
Hi {DATA_VARIABLE:userDisplayName},

{DATA_VARIABLE:statusHeadline}

{DATA_VARIABLE:bodyMessage}

Details
-------
Account email:  {DATA_VARIABLE:userEmail}
Plan:           {DATA_VARIABLE:planLabel}
Account deleted:{DATA_VARIABLE:deletedAt}
Refund amount:  {DATA_VARIABLE:refundAmount}
Reference:      {DATA_VARIABLE:stripeRefundId}

Refunds return to your original payment method within 5–10 business days.

Questions? {DATA_VARIABLE:contactUrl}

— The Flipvise team
{DATA_VARIABLE:homeUrl}
```

---

## Test send

After publishing, use **Send test** in Loops with sample values, or trigger from **Admin → Subscription monitor → Send receipt** on a ledger row that already has a completed refund.
