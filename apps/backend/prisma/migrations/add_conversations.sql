-- Enums
DO $$ BEGIN
  CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MessageType" AS ENUM ('TEXT', 'TEMPLATE', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'STICKER', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Conversation table
CREATE TABLE IF NOT EXISTS "Conversation" (
  "id"              TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "phone"           TEXT NOT NULL UNIQUE,
  "contactId"       TEXT,
  "lastMessageAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "windowExpiresAt" TIMESTAMP(3),
  "unreadCount"     INTEGER NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt" DESC);
CREATE INDEX IF NOT EXISTS "Conversation_phone_idx" ON "Conversation"("phone");

-- Message table
CREATE TABLE IF NOT EXISTS "Message" (
  "id"             TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "conversationId" TEXT NOT NULL,
  "direction"      "MessageDirection" NOT NULL,
  "type"           "MessageType" NOT NULL DEFAULT 'TEXT',
  "body"           TEXT,
  "mediaUrl"       TEXT,
  "mediaType"      TEXT,
  "templateName"   TEXT,
  "waMessageId"    TEXT UNIQUE,
  "status"         "MessageStatus" NOT NULL DEFAULT 'SENT',
  "failReason"     TEXT,
  "sentAt"         TIMESTAMP(3),
  "deliveredAt"    TIMESTAMP(3),
  "readAt"         TIMESTAMP(3),
  "failedAt"       TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_waMessageId_idx" ON "Message"("waMessageId");
