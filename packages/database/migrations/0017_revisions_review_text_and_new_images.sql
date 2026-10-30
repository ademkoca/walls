-- Only a new title or description and added images wait for review now; removing an approved
-- image applies at once (decision 2026-10-30). Removals recorded in pending revisions are
-- dropped: those images stay public until their creator removes them again.
ALTER TABLE "listing_revisions" DROP COLUMN "removed_media_ids";
