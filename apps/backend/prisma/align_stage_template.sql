-- Align the old Lead automation mapping with the current Enquiry stage.
-- An existing Enquiry mapping causes a unique-key conflict instead of silently overwriting it.
UPDATE "StageTemplate" SET "stage" = 'ENQUIRY'::"ContactStage", "updatedAt" = NOW()
WHERE "stage"::text = 'LEAD';
