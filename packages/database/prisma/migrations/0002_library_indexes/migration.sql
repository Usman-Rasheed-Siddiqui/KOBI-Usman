CREATE INDEX IF NOT EXISTS "Project_qualityScore_lastActivity_idx"
  ON "Project" ("qualityScore", "lastActivity");

CREATE INDEX IF NOT EXISTS "ContributionOpportunity_difficulty_lastActivity_idx"
  ON "ContributionOpportunity" ("difficulty", "lastActivity");

CREATE INDEX IF NOT EXISTS "ContributionOpportunity_goodFirstIssue_helpWanted_lastActivity_idx"
  ON "ContributionOpportunity" ("goodFirstIssue", "helpWanted", "lastActivity");

CREATE INDEX IF NOT EXISTS "Event_eventType_startsAt_idx"
  ON "Event" ("eventType", "startsAt");

CREATE INDEX IF NOT EXISTS "Event_source_scrapedAt_idx"
  ON "Event" ("source", "scrapedAt");
