-- Source material is data, never authorization or executable instructions.
ALTER TABLE ingestion_reviews ADD COLUMN security_status TEXT NOT NULL DEFAULT 'UNASSESSED' CHECK(security_status IN ('UNASSESSED','REVIEW','QUARANTINED'));
ALTER TABLE ingestion_reviews ADD COLUMN security_flags_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE ingestion_reviews ADD COLUMN content_hash TEXT;
ALTER TABLE ingestion_reviews ADD COLUMN ai_proposal_json TEXT;
CREATE INDEX idx_email_security ON ingestion_reviews(security_status,created_at);
