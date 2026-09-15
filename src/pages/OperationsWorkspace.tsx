import { ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type OperationsWorkspaceProps = {
  title: string;
  description: string;
};

export default function OperationsWorkspace({ title, description }: OperationsWorkspaceProps) {
  return (
    <div className="min-h-full bg-[#f4f8fc] p-3 text-slate-800 sm:p-5 lg:p-7">
      <div className="mx-auto max-w-[1800px] space-y-4">
        <div className="flex flex-col gap-4 rounded-md bg-gradient-to-r from-[#092f5b] via-[#0d477f] to-[#092f5b] px-4 py-4 text-white shadow-md sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Project &amp; Operations</div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-blue-100">{description}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/15 text-white shadow-sm"><ClipboardList className="h-5 w-5" /></div>
        </div>
        <Card className="border-slate-200 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <CardHeader><CardTitle className="text-[#145487]">{title} workspace</CardTitle><p className="text-sm text-slate-500">Manage your {title.toLowerCase()} activities from this workspace.</p></CardHeader>
          <CardContent><div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-12"><ClipboardList className="mx-auto h-10 w-10 text-blue-500" /><h2 className="mt-4 text-lg font-semibold text-slate-900">Ready to get started</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Your {title.toLowerCase()} workspace is ready for operational records and follow-up.</p></div></CardContent>
        </Card>
      </div>
    </div>
  );
}
