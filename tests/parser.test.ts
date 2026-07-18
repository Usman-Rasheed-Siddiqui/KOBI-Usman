import test from "node:test";
import assert from "node:assert/strict";
import { extractJsonLdEvents } from "../packages/discovery/src/parsers/html.ts";

test("JSON-LD event parser normalizes public event metadata", () => {
  const html=`<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"Event",name:"Open Hardware Night",url:"/register",startDate:"2026-08-12T18:00:00Z",eventAttendanceMode:"https://schema.org/OnlineEventAttendanceMode",location:{"@type":"VirtualLocation"}})}</script>`;
  const [event]=extractJsonLdEvents(html,"https://events.example.org/list");
  assert.equal(event?.title,"Open Hardware Night");
  assert.equal(event?.url,"https://events.example.org/register");
  assert.equal(event?.mode,"REMOTE");
});

import { parseSyndicationFeed } from "../packages/discovery/src/parsers/feed.ts";

test("RSS/Atom parser resolves relative links and categories", () => {
  const rss = `<?xml version="1.0"?><rss version="2.0"><channel><item><title>Open Robotics Sprint</title><link>/events/robotics</link><description>ESP32 and ROS contributors welcome.</description><pubDate>Sat, 18 Jul 2026 10:00:00 GMT</pubDate><category>Robotics</category><category>Open Source</category></item></channel></rss>`;
  const [item] = parseSyndicationFeed(rss, "https://community.example.org/feed.xml");
  assert.equal(item?.title, "Open Robotics Sprint");
  assert.equal(item?.url, "https://community.example.org/events/robotics");
  assert.deepEqual(item?.categories, ["Robotics", "Open Source"]);
});
