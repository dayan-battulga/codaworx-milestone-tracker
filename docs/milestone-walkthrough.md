# Milestone tracker walkthrough

These screenshots use **local sample data**. The [live tracker](https://codaworx-gallery-remake-2026.fluffyrice14.chatgpt.site/tracker) starts with an empty project list for each new user.

## 1. See your projects

The dashboard shows your commissions, their status, progress, and in-app notices. Select **Create award plan** to start.

![Project dashboard](screenshots/01-dashboard.png)

## 2. Set the plan as a commissioner

Enter the project and artist's email, then define 3–5 milestones. Each has a name, deliverable, and target date. Payout percentages are optional; if used, they must total 100%.

![Create award plan](screenshots/02-create-plan-top.png)

## 3. Artist reviews the plan

The artist signs in using the email entered on the plan. They can **Accept plan** or **Request changes**. If they request changes, the commissioner can revise and resend it.

![Artist agreement screen](screenshots/04-artist-agreement.png)

## 4. Artist submits progress

After acceptance, the artist enters a progress note and may attach up to five files to a milestone. **Submit for review** changes that milestone to `Submitted`.

![Artist submission screen](screenshots/05-artist-submission.png)

## 5. Commissioner reviews

The commissioner sees the submission and chooses **Approve milestone** or **Request revision**. A revision request returns that milestone to the artist for another submission.

![Commissioner review screen](screenshots/07-commissioner-review.png)

## 6. Track approval and payment status

After approval, the commissioner can record a purchase order, check, or other payment method. This records status; it does not transfer money. When all milestones are approved, the commissioner can publish the completed project to the gallery.

![Approved milestone and payment record](screenshots/08-approved-payment.png)

## Why Sign in with ChatGPT?

This pilot uses the sign-in built into its current Codex Sites hosting. It identifies the commissioner and artist so the server can show each person their projects and protect private files. The public gallery remains viewable without signing in. [OpenAI Sites documentation](https://learn.chatgpt.com/docs/sites/data-and-connections#add-sign-in-with-chatgpt) describes this optional sign-in for identity-aware features.

ChatGPT sign-in is an implementation choice, not a requirement of milestone tracking. Right now, both collaborators need ChatGPT accounts using the email addresses on the project. For a broader public launch, the login could be replaced with a separate email-based or other identity system.

**No invitation email is sent today.** Creating a plan records an in-app notice, so the commissioner must share the tracker URL with the artist. Due-date notices also appear inside the tracker when a participant opens their dashboard.
