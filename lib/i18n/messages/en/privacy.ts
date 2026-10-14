const privacy = {
  label: "privacy & your data",
  heading: "Your data, your call.",
  intro: "See what Lull holds about you, download all of it, correct it, or erase it. Health data is encrypted, and we never sell it or use it for ads.",
  link: "Privacy & your data",
  loading: "Gathering what we hold…",

  seeHeading: "What we hold",
  seeHint: "Counted live from our database just now.",
  items: { one: "1 item", other: "{n} items" },
  manage: "Manage",
  categories: {
    account: { title: "Account", desc: "Your email, display name and sign-in." },
    plan: { title: "Care Plan", desc: "Your condition focus, medicines, schedule and progress. Encrypted." },
    screeners: { title: "Wellbeing checks", desc: "Your PHQ-9, GAD-7 and sleep answers and scores. Encrypted." },
    safety: { title: "Safety plan", desc: "Your crisis safety plan. Encrypted." },
    companion: { title: "Talk to Lull", desc: "Your conversation with the companion. Encrypted." },
    journal: { title: "Journal", desc: "Your mood and energy check-ins." },
    practice: { title: "Practice", desc: "Breathing, sounds and composed sessions you've done." },
    reports: { title: "Doctor report links", desc: "When links were made and opened. The reports themselves are locked to their links." },
    buddy: { title: "Buddy invites", desc: "Your invite code, buddy links and Pro days earned." },
    community: { title: "Community", desc: "Your anonymous posts, comments, upvotes and reports. Stored without your account id." },
    billing: { title: "Subscription", desc: "Your plan, trial and subscription status." },
    devices: { title: "Reminder devices", desc: "Browsers you've turned reminders on for." },
    usage: { title: "Usage limits", desc: "When you used AI features, to apply daily limits. No content." },
  },

  accountHeading: "Correct your details",
  nameLabel: "Display name",
  emailLabel: "Email",
  since: "Member since {date}",
  save: "Save",
  saving: "Saving…",
  saved: "Saved ✓",
  correctHint: "Everything else can be changed where it lives. Use “Manage” next to each category above.",

  consentHeading: "Consent",
  consentGiven: "You agreed to health-data processing (terms {version}) on {date}.",
  consentNone: "You haven't given consent for health-data processing yet. It's only asked for when you start a Care Plan.",
  consentWithdraw: "You can withdraw it at any time by deleting your Care Plan data, or your whole account below.",

  downloadHeading: "Download everything",
  downloadBody: "One file with all your data, decrypted and readable, including your anonymous Community posts.",
  downloadButton: "Download my data",
  preparing: "Preparing…",

  communityHeading: "Erase my Community activity",
  communityBody: "Removes every post, comment, upvote and report you've made. Threads you started go with them, including other people's replies.",
  communityButton: "Erase Community activity",
  communityDone: "Removed {posts} posts and {comments} comments.",

  deleteHeading: "Delete my account",
  deleteBody: "Permanently deletes your account and everything above: your Care Plan, wellbeing checks, safety plan, conversations, journal, doctor-report links, buddy links and Community activity. This can't be undone.",
  retained: "Kept, because tax law requires it: payment records held by our payments provider (amounts, dates, invoices). They contain no health data, and they're deleted when the legal retention period ends.",
  subscriptionBlocked: "You have an active subscription. Cancel it first so you aren't charged after your account is gone.",
  manageSubscription: "Manage subscription",
  confirmLabel: "Type {word} to confirm",
  deleteButton: "Delete my account forever",
  deleting: "Deleting…",

  grievanceHeading: "Grievance officer",
  grievanceBody: "Questions or complaints about how your data is handled? Write to our grievance officer. We reply within 30 days, as the DPDP Act requires.",
  grievancePending: "Grievance officer contact details are being finalised.",

  deletedHeading: "Your account has been deleted.",
  deletedBody: "Everything has been erased, apart from the payment records the law requires us to keep. Take care of yourself.",

  errors: {
    load: "We couldn't load your data summary. Please try again.",
    export: "We couldn't prepare your download. Please try again.",
    name: "Use 1–60 characters for your name.",
    confirm: "Type DELETE exactly to confirm.",
    erase: "That didn't finish. It's safe to try again: anything already erased stays erased.",
    subscription: "Cancel your subscription first, then delete your account.",
  },
};

export default privacy;
