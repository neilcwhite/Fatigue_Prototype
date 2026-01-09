# RLS Quick Start - 5 Minutes

**Don't worry!** I've made this super easy. Just follow these steps:

---

## Option 1: Automatic (Windows - Easiest!)

Just double-click this file:

```
apply-rls-easy.bat
```

It will:
1. ✅ Open your Supabase dashboard automatically
2. ✅ Copy the migration SQL to your clipboard
3. ✅ Guide you step-by-step
4. ✅ Start your dev server to test

**That's it!** Just follow the prompts.

---

## Option 2: Manual (5 Minutes)

### Step 1: Open Supabase Dashboard

1. Go to [supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your Fatigue project

### Step 2: Open SQL Editor

1. Click **"SQL Editor"** in the left sidebar
2. Click **"New Query"** button (top right)

### Step 3: Copy & Paste the Migration

1. Open this file in your text editor:
   ```
   supabase/migrations/20260109_enable_rls_all_tables_safe.sql
   ```

   **Note:** Use the `_safe.sql` version - it won't error if policies already exist!

2. **Select All** (Ctrl+A) and **Copy** (Ctrl+C)

3. **Paste** (Ctrl+V) into the Supabase SQL Editor

### Step 4: Run It!

1. Click the **"Run"** button (or press Ctrl+Enter)
2. Wait 2-3 seconds for it to complete
3. Check the output - should see "Success" messages

### Step 5: Test Your App

```bash
npm run dev
```

1. Open http://localhost:3000
2. Sign in with your account
3. Try creating a project or employee
4. Everything should work exactly the same!

**Done!** 🎉

---

## What Did This Do?

It enabled **Row Level Security** on your database, which means:

- ✅ Users can only see their own organisation's data
- ✅ Database-level protection (very secure)
- ✅ No code changes needed
- ✅ Everything works the same from your app's perspective

---

## Troubleshooting

### "Permission denied" errors after running migration

**This is GOOD!** It means RLS is working. Just make sure you:
1. Have a user account created
2. Have a user_profiles record with your organisation_id
3. Sign in with your account in the app

### App shows no data after enabling RLS

**Fix:** Your user_profiles might not have the right organisation_id

Run this in SQL Editor:
```sql
-- Check your profile
SELECT * FROM user_profiles WHERE id = auth.uid();

-- If organisation_id is NULL, set it to your org's ID
UPDATE user_profiles
SET organisation_id = 'YOUR_ORG_ID_HERE'
WHERE id = auth.uid();
```

### "Table user_profiles does not exist"

**Fix:** Create the user_profiles table first:

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Still stuck?

1. Check [RLS_SETUP_GUIDE.md](RLS_SETUP_GUIDE.md) for detailed troubleshooting
2. Or just let me know what error you're seeing!

---

## Verification (Optional)

Want to make sure RLS is working? Run this in SQL Editor:

```sql
-- Should show rowsecurity = true for all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('employees', 'projects', 'assignments')
ORDER BY tablename;
```

If `rowsecurity = true`, you're all set! ✅

---

**That's it!** RLS is now protecting your data. Your app works exactly the same, but now it's production-secure.
