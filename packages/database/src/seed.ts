import "dotenv/config";
import { prisma } from "./index";

async function main() {
  const sources = [
    { id: "github", name: "GitHub", baseUrl: "https://api.github.com", adapter: "GitHubAdapter", defaultConcurrency: 1 },
    { id: "gitlab", name: "GitLab", baseUrl: "https://gitlab.com/api/v4", adapter: "GitLabAdapter", defaultConcurrency: 2 },
    { id: "codeberg", name: "Codeberg", baseUrl: "https://codeberg.org/api/v1", adapter: "CodebergAdapter", defaultConcurrency: 2 },
    { id: "hackclub", name: "Hack Club Hackathons", baseUrl: "https://hackathons.hackclub.com", adapter: "HackClubEventsAdapter", defaultConcurrency: 2 }
  ];
  for (const source of sources) {
    await prisma.source.upsert({ where: { id: source.id }, create: source, update: source });
  }
  console.log(`Seeded ${sources.length} discovery sources.`);
}

main().finally(async () => prisma.$disconnect());
