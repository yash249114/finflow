# FinFlow — Full Stack SaaS Cash Flow App

FinFlow is a premium SaaS application providing cash flow intelligence, Holt-Winters predictive analytics, and automated transaction categorization for modern businesses.

---

## 1. Environment Variables Configuration

Copy the `.env.example` in both the root and frontend directories:
```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

### Required Variables
- `NEXT_PUBLIC_SUPABASE_URL`: The API URL of your Supabase project (e.g. `https://your-project.supabase.co`).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: The anonymous public client token for Supabase.
- `NEXT_PUBLIC_APP_URL`: The URL of your frontend application (e.g. `http://localhost:3000` locally, or `https://finflow-ashy-six.vercel.app` in production).
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`: Google reCAPTCHA v2 Checkbox public site key.
- `RECAPTCHA_SECRET_KEY`: Google reCAPTCHA v2 Checkbox private secret key (never expose to the frontend).

---

## 2. Google OAuth Configuration

To support Google Login & Signup, configure Google Cloud Console and Supabase:

### A. Google Cloud Console Settings
1. Go to OAuth Consent Screen and create your credential client.
2. Under **Authorized JavaScript origins**, add:
   - `http://localhost:3000`
   - `https://finflow-ashy-six.vercel.app`
3. Under **Authorized redirect URIs**, add:
   - `https://ebvzmmbomplcvuznhipp.supabase.co/auth/v1/callback` (replace with your project reference code).

### B. Supabase Provider Settings
1. Navigate to **Authentication** ➔ **Providers** ➔ **Google** in the Supabase Dashboard.
2. Enable the Google Provider.
3. Insert the **Client ID** and **Client Secret** retrieved from the Google Cloud Console.
4. Save the configuration.

---

## 3. Supabase Clean Auth Reset Instructions

To execute a clean authentication reset (wipe test accounts, remove legacy users, and reset schema relationships):

### SQL Clean Reset
Run the following SQL snippet in the Supabase **SQL Editor**:

```sql
-- 1. Truncate user transaction data and profiles cascade
TRUNCATE public.transactions CASCADE;
TRUNCATE public.refresh_tokens CASCADE;
TRUNCATE public.users CASCADE;

-- 2. Truncate Supabase internal auth users
TRUNCATE auth.users CASCADE;

-- 3. Verify public.users schema integrity
ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 4. Establish cascaded foreign key to auth.users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS fk_users_auth_users;
ALTER TABLE public.users
ADD CONSTRAINT fk_users_auth_users
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

This wipes all testing accounts and sets up the schema for immediate registration.
