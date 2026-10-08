import { Calculator, ChartNoAxesCombined, ClipboardList, FileSpreadsheet, ReceiptText, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

export type CostingSectionConfig = {
  title: string;
  description: string;
  icon: typeof Calculator;
  metrics: string[];
  guidance: string[];
};

export const costingSections: CostingSectionConfig[] = [
  { title: "General Costing", description: "Set up and review the core cost structure for your business.", icon: Calculator, metrics: ["Cost templates", "Direct costs", "Overhead allocation"], guidance: ["Create consistent cost categories for every project.", "Keep direct and indirect costs visible in one place."] },
  { title: "Tax & GST", description: "Manage tax rates and GST calculations used across costing workflows.", icon: Scale, metrics: ["GST rates", "Taxable items", "Tax summaries"], guidance: ["Maintain current tax rates before preparing a costing.", "Review tax-inclusive and tax-exclusive totals together."] },
  { title: "Project Costing", description: "Build a clear project-level view of estimated and actual costs.", icon: ClipboardList, metrics: ["Project estimates", "Actual spend", "Cost variance"], guidance: ["Compare planned costs with actual project spending.", "Use project costing to keep delivery decisions measurable."] },
  { title: "Labour Costing", description: "Track labour rates, hours, and workforce cost contributions.", icon: FileSpreadsheet, metrics: ["Labour rates", "Logged hours", "Team cost"], guidance: ["Keep role-based rates consistent across project teams.", "Review hours and labour cost before approving estimates."] },
  { title: "Expense Costing", description: "Capture operational expenses and assign them to the right work.", icon: ReceiptText, metrics: ["Expense entries", "Reimbursable costs", "Pending review"], guidance: ["Classify expenses as soon as they are incurred.", "Keep supporting details ready for review and reporting."] },
  { title: "Profitability", description: "Understand margins and profitability across projects and cost areas.", icon: ChartNoAxesCombined, metrics: ["Gross margin", "Revenue vs cost", "Profit trend"], guidance: ["Use current cost data to monitor margin movement.", "Identify profitable and underperforming work early."] },
];

export function CostingSectionPage({ config }: { config: CostingSectionConfig }) {
  const Icon = config.icon;
  return <div className="min-h-full bg-slate-50/70 p-3 sm:p-5 lg:p-8"><div className="mx-auto max-w-[1600px] space-y-5 sm:space-y-7">
    <Breadcrumb><BreadcrumbList><BreadcrumbItem><Link to="/projects" className="transition-colors hover:text-foreground">Project Management</Link></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><span>Costing &amp; Profitability</span></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>{config.title}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
    <Card className="overflow-hidden border-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg"><CardContent className="p-6 md:p-8"><div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div className="space-y-4"><Badge className="border border-white/25 bg-white/15 text-white hover:bg-white/15">Costing &amp; Profitability</Badge><div><h1 className="text-3xl font-bold md:text-4xl">{config.title}</h1><p className="mt-2 max-w-2xl text-sm text-blue-50 md:text-base">{config.description}</p></div></div><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 shadow-inner"><Icon className="h-8 w-8" /></div></div></CardContent></Card>
    <div className="grid gap-4 sm:grid-cols-3">{config.metrics.map((metric) => <Card key={metric} className="border-slate-200 shadow-sm"><CardContent className="flex min-h-24 items-center gap-3 p-5"><div className="rounded-xl bg-blue-100 p-3 text-blue-600"><Icon className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">{metric}</p><p className="mt-1 text-lg font-semibold text-slate-900">Ready to configure</p></div></CardContent></Card>)}</div>
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]"><Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>Overview</CardTitle><p className="text-sm text-slate-500">Your {config.title.toLowerCase()} workspace is ready for your data.</p></CardHeader><CardContent><div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center sm:p-10"><Icon className="mx-auto h-10 w-10 text-blue-500" /><h2 className="mt-4 text-lg font-semibold text-slate-900">Start building your {config.title.toLowerCase()} view</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Add records and configuration here as your costing workflow grows. The layout is responsive across desktop, tablet, and mobile.</p></div></CardContent></Card><Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>Recommended next steps</CardTitle></CardHeader><CardContent><ul className="space-y-4">{config.guidance.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />{item}</li>)}</ul></CardContent></Card></div>
  </div></div>;
}
