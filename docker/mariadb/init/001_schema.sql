-- v1 schema: projects (domains) -> pages -> crawls (snapshots) -> findings
-- Applied via `npm run migrate` (src/db/migrate.ts), which reads and runs every
-- docker/mariadb/init/*.sql not yet recorded in schema_migrations. For later
-- schema changes, add 002_*.sql etc. alongside this file.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(20) PRIMARY KEY,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS projects (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  domain VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_projects_domain (domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id INT UNSIGNED NOT NULL,
  url VARCHAR(2048) NOT NULL,
  url_hash CHAR(64) NOT NULL COMMENT 'sha256(url) - url itself is too long for a reliable unique key',
  first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pages_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE KEY uq_pages_project_urlhash (project_id, url_hash),
  KEY idx_pages_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS crawls (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  page_id INT UNSIGNED NOT NULL,
  crawled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  raw_data JSON NOT NULL COMMENT 'full ExtractedData for this crawl',
  overall_status ENUM('pass','warn','fail') NOT NULL,
  pass_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  warn_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  fail_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  mobile_load_ms INT UNSIGNED NULL COMMENT 'denormalized from raw_data for fast trend/rollup aggregation',
  http_status SMALLINT UNSIGNED NULL,
  CONSTRAINT fk_crawls_page FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  KEY idx_crawls_page_time (page_id, crawled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS findings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  crawl_id BIGINT UNSIGNED NOT NULL,
  check_id VARCHAR(100) NOT NULL COMMENT 'matches CheckDefinition.id, namespaced e.g. seo.*, geo.*, technical.*',
  status ENUM('pass','warn','fail') NOT NULL,
  detail TEXT NOT NULL,
  data JSON NULL COMMENT 'structured payload for rollup grouping',
  CONSTRAINT fk_findings_crawl FOREIGN KEY (crawl_id) REFERENCES crawls(id) ON DELETE CASCADE,
  KEY idx_findings_crawl (crawl_id),
  KEY idx_findings_check (check_id),
  KEY idx_findings_crawl_check (crawl_id, check_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO schema_migrations (version) VALUES ('001') ON DUPLICATE KEY UPDATE version = version;
