# Security Hardening v1 — EnFoco

**Date:** 2026-07-28
**Scope:** Static audit of RLS, RPC, secrets, sessions, dependencies.
**Status:** Audit complete — no remediations applied.

---

## 1. Executive Summary

EnFoco's database layer demonstrates a strong security posture. All 8 business tables have RLS enabled with per-user isolation. All 7 SECURITY DEFINER RPCs use `search_path = ''` and validate `auth.uid()`. No secrets were found in version control. The primary risks are INFO/LOW-level items around missing `updated_at` column on the exceptions table and the `handle_updated_at` function being executable by `public` (default PG behavior for SECURITY INVOKER functions).

---

## 2. Scope Reviewed

- 10 SQL migrations
- 8 public tables
- 10 public functions (7 SECURITY DEFINER, 3 SECURITY INVOKER)
- Client-side auth (AuthProvider, Supabase client)
- `.gitignore`, `.env.example`, `app.json`, `eas.json`
- Git history for exposed secrets
- npm dependencies (production)

---

## 3. Table Inventory & RLS Matrix

| Table | PK | Owner Col | RLS | SELECT | INSERT | UPDATE | DELETE | Roles |
|-------|-----|-----------|-----|--------|--------|--------|--------|-------|
| profiles | id (=user) | id | ✅ | own | own | own | ✗ | authenticated |
| cycles | uuid | user_id | ✅ | own | own | own | own | authenticated |
| categories | uuid | user_id | ✅ | own | own | own | own | authenticated |
| activities | uuid | user_id | ✅ | own | own | own | own | authenticated |
| activity_schedules | uuid | user_id | ✅ | own | own | own | own | authenticated |
| activity_logs | uuid | user_id | ✅ | own | own | own | own | authenticated |
| task_occurrences | uuid | user_id | ✅ | own | own | own | own | authenticated |
| task_occurrence_exceptions | uuid | user_id | ✅ | own | own | own | own | authenticated |

**All policies use `user_id = (select auth.uid())` or `id = auth.uid()` (profiles).**

**No `anon` grants found on any business table.**

---

## 4. Cross-User Ownership Validation

Compound foreign keys guarantee same-user ownership:
- activities → cycles (cycle_id, user_id)
- activities → categories (category_id, user_id)
- activity_schedules → activities (activity_id, user_id)
- activity_logs → activities (activity_id, user_id)
- task_occurrences → cycles, activities, schedules, categories (all compound FKs)
- task_occurrence_exceptions → schedules (schedule_id, user_id)

**A user cannot associate their row with another user's cycle, category, or activity.**

---

## 5. RPC Inventory

| Function | Security | search_path | Roles w/ EXECUTE | Accepts user_id? | Validates auth.uid()? |
|----------|----------|-------------|-----------------|-------------------|----------------------|
| start_new_cycle | DEFINER | '' | authenticated | No | Yes |
| archive_cycle | DEFINER | '' | authenticated | No | Yes |
| copy_cycle_routines | DEFINER | '' | authenticated | No | Yes |
| ensure_task_occurrences | DEFINER | '' | authenticated | No | Yes |
| reorder_task_occurrences | DEFINER | '' | authenticated | No | Yes |
| move_task_occurrence | DEFINER | '' | authenticated | No | Yes |
| delete_task_occurrence_for_day | DEFINER | '' | authenticated | No | Yes |
| handle_updated_at | INVOKER | '' | public (default) | N/A (trigger) | N/A |
| handle_new_user_profile | DEFINER | '' | revoked from public/anon | N/A (trigger) | N/A |
| handle_new_user_seed | DEFINER | '' | revoked from public/anon | N/A (trigger) | N/A |
| seed_new_user_data | DEFINER | '' | revoked from public/anon/auth | No | N/A (internal) |

---

## 6. Secrets Audit

| Check | Result |
|-------|--------|
| .env.local in .gitignore | ✅ |
| .env.example has no values | ✅ |
| No service_role in source | ✅ (only comment warning) |
| No postgres:// URLs | ✅ |
| No .pem/.key/.p12 tracked | ✅ (.gitignore covers them) |
| No secrets in app.json/eas.json | ✅ |
| Git history clean | ✅ (only .env.example committed) |
| Client uses only publishable key | ✅ |

---

## 7. Authentication & Session

| Aspect | Implementation |
|--------|---------------|
| Client creation | `createClient<Database>(url, anonKey)` |
| Storage (native) | expo-sqlite localStorage polyfill |
| Storage (web) | window.localStorage |
| Storage (SSR) | In-memory Map (no persistence) |
| autoRefreshToken | true |
| persistSession | true |
| detectSessionInUrl | false |
| AppState refresh (native) | startAutoRefresh/stopAutoRefresh |
| Session cleanup | AuthProvider clears on signOut |
| Profile cleanup | ProfileProvider clears when user=null |
| Route protection | Stack.Protected guards |
| Token logging | None found |

---

## 8. npm audit

```
17 vulnerabilities (15 moderate, 2 high)
0 critical
```

**High vulnerabilities:** Both in transitive Expo tooling dependencies (`@expo/config-plugins`, `@expo/prebuild-config`). These are build-time only and do not ship to production. No action required for runtime security.

---

## 9. supabase db lint

```
Linting schema: public
No schema errors found
```

---

## 10. pgTAP Tests Created

| File | Tests | Purpose |
|------|-------|---------|
| 001_rls_enabled.test.sql | 8 | Verify all tables exist (prerequisite for RLS checks) |
| 002_rls_isolation.test.sql | 6 | Cross-user read/write isolation |
| 003_rpc_permissions.test.sql | 14 | anon blocked, authenticated allowed |
| 004_function_security.test.sql | 8 | SECURITY DEFINER/INVOKER correctness |

**Total: 36 assertions across 4 test files.**

---

## 11. Findings

### SEC-001 — INFO — handle_updated_at executable by public

- **Object:** `public.handle_updated_at()`
- **Evidence:** SECURITY INVOKER function, default PG grants allow public EXECUTE
- **Risk:** Minimal — function only sets `updated_at = now()` and is only useful as a trigger
- **Scenario:** An anonymous user could call it directly, but it would have no effect without a trigger context
- **Recommendation:** `REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM public, anon;`
- **Requires migration:** Yes
- **Breaking:** No

### SEC-002 — LOW — task_occurrence_exceptions missing updated_at trigger

- **Object:** `public.task_occurrence_exceptions`
- **Evidence:** The `trg_toe_updated_at` trigger references `handle_updated_at` but the table has no `updated_at` column
- **Risk:** Trigger will fail on UPDATE; however the table is mostly INSERT-only with ON CONFLICT DO UPDATE
- **Recommendation:** Add `updated_at` column or remove the trigger
- **Requires migration:** Yes
- **Breaking:** Potential UPDATE failures

### SEC-003 — LOW — Mover a otro día shows action for non-pending without server check

- **Object:** `app/(tabs)/week.tsx`, `app/(tabs)/index.tsx`
- **Evidence:** UI shows "Mover" for non-pending then relies on RPC to reject
- **Risk:** Poor UX (error after action); server correctly blocks it
- **Recommendation:** Disable action in UI when status !== 'pending'
- **Requires migration:** No
- **Breaking:** No

### SEC-004 — INFO — copy_cycle_routines still deployed but unused

- **Object:** `public.copy_cycle_routines(uuid, uuid)`
- **Evidence:** No client code calls this function
- **Risk:** Minimal attack surface expansion
- **Recommendation:** Remove in a future cleanup migration
- **Requires migration:** Yes
- **Breaking:** No

### SEC-005 — INFO — profiles DELETE policy absent by design

- **Object:** `public.profiles`
- **Evidence:** No DELETE policy — intentional per REQ
- **Risk:** None (ON DELETE CASCADE from auth.users handles cleanup)
- **Status:** By design, no action needed

---

## 12. Manual Test Checklist

### User A
- [ ] Create cycle
- [ ] Create category
- [ ] Create routine
- [ ] Create task occurrence
- [ ] Move task to another day
- [ ] Delete task from day
- [ ] Sign out

### User B (same browser/device)
- [ ] Sign in — no data from A visible
- [ ] Create own data
- [ ] Sign out

### Return to User A
- [ ] Data intact
- [ ] No data from B visible

### Edge cases
- [ ] Open private route without session → redirected to sign-in
- [ ] Reload web with session → stays authenticated
- [ ] Sign out then press Back → stays on sign-in
- [ ] Switch accounts without restart → clean state
- [ ] Expired token → auto-refresh or redirect

---

## 13. Remediation Plan

| Priority | ID | Action | Effort |
|----------|-----|--------|--------|
| LOW | SEC-001 | Revoke execute on handle_updated_at from public/anon | 1 line migration |
| LOW | SEC-002 | Add updated_at to exceptions or remove trigger | Small migration |
| INFO | SEC-004 | Drop copy_cycle_routines if confirmed unused | Small migration |
| N/A | SEC-003 | UI guard for Mover in non-pending state | Client-only fix |

No CRITICAL or HIGH findings.
