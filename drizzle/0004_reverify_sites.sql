-- The previous verification action only set sites.verified=true and never checked domain control.
-- Existing verified flags therefore cannot be trusted until the domain's token file is checked again.
UPDATE sites
SET verified = FALSE,
    automation_enabled = FALSE,
    updated_at = NOW()
WHERE verified = TRUE OR automation_enabled = TRUE;
