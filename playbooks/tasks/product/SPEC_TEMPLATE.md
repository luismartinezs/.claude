# App Spec: {APP NAME}

## 1. One-Line Summary
<!-- What does this app do, for whom, and what is the core value? -->
<!-- Example: "A web app that lets food bloggers generate SEO-optimised recipe posts from a photo." -->

{ONE SENTENCE}

---

## 2. User Roles
<!-- Who uses this app? List every role. Claude needs to know this to generate correct auth logic and UI branching. -->

| Role  | Description             |
| ----- | ----------------------- |
| Guest | Unauthenticated visitor |
| User  | Authenticated free user |
| Pro   | Paying subscriber       |
| Admin | Internal admin access   |

---

## 3. Core Features
<!-- List features grouped by role. Be explicit — Claude cannot infer what you want. -->
<!-- For each feature: one sentence describing what it does, not how it works. -->

### Guest
- [ ] View landing page
- [ ] Sign up with email or Google

### User
- [ ] {Feature 1}
- [ ] {Feature 2}

### Pro
- [ ] All User features
- [ ] {Feature 1}

### Admin
- [ ] View all users
- [ ] {Feature 1}

---

## 4. Pages & Routes

### Frontend Pages (Astro — static)
| Route      | Page    | Description               |
| ---------- | ------- | ------------------------- |
| `/`        | Landing | Marketing homepage        |
| `/pricing` | Pricing | Plans and CTA             |
| `/login`   | Login   | Google OAuth + magic link |

### Frontend Pages (Vue SPA — client:only)
| Route            | Page      | Auth required |
| ---------------- | --------- | ------------- |
| `/app/dashboard` | Dashboard | User          |
| `/app/settings`  | Settings  | User          |

### Backend API Routes
| Method | Route                | Auth | Description           |
| ------ | -------------------- | ---- | --------------------- |
| POST   | `/api/auth/login`    | None | Initiate Google OAuth |
| GET    | `/api/auth/callback` | None | OAuth callback        |
| GET    | `/api/auth/me`       | User | Get current user      |
| POST   | `/api/auth/logout`   | User | End session           |
| GET    | `/api/{resource}`    | User | {Description}         |
| POST   | `/api/{resource}`    | User | {Description}         |

---

## 5. Data Model
<!-- List every entity and its fields. Claude will generate the Drizzle schema from this. -->
<!-- Be explicit about types, required/optional, and relationships. -->

### users
| Field      | Type               | Notes            |
| ---------- | ------------------ | ---------------- |
| id         | uuid               | PK               |
| email      | text               | unique, required |
| name       | text               | optional         |
| avatar_url | text               | optional         |
| plan       | enum('free','pro') | default 'free'   |
| created_at | timestamp          | auto             |
| updated_at | timestamp          | auto             |

### {table_name}
| Field   | Type   | Notes         |
| ------- | ------ | ------------- |
| id      | uuid   | PK            |
| user_id | uuid   | FK → users.id |
| {field} | {type} | {notes}       |

---

## 6. Auth
<!-- Be explicit about every auth method and session behaviour. -->

- Google OAuth (web)
- Session stored in Redis via express-session
- Session duration: 30 days
- On first login: create user record if not exists
- Role/plan stored on user record, checked server-side on every protected route

---

## 7. Payments
<!-- Only include if applicable. Be explicit about what each plan unlocks. -->

### Plans
| Plan | Price    | Billing |
| ---- | -------- | ------- |
| Free | $0       | —       |
| Pro  | $X/month | Stripe  |

### Plan Limits
| Feature   | Free    | Pro       |
| --------- | ------- | --------- |
| {Feature} | {limit} | Unlimited |

### Payment Flow
1. User clicks upgrade
2. Redirect to Stripe Checkout
3. On success webhook: update user.plan to 'pro'
4. On cancel/failed webhook: revert user.plan

---

## 8. Key Business Logic
<!-- Describe any logic that isn't obvious from the data model. -->
<!-- Claude cannot guess your business rules — be explicit. -->

- {Rule 1}: {description}
- {Rule 2}: {description}

---

## 9. External Services
<!-- List every third-party service and what it's used for. -->

| Service       | Purpose             |
| ------------- | ------------------- |
| Google OAuth  | Authentication      |
| Stripe        | Payments            |
| Resend        | Transactional email |
| Cloudflare R2 | File storage        |
| OpenRouter    | LLM API             |

---

## 10. Email Triggers
<!-- List every email the app sends and when. -->

| Trigger | Recipient | Template             |
| ------- | --------- | -------------------- |
| Sign up | New user  | Welcome email        |
| Upgrade | User      | Upgrade confirmation |
| {Event} | {Role}    | {Description}        |

---

## 11. Environment Variables
<!-- List every env var the app needs. Claude will set these up correctly. -->

```
# App
NODE_ENV=
PORT=3000
APP_URL=

# Database
DATABASE_URL=
REDIS_URL=

# Auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SESSION_SECRET=

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Email
RESEND_API_KEY=

# Storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

---

## 12. Out of Scope (MVP)
<!-- Explicitly list what is NOT in the MVP. -->
<!-- This prevents Claude from adding unrequested complexity. -->

- Mobile app
- {Feature X}
- {Feature Y}
- Admin panel (phase 2)
