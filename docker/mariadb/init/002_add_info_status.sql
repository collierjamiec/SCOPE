-- Adds a fourth finding severity, 'info', distinct from 'warn': for situational
-- signals (e.g. an optional schema type that doesn't apply to every page) that
-- shouldn't read as "you should fix this" and shouldn't move overall_status.

-- overall_status is untouched (stays pass/warn/fail only): 'info' findings never
-- drive a crawl's overall status, only findings.status needs the new value.
ALTER TABLE findings
  MODIFY COLUMN status ENUM('pass','info','warn','fail') NOT NULL;

ALTER TABLE crawls
  ADD COLUMN info_count SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER pass_count;

INSERT INTO schema_migrations (version) VALUES ('002') ON DUPLICATE KEY UPDATE version = version;
