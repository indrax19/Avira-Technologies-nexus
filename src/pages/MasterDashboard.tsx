import { ArrowRight, Building2, ChevronRight, Network, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { portalCompanies } from "@/lib/companyData";

export default function MasterDashboard() {
  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-[#273C70] to-[#405b9a] p-6 text-white shadow-xl sm:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">
                <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                Master Portal
              </Badge>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">Business Group Dashboard</h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-blue-100 sm:text-base">
                Select a company to open its workspace and manage the services, projects, and operations for that business.
              </p>
            </div>
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/20 bg-white/10 shadow-inner">
              <Network className="h-10 w-10 text-white" />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Choose a company</h2>
              <p className="text-sm text-slate-500">Open the dashboard for the business you want to manage.</p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {portalCompanies.map((company) => (
              <Link key={company.id} to={`/companies/${company.id}`} className="group block">
                <Card className="h-full overflow-hidden border-slate-200 transition-all duration-200 group-hover:-translate-y-1 group-hover:border-slate-300 group-hover:shadow-xl">
                  <div className="h-2" style={{ backgroundColor: company.accent }} />
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: company.softAccent, color: company.accent }}>
                        <Building2 className="h-6 w-6" />
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-slate-600" />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold text-slate-900">{company.name}</h3>
                    <p className="mt-2 min-h-10 text-sm leading-6 text-slate-500">{company.description}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {company.areas.map((area) => (
                        <span key={area} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                          {area}
                        </span>
                      ))}
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-sm font-semibold" style={{ color: company.accent }}>
                      Open company dashboard
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
