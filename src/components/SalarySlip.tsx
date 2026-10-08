import { Building2, CalendarDays, UserRound } from "lucide-react";
import type { CompanyProfile } from "@/integrations/firebase/firestore";
import {
  calculateProratedBasicSalary,
  DEDUCTION_FIELDS,
  EARNING_FIELDS,
  formatPayrollCurrency,
  formatPayrollMonth,
  type PayrollRecord,
} from "@/integrations/firebase/payrollAPI";

interface SalarySlipProps {
  payroll: PayrollRecord;
  companyProfile?: CompanyProfile | null;
}

function formatDate(value: string) {
  if (!value) return "Not paid yet";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-PK", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function displayValue(value: string) {
  return value || "Not provided";
}

function netPayInWords(value: number) {
  const underTwenty = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const spell = (amount: number): string => {
    if (amount < 20) return underTwenty[amount];
    if (amount < 100) return `${tens[Math.floor(amount / 10)]}${amount % 10 ? `-${underTwenty[amount % 10]}` : ""}`;
    if (amount < 1000) return `${underTwenty[Math.floor(amount / 100)]} hundred${amount % 100 ? ` ${spell(amount % 100)}` : ""}`;
    if (amount < 100000) return `${spell(Math.floor(amount / 1000))} thousand${amount % 1000 ? ` ${spell(amount % 1000)}` : ""}`;
    if (amount < 10000000) return `${spell(Math.floor(amount / 100000))} lakh${amount % 100000 ? ` ${spell(amount % 100000)}` : ""}`;
    return `${spell(Math.floor(amount / 10000000))} crore${amount % 10000000 ? ` ${spell(amount % 10000000)}` : ""}`;
  };
  return `${spell(Math.max(0, Math.round(value))).replace(/\b\w/g, (letter) => letter.toUpperCase())} Pakistani Rupees Only`;
}

function amountOrDash(value: number) {
  return value ? formatPayrollCurrency(value) : "—";
}

export function SalarySlip({ payroll, companyProfile }: SalarySlipProps) {
  const companyName = companyProfile?.company_name || "Avira Technologies";
  return (
    <article className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-xl print:max-w-none print:rounded-none print:border-0 print:shadow-none">
      <header className="border-b border-slate-200 bg-gradient-to-r from-[#06264d] via-[#0a5276] to-[#063055] px-5 py-6 text-white sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            {companyProfile?.logo_url ? (
              <img src={companyProfile.logo_url} alt={`${companyName} logo`} className="h-14 w-14 rounded-xl bg-white object-contain p-1.5 shadow" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25"><Building2 className="h-7 w-7" /></div>
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight">{companyName}</h1>
              {companyProfile?.email && <p className="text-xs text-cyan-100">{companyProfile.email}</p>}
            </div>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-left sm:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100">Compensation statement</p>
            <h2 className="mt-1 text-2xl font-bold tracking-wide">SALARY SLIP</h2>
            <p className="mt-1 text-xs text-cyan-50">{payroll.payslipId}</p>
          </div>
        </div>
      </header>

      <div className="space-y-6 p-5 sm:p-8">
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-3">
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Payroll month</p><p className="mt-1 font-semibold text-slate-900">{formatPayrollMonth(payroll.payrollMonth, payroll.payrollYear)}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Payment date</p><p className="mt-1 font-semibold text-slate-900">{formatDate(payroll.paymentDate)}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Payment status</p><p className="mt-1 inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">{payroll.status}</p></div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3"><UserRound className="h-4 w-4 text-[#145487]" /><h3 className="text-sm font-bold text-slate-900">Employee details</h3></div>
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
            {payroll.employeePhotoUrl ? <img src={payroll.employeePhotoUrl} alt={payroll.employeeName} className="h-16 w-16 rounded-xl border border-slate-200 object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-blue-50 text-lg font-bold text-blue-700">{payroll.employeeName.slice(0, 1).toUpperCase()}</div>}
            <div className="grid flex-1 gap-x-7 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Employee name", payroll.employeeName], ["Employee ID", payroll.employeeId], ["Designation", payroll.designation], ["Department", payroll.department],
                ["Date of joining", displayValue(payroll.dateOfJoining)], ["Reporting manager", displayValue(payroll.reportingManager)], ["Employment type", displayValue(payroll.employmentType)], ["Bank account", displayValue(payroll.bankAccount)],
              ].map(([label, value]) => <div key={label}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-800">{value}</p></div>)}
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-emerald-200">
            <div className="flex items-center justify-between bg-emerald-50 px-4 py-3"><h3 className="text-sm font-bold text-emerald-900">EARNINGS</h3><span className="text-xs font-bold text-emerald-700">{formatPayrollCurrency(payroll.totalEarnings)}</span></div>
            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"><span className="text-slate-600">Working Days</span><span className="font-semibold text-slate-900">{payroll.workingDays ?? 30}</span></div>
              {EARNING_FIELDS.map((field) => <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs" key={field.key}><span className="text-slate-600">{field.label}</span><span className="font-semibold text-slate-900">{amountOrDash(field.key === "basic" ? calculateProratedBasicSalary(payroll.earnings?.basic || 0, payroll.workingDays ?? 30) : Number(payroll.earnings?.[field.key]) || 0)}</span></div>)}
            </div>
            <div className="flex items-center justify-between border-t border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900"><span>Total earnings / gross salary</span><span>{formatPayrollCurrency(payroll.grossSalary)}</span></div>
          </div>
          <div className="overflow-hidden rounded-xl border border-rose-200">
            <div className="flex items-center justify-between bg-rose-50 px-4 py-3"><h3 className="text-sm font-bold text-rose-900">DEDUCTIONS</h3><span className="text-xs font-bold text-rose-700">{formatPayrollCurrency(payroll.totalDeductions)}</span></div>
            <div className="divide-y divide-slate-100">
              {DEDUCTION_FIELDS.map((field) => <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs" key={field.key}><span className="text-slate-600">{field.label}</span><span className="font-semibold text-slate-900">{amountOrDash(Number(payroll.deductions?.[field.key]) || 0)}</span></div>)}
            </div>
            <div className="flex items-center justify-between border-t border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-900"><span>Total deductions</span><span>{formatPayrollCurrency(payroll.totalDeductions)}</span></div>
          </div>
        </section>

        <section className="rounded-xl bg-gradient-to-r from-[#06264d] to-[#087180] p-5 text-white shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100">Net pay in words</p><p className="mt-1 text-sm font-medium leading-relaxed text-white">{netPayInWords(payroll.netSalary)}</p></div><div className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 sm:text-right"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100">NET PAY</p><p className="mt-1 text-2xl font-bold">{formatPayrollCurrency(payroll.netSalary)}</p></div></div>
        </section>
      </div>

      <footer className="flex items-center justify-center gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 text-center text-[11px] text-slate-500"><CalendarDays className="h-3.5 w-3.5" />This is a system-generated payslip and does not require a signature.</footer>
    </article>
  );
}
