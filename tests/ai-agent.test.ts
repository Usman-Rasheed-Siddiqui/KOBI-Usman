import test from "node:test";
import assert from "node:assert/strict";
import { runForgeAgent } from "../packages/ai/src/index.ts";
import type { Opportunity } from "../packages/domain/src/index.ts";

function contribution(id: number): Opportunity {
  const now = new Date().toISOString();
  return {
    id: `issue-${id}`,
    title: `React beginner issue ${id}`,
    entityType: "CONTRIBUTION",
    source: "GitHub",
    canonicalUrl: `https://github.com/example/repo/issues/${id}`,
    contributionUrl: `https://github.com/example/repo/issues/${id}`,
    repositoryUrl: "https://github.com/example/repo",
    technologies: ["React"],
    languages: ["TypeScript"],
    topics: ["good first issue"],
    skillsRequired: ["React"],
    difficulty: "BEGINNER",
    beginnerFriendly: true,
    goodFirstIssue: true,
    helpWanted: false,
    activityScore: 80,
    maintainerResponsiveness: 75,
    lastActivity: now,
    contributionTypes: ["Bug"],
    hardware: false,
    qualityScore: 78 + id,
    freshnessScore: 95,
    matchScore: 0,
    scrapedAt: now,
    updatedAt: now,
    metadata: { state: "open" },
  };
}

test("agent answers friendly chat without invoking discovery tools", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const result = await runForgeAgent("How are you?", undefined, [], undefined, {
    searchIndexed: async () => { throw new Error("search should not run"); },
    persist: async () => { throw new Error("persist should not run"); },
  });
  if (previousKey) process.env.GEMINI_API_KEY = previousKey;

  assert.equal(result.responseKind, "conversation");
  assert.equal(result.events.length, 0);
  assert.deepEqual(result.opportunities, []);
});

test("agent show more pages through ranked context without duplicates", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const indexed = Array.from({ length: 9 }, (_, index) => contribution(index + 1));
  const first = await runForgeAgent("Find beginner React contribution issues quickly", undefined, [], undefined, {
    searchIndexed: async () => indexed,
    persist: async () => undefined,
  });
  const more = await runForgeAgent("show more", undefined, [], first.context, {
    searchIndexed: async () => { throw new Error("show more should use context first"); },
    persist: async () => { throw new Error("persist should not run"); },
  });
  if (previousKey) process.env.GEMINI_API_KEY = previousKey;

  const firstIds = new Set(first.opportunities.map((item) => item.id));
  assert.equal(first.opportunities.length, 3);
  assert.equal(more.opportunities.length, 3);
  assert.equal(more.events[0]?.tool, "page_existing_ranked_results");
  assert.equal(more.opportunities.some((item) => firstIds.has(item.id)), false);
});
