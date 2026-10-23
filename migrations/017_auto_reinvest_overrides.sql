-- Convert seeded rows from migration 016 into nullable admin overrides.
-- NULL means honor the user's own autoReinvest preference. Rows with updated_by set
-- are explicit admin choices and are preserved.
ALTER TABLE user_auto_invest_preferences ALTER COLUMN enabled DROP NOT NULL;
ALTER TABLE user_auto_invest_preferences ALTER COLUMN enabled DROP DEFAULT;
UPDATE user_auto_invest_preferences SET enabled = NULL WHERE updated_by IS NULL;
