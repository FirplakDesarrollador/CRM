-- Migration: Add Microsoft integration columns to CRM_Actividades
-- These fields are written by CreateActivityModal.tsx when creating Teams meetings
-- and are referenced by the sync engine. They were missing from the schema, causing sync failures.

ALTER TABLE "CRM_Actividades"
  ADD COLUMN IF NOT EXISTS "teams_meeting_url" TEXT,
  ADD COLUMN IF NOT EXISTS "microsoft_attendees" TEXT,
  ADD COLUMN IF NOT EXISTS "ms_event_id" TEXT;
