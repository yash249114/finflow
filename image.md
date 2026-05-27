# FinFlow SaaS — End-to-End System Design Architecture

This document describes the complete architecture and data flow of FinFlow.

---

## 1. System Architecture

```mermaid
graph TD
    User([Browser/Client]) -->|Next.js App Router| Frontend[Next.js Client]
    Frontend -->|Middleware Auth Guard| Middleware[Next.js Middleware]
    Middleware -->|Verify Token| SupabaseAuth[Supabase Auth Service]
    Frontend -->|POST Verify Token| VerifyCaptcha[verify-captcha Route Handler]
    VerifyCaptcha -->|POST siteverify| GoogleCaptcha[Google reCAPTCHA API]
    
    Frontend -->|Authorization Bearer JWT| GoAPI[Go Backend API]
    GoAPI -->|Verify Session| SupabaseAuth
    GoAPI -->|CSV Upload / Forecast| MLService[ML python Service]
    GoAPI -->|Read/Write| Postgres[(PostgreSQL DB)]
    MLService -->|Read Transactions| Postgres
    
    SupabaseAuth -->|Trigger AFTER INSERT| SyncTrigger[Postgres trigger Function]
    SyncTrigger -->|Sync profiles| Postgres
```

---

## 2. Authentication Flow journeys

### A. User Registration Journey

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Page as Register Page
    participant Google as Google reCAPTCHA
    participant API as verify-captcha Route
    participant SBA as Supabase Auth
    participant DB as Postgres Database

    User->>Page: Fill email, password, full_name
    Page->>Page: Verify strength & match (Client-side)
    Note over Page: Both filled: reveal reCAPTCHA checkbox
    User->>Page: Check reCAPTCHA Checkbox
    Google->>Page: Return checkbox token
    User->>Page: Submit form
    Page->>API: POST /api/verify-captcha { token }
    API->>Google: POST /siteverify { secret, token }
    Google-->>API: Return { success: true }
    API-->>Page: Return success
    Page->>SBA: signUp({ email, password, metadata })
    SBA->>DB: Insert auth.users row
    Note over DB: Postgres Triggerhandle_new_user() fires
    DB->>DB: Insert public.users profile row
    SBA-->>User: Dispatch Verification Email
    Page-->>User: Show Check Inbox confirmation message
```

### B. User Login Journey

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Page as Login Page
    participant Google as Google reCAPTCHA
    participant API as verify-captcha Route
    participant SBA as Supabase Auth
    participant MW as Middleware Guard

    User->>Page: Input credentials
    Note over Page: Both filled: reveal reCAPTCHA checkbox
    User->>Page: Check reCAPTCHA Checkbox
    Google->>Page: Return checkbox token
    User->>Page: Submit form
    Page->>API: POST /api/verify-captcha { token }
    API->>Google: POST /siteverify { secret, token }
    Google-->>API: Return { success: true }
    API-->>Page: Return success
    Page->>SBA: signInWithPassword({ email, password })
    alt Email is unconfirmed
        SBA-->>Page: Return error "Email not confirmed"
        Page-->>User: Display inbox check warning message
    else Email is confirmed
        SBA-->>Page: Return session cookies
        Page->>MW: Request /dashboard
        MW->>SBA: getUser()
        SBA-->>MW: Return verified user
        MW-->>Page: Allow navigation
        Page-->>User: Render Dashboard
    end
```

### C. Google OAuth Flow Journey

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Page as Login / Register Page
    participant SBA as Supabase Auth
    participant Google as Google Account Consent
    participant Handler as /auth/callback Route
    participant DB as Postgres Database

    User->>Page: Click "Continue with Google"
    Page->>SBA: signInWithOAuth({ provider: "google" })
    SBA-->>Page: Redirect to Google OAuth screen
    Page->>Google: Redirect user
    User->>Google: Grant permissions
    Google->>SBA: Callback with auth code
    SBA->>Handler: Redirect to /auth/callback?code=xxxx
    Handler->>SBA: exchangeCodeForSession(code)
    SBA->>DB: Insert auth.users row (if first time)
    Note over DB: Postgres Triggerhandle_new_user() fires
    DB->>DB: Insert/Sync public.users profile row
    SBA-->>Handler: Return Session Cookies
    Handler-->>Page: Redirect to /dashboard
    Page-->>User: Render Dashboard
```

---

## 3. Core Components

1. **Next.js Frontend Client**: Written in TypeScript using React, Framer Motion for premium aesthetics, and Tailwind CSS.
2. **Next.js Middleware**: Handles route guards. Checks authorization headers and cookies. Redirects unauthenticated or unconfirmed users to the login screen.
3. **Go Backend API**: Core service exposing endpoints for ledger data, anomaly detection, Holt-Winters forecasting, and Lemon Squeezy billing. Uses Supabase session tokens to identify the authenticated caller.
4. **ML Python Service**: Machine learning microservice responsible for classification and cash flow forecasting using statsmodels.
5. **Supabase Auth**: Managed user database, session cookies, OAuth client flows, and confirmation dispatch.
