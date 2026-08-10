import { ArrowLeft, ArrowRight, Building2, FolderKanban } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { portalCompanies } from "@/lib/companyData";

export default function CompanyDashboard() {
  const { companyId } = useParams();
  const company = portalCompanies.find((item) => item.id === companyId);

  if (!company) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl font-semibold text-slate-900">Company not found</h1>
            <p className="mt-2 text-sm text-slate-500">Choose a company from the master portal.</p>
            <Button asChild className="mt-6 bg-[#273C70] hover:bg-[#273C70]/90">
              <Link to="/">Back to Master Portal</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Master Portal
        </Link>

        <section className="rounded-3xl p-6 text-white shadow-xl sm:p-10" style={{ background: `linear-gradient(135deg, ${company.accent}, #0f172a)` }}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">Company Dashboard</Badge>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">{company.name}</h1>
              <p className="mt-3 text-sm text-white/75 sm:text-base">{company.description}</p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
              <Building2 className="h-8 w-8" />
            </div>
          </div>
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: company.softAccent, color: company.accent }}>
                <FolderKanban className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-slate-900">Projects and operations</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Open the project workspace for {company.name} and continue managing operational records.</p>
              <Button asChild className="mt-6 text-white" style={{ backgroundColor: company.accent }}>
                <Link to="/projects">
                  Open Projects
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-slate-900">Business areas</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {company.areas.map((area) => (
                  <div key={area} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    {area}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
