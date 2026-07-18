import test from "node:test";
import assert from "node:assert/strict";
import { applySearchFilters, cleanDescription, cleanDisplayText, detectHardware, locationMatches, rankOpportunities, stableOpportunityId, validateOpportunityForIntent, type Opportunity } from "../packages/domain/src/index.ts";

test("hardware detection recognizes open hardware signals", () => {
  assert.equal(detectHardware("ESP32 sensor board", "KiCad schematic and Gerber files", ["firmware"]), true);
  assert.equal(detectHardware("React dashboard", "A web interface", ["frontend"]), false);
});

test("stable ids are deterministic", () => {
  assert.equal(stableOpportunityId("github", "https://github.com/a/b/issues/1"), stableOpportunityId("github", "https://github.com/a/b/issues/1"));
});

test("display text sanitizer removes HTML and badge-only event descriptions", () => {
  assert.equal(
    cleanDisplayText('<p>Join <a href="https://example.com">API Conf</a> &amp; workshops<br><img alt="CFP API Conf Lagos 2026" src="badge.svg"></p>'),
    "Join API Conf & workshops CFP API Conf Lagos 2026",
  );
  assert.equal(
    cleanDescription('<a href="https://sessionize.com/api-conf-lagos-2026"><img alt="CFP API Conf Lagos 2026" src="https://img.shields.io/static/v1"></a>', "API Conf Lagos 2026"),
    undefined,
  );
});

test("ranking rewards skill overlap without discarding source quality", () => {
  const base: Opportunity = {
    id:"1", title:"React accessibility issue", entityType:"CONTRIBUTION", source:"GitHub", canonicalUrl:"https://example.com/1", contributionUrl:"https://example.com/1",
    technologies:["React","TypeScript"],languages:["TypeScript"],topics:["accessibility"],skillsRequired:["React"],difficulty:"BEGINNER",beginnerFriendly:true,goodFirstIssue:true,helpWanted:true,
    activityScore:85,maintainerResponsiveness:80,contributionTypes:["Accessibility"],hardware:false,qualityScore:80,freshnessScore:90,matchScore:0,scrapedAt:new Date().toISOString(),updatedAt:new Date().toISOString()
  };
  const weaker = {...base,id:"2",title:"Unrelated Java project",canonicalUrl:"https://example.com/2",contributionUrl:"https://example.com/2",technologies:["Java"],languages:["Java"],skillsRequired:["Java"]};
  const ranked=rankOpportunities([weaker,base],{skills:["React","TypeScript"],interests:["accessibility"],level:"BEGINNER"});
  assert.equal(ranked[0]?.id,"1");
  assert.ok((ranked[0]?.matchScore ?? 0) > (ranked[1]?.matchScore ?? 0));
});

test("pulse filters keep only current event results", () => {
  const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
  const past = new Date(Date.now() - 5 * 86_400_000).toISOString();
  const event: Opportunity = {
    id:"event-1", title:"AI Hackathon Pakistan", entityType:"EVENT", source:"Developers Events", canonicalUrl:"https://events.example/ai-hackathon",
    technologies:["AI"],languages:[],topics:["hackathon","pakistan"],skillsRequired:["AI"],difficulty:"UNKNOWN",beginnerFriendly:false,goodFirstIssue:false,helpWanted:false,
    activityScore:80,maintainerResponsiveness:60,location:"Karachi, Pakistan",mode:"PHYSICAL",eventDate:future,contributionTypes:["Hackathon"],hardware:false,qualityScore:82,freshnessScore:95,matchScore:0,scrapedAt:new Date().toISOString(),updatedAt:new Date().toISOString()
  };
  const expired = {...event,id:"event-2",title:"Past AI Hackathon Pakistan",canonicalUrl:"https://events.example/past",eventDate:past};
  const issue = {...event,id:"issue-1",title:"AI good first issue",entityType:"CONTRIBUTION" as const,canonicalUrl:"https://github.com/a/b/issues/1",contributionUrl:"https://github.com/a/b/issues/1",eventDate:undefined};

  const filtered = applySearchFilters([event, expired, issue], { query:"Find upcoming AI events in Pakistan", contentType:"pulse", entityTypes:["EVENT"], datePreset:"upcoming", location:"Pakistan" });
  assert.deepEqual(filtered.map((item) => item.id), ["event-1"]);
  assert.equal(validateOpportunityForIntent(event, { query:"AI events Pakistan", contentType:"pulse", entityTypes:["EVENT"] }), true);
  assert.equal(validateOpportunityForIntent(expired, { query:"AI events Pakistan", contentType:"pulse", entityTypes:["EVENT"] }), false);
});

test("karachi event searches stay city-specific and rank local events first", () => {
  const future = new Date(Date.now() + 14 * 86_400_000).toISOString();
  const karachi: Opportunity = {
    id:"event-karachi", title:"AI Builders Karachi", entityType:"EVENT", source:"Developers Events", canonicalUrl:"https://events.example/karachi",
    technologies:["AI"],languages:[],topics:["AI","meetup"],skillsRequired:["AI"],difficulty:"UNKNOWN",beginnerFriendly:true,goodFirstIssue:false,helpWanted:false,
    activityScore:78,maintainerResponsiveness:70,location:"Karachi, Sindh, Pakistan",mode:"PHYSICAL",eventDate:future,contributionTypes:["Meetup"],hardware:false,qualityScore:80,freshnessScore:92,matchScore:0,scrapedAt:new Date().toISOString(),updatedAt:new Date().toISOString()
  };
  const lahore = {...karachi,id:"event-lahore",title:"AI Builders Lahore",canonicalUrl:"https://events.example/lahore",location:"Lahore, Punjab, Pakistan",qualityScore:99};
  const online = {...karachi,id:"event-online",title:"Online AI Builders",canonicalUrl:"https://events.example/online",location:"Online",mode:"REMOTE" as const,qualityScore:88};

  assert.equal(locationMatches("Lahore, Punjab, Pakistan", "Pakistan"), true);
  assert.equal(locationMatches("Lahore, Punjab, Pakistan", "Karachi"), false);
  const strict = applySearchFilters([lahore, karachi, online], { query:"Find AI events in Karachi", contentType:"pulse", entityTypes:["EVENT"], datePreset:"upcoming", location:"Karachi" });
  assert.deepEqual(strict.map((item) => item.id), ["event-karachi"]);
  const ranked = rankOpportunities([online, karachi], undefined, { query:"Find AI events in Karachi", contentType:"pulse", location:"Karachi" });
  assert.deepEqual(ranked.map((item) => item.id), ["event-karachi", "event-online"]);
});

test("forge filters reject events and closed contribution issues", () => {
  const active: Opportunity = {
    id:"contribution-1", title:"React good first issue", entityType:"CONTRIBUTION", source:"GitHub", canonicalUrl:"https://github.com/a/b/issues/2", contributionUrl:"https://github.com/a/b/issues/2",
    repositoryUrl:"https://github.com/a/b", technologies:["React"],languages:["TypeScript"],topics:["frontend"],skillsRequired:["React"],difficulty:"BEGINNER",beginnerFriendly:true,goodFirstIssue:true,helpWanted:false,
    activityScore:88,maintainerResponsiveness:84,lastActivity:new Date().toISOString(),contributionTypes:["Bug"],hardware:false,qualityScore:86,freshnessScore:98,matchScore:0,scrapedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),metadata:{state:"open"}
  };
  const closed = {...active,id:"contribution-2",canonicalUrl:"https://github.com/a/b/issues/3",contributionUrl:"https://github.com/a/b/issues/3",metadata:{state:"closed"}};
  const event = {...active,id:"event-1",entityType:"EVENT" as const,canonicalUrl:"https://events.example/react",contributionUrl:undefined,eventDate:new Date(Date.now() + 86_400_000).toISOString()};

  const filtered = applySearchFilters([active, closed, event], { query:"Find beginner-friendly React contributions", contentType:"forge", entityTypes:["CONTRIBUTION"], beginnerFriendly:true, issueStatus:"open" });
  assert.deepEqual(filtered.map((item) => item.id), ["contribution-1"]);
  assert.equal(validateOpportunityForIntent(active, { query:"React contributions", contentType:"forge", entityTypes:["CONTRIBUTION"], issueStatus:"open" }), true);
  assert.equal(validateOpportunityForIntent(closed, { query:"React contributions", contentType:"forge", entityTypes:["CONTRIBUTION"], issueStatus:"open" }), false);
});
