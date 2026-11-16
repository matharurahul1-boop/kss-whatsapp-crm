-- Safe to run more than once.

-- 1) Rename the AGENT role to SALESPERSON (shown as "Sales Manager" in the app).
--    Existing users and the column default follow automatically.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'AGENT'
  ) THEN
    ALTER TYPE "UserRole" RENAME VALUE 'AGENT' TO 'SALESPERSON';
  END IF;
END $$;

-- 2) WhatsApp number used to deliver internal (admin / manager / sales manager) notifications.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- Check: should list ADMIN, MANAGER, SALESPERSON, and the phone column should exist.
SELECT e.enumlabel AS role FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'UserRole' ORDER BY e.enumsortorder;
SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'phone';
