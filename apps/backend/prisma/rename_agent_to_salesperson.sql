-- Rename the AGENT role to SALESPERSON. Existing users and the column default follow automatically.
ALTER TYPE "UserRole" RENAME VALUE 'AGENT' TO 'SALESPERSON';

-- WhatsApp number used to deliver internal (admin / manager / salesperson) notifications.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
