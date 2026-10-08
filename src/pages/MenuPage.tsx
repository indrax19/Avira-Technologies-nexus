import { ArrowLeft, Layers3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type MenuPageProps = {
  title: string;
  description: string;
  projectName?: string;
  backPath?: string;
};

export default function MenuPage({ title, description, projectName, backPath }: MenuPageProps) {
  return (
    <main className="min-h-full w-full bg-[#f4f8fc] text-slate-800">
      <div className="w-full">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#061d3a] via-[#0b4f78] to-[#0b7890] px-5 py-6 text-white shadow-lg sm:px-8 sm:py-8">
          <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-cyan-300/10 blur-2xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              {backPath && (
                <Button asChild variant="outline" size="sm" className="mb-6 border-blue-200/60 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                  <Link to={backPath}><ArrowLeft className="mr-2 h-4 w-4" />Back to projects</Link>
                </Button>
              )}
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100">Subscription &amp; Renewals</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
                {projectName && <span className="rounded-full border border-cyan-100/30 bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-50">{projectName}</span>}
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50">{description}</p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-inner sm:h-16 sm:w-16">
              {title === "SSL" ? <ShieldCheck className="h-8 w-8 text-cyan-100" /> : <Layers3 className="h-8 w-8 text-cyan-100" />}
            </div>
          </div>
        </section>
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Workspace status</p>
            <p className="mt-2 text-2xl font-bold tracking-wide text-[#145487]">WORKING</p>
            <p className="mt-2 max-w-md text-sm text-slate-500">This workspace is ready for {title.toLowerCase()} records and renewal management.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
