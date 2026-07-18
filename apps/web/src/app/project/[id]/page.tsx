import { prisma } from "@openforge/database";
import { notFound } from "next/navigation";
import { ArrowUpRight, GitPullRequest, Users } from "lucide-react";
import { RoomPanel } from "@/components/room-panel";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params;
  let project;
  try {
    project = await prisma.project.findUnique({
      where: { id },
      include: {
        repository: true,
        opportunities: { take: 12, orderBy: { qualityScore: "desc" } },
        roleSlots: { where: { open: true } },
        members: { include: { user: { select: { name: true } } } },
      },
    });
  } catch {
    return <DbNotice />;
  }
  if (!project) notFound();

  const metadata = project.metadata && typeof project.metadata === "object" ? project.metadata as Record<string, unknown> : {};
  const isRoom = metadata.KOBIRoom === true;

  return (
    <main className="mx-auto max-w-6xl py-8">
      <div className="surface rounded-[30px] p-6 sm:p-8">
        <div className="text-[11px] font-bold uppercase tracking-[.15em] text-[#78827a]">{isRoom ? "KOBI project room" : project.hardware ? "Open hardware" : "Open-source project"}</div>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-.055em]">{project.title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#657067]">{project.description ?? "No project description was provided by the source."}</p>
        <div className="mt-5 flex flex-wrap gap-2">{[...project.languages, ...project.technologies].slice(0, 8).map((value) => <span key={value} className="rounded-full border border-black/7 bg-[#f5f7f3] px-3 py-1.5 text-xs">{value}</span>)}</div>
        {project.repository?.repositoryUrl && <a href={project.repository.repositoryUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex h-11 items-center gap-2 rounded-[14px] bg-[#163c2d] px-5 text-sm font-semibold text-white">Open real repository <ArrowUpRight className="size-4" /></a>}
      </div>

      {!isRoom && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="surface rounded-[24px] p-5">
            <div className="flex items-center gap-2 font-semibold"><GitPullRequest className="size-4" />Contribution opportunities</div>
            <div className="mt-4 divide-y divide-black/7">
              {project.opportunities.length ? project.opportunities.map((opportunity: { id: string; contributionUrl: string; title: string; beginnerFriendly: boolean; source: string }) => <a key={opportunity.id} href={opportunity.contributionUrl} target="_blank" rel="noreferrer" className="block py-3"><div className="text-sm font-medium">{opportunity.title}</div><div className="mt-1 text-xs text-[#78817a]">{opportunity.beginnerFriendly ? "Beginner-friendly · " : ""}{opportunity.source}</div></a>) : <p className="py-4 text-sm text-[#78817a]">No indexed opportunities yet. Open the repository to inspect current issues.</p>}
            </div>
          </section>
          <section className="surface rounded-[24px] p-5">
            <div className="flex items-center gap-2 font-semibold"><Users className="size-4" />Collaboration layer</div>
            <p className="mt-2 text-sm leading-6 text-[#6c766e]">KOBI coordinates discovery and teammates without replacing the repository host.</p>
            <div className="mt-4 space-y-2">{project.roleSlots.length ? project.roleSlots.map((role: { id: string; title: string; slots: number; skills: string[] }) => <div key={role.id} className="rounded-[15px] border border-black/7 p-3"><div className="text-sm font-semibold">{role.title}</div><div className="mt-1 text-xs text-[#778079]">{role.slots} slot(s) · {role.skills.join(", ")}</div></div>) : <div className="rounded-[15px] bg-[#f5f7f3] p-3 text-xs text-[#758078]">No open role slots right now.</div>}</div>
          </section>
        </div>
      )}

      <RoomPanel projectId={project.id} enabled={isRoom} />
    </main>
  );
}

function DbNotice() {
  return <main className="surface mx-auto max-w-xl rounded-[26px] p-8 text-center"><h1 className="text-xl font-semibold">Connect Neon to load this project room.</h1><p className="mt-2 text-sm text-[#6c766e]">Live external discovery works independently; persistent rooms require DATABASE_URL.</p></main>;
}
