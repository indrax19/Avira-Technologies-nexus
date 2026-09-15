import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Download,
  FileClock,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
  Send,
  Users,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SalarySlip } from "@/components/SalarySlip";
import { useAuth } from "@/context/AuthContext";
import {
  companyProfileAPI,
  type CompanyProfile,
} from "@/integrations/firebase/firestore";
import {
  employeesAPI,
  type EmployeeData,
} from "@/integrations/firebase/employeesAPI";
import {
  calculatePayrollTotals,
  createEmptyDeductions,
  createEmptyEarnings,
  DEDUCTION_FIELDS,
  EARNING_FIELDS,
  formatPayrollCurrency,
  formatPayrollMonth,
  PAYROLL_STATUSES,
  payrollsAPI,
  type Deductions,
  type Earnings,
  type PayrollInput,
  type PayrollRecord,
  type PayrollStatus,
} from "@/integrations/firebase/payrollAPI";
import { downloadSalarySlipPDF } from "@/lib/payrollPDF";

const months = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    new Date(2026, index, 1),
  ),
}));
const years = Array.from(
  { length: 7 },
  (_, index) => new Date().getFullYear() - 3 + index,
);
const inputClass =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#145487] focus:ring-2 focus:ring-[#145487]/15";

interface PayrollForm {
  employeeDocumentId: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeePhotoUrl: string;
  department: string;
  designation: string;
  dateOfJoining: string;
  reportingManager: string;
  employmentType: string;
  bankAccount: string;
  payrollMonth: number;
  payrollYear: number;
  paymentDate: string;
  status: PayrollStatus;
  earnings: Earnings;
  deductions: Deductions;
}

function numeric(value: string | number | undefined) {
  const amount =
    typeof value === "number"
      ? value
      : Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function formFromEmployee(
  employee: EmployeeData,
  month: number,
  year: number,
): PayrollForm {
  return {
    employeeDocumentId: employee.id || "",
    employeeId: employee.employeeId || "",
    employeeName: employee.fullName || "",
    employeeEmail: (employee.officialEmail || employee.accountEmail || "").trim().toLowerCase(),
    employeePhotoUrl: employee.profilePhotoUrl || "",
    department: employee.department || "",
    designation: employee.designation || "",
    dateOfJoining: employee.dateOfJoining || "",
    reportingManager: employee.reportingTo || "",
    employmentType: employee.employmentType || employee.employeeType || "",
    bankAccount: employee.accountNumber || employee.iban || "",
    payrollMonth: month,
    payrollYear: year,
    paymentDate: "",
    status: "Draft",
    earnings: createEmptyEarnings(numeric(employee.basicSalary)),
    deductions: createEmptyDeductions(),
  };
}

function formFromPayroll(payroll: PayrollRecord): PayrollForm {
  return {
    employeeDocumentId: payroll.employeeDocumentId,
    employeeId: payroll.employeeId,
    employeeName: payroll.employeeName,
    employeeEmail: payroll.employeeEmail,
    employeePhotoUrl: payroll.employeePhotoUrl,
    department: payroll.department,
    designation: payroll.designation,
    dateOfJoining: payroll.dateOfJoining,
    reportingManager: payroll.reportingManager,
    employmentType: payroll.employmentType,
    bankAccount: payroll.bankAccount,
    payrollMonth: payroll.payrollMonth,
    payrollYear: payroll.payrollYear,
    paymentDate: payroll.paymentDate,
    status: payroll.status,
    earnings: payroll.earnings,
    deductions: payroll.deductions,
  };
}

function toInput(form: PayrollForm): PayrollInput {
  return {
    ...form,
    earnings: form.earnings,
    deductions: form.deductions,
  };
}

function statusClass(status: PayrollStatus) {
  const classes: Record<PayrollStatus, string> = {
    Draft: "border-slate-200 bg-slate-100 text-slate-700",
    Processing: "border-blue-200 bg-blue-50 text-blue-700",
    Approved: "border-violet-200 bg-violet-50 text-violet-700",
    Paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return classes[status];
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-PK", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
  tone: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 truncate text-lg font-bold tracking-tight text-slate-900">
          {value}
        </p>
      </div>
    </div>
  );
}

function PayrollEditor({
  open,
  payroll,
  employees,
  month,
  year,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  payroll: PayrollRecord | null;
  employees: EmployeeData[];
  month: number;
  year: number;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { appUser } = useAuth();
  const [form, setForm] = useState<PayrollForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (payroll) {
      setForm(formFromPayroll(payroll));
      return;
    }
    const firstEmployee =
      employees.find((employee) => employee.employmentStatus === "Active") ||
      employees[0];
    setForm(
      firstEmployee ? formFromEmployee(firstEmployee, month, year) : null,
    );
  }, [open, payroll, employees, month, year]);

  const totals = useMemo(
    () =>
      form ? calculatePayrollTotals(form.earnings, form.deductions) : null,
    [form],
  );
  const selectEmployee = (documentId: string) => {
    const employee = employees.find((item) => item.id === documentId);
    if (employee) setForm(formFromEmployee(employee, month, year));
  };
  const setComponent = (
    kind: "earnings" | "deductions",
    key: string,
    value: string,
  ) => {
    setForm((current) =>
      current
        ? { ...current, [kind]: { ...current[kind], [key]: numeric(value) } }
        : current,
    );
  };
  const setValue = <K extends keyof PayrollForm>(
    key: K,
    value: PayrollForm[K],
  ) => setForm((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    if (!form) {
      toast.error("Add an active employee before creating payroll.");
      return;
    }
    if (!form.employeeEmail) {
      toast.error(
        "This employee needs an official email before payroll can be made available securely.",
      );
      return;
    }
    setSaving(true);
    try {
      if (payroll)
        await payrollsAPI.update(
          payroll.id,
          toInput(form),
          appUser?.fullName || "Administrator",
        );
      else
        await payrollsAPI.create(
          toInput(form),
          appUser?.fullName || "Administrator",
        );
      toast.success(payroll ? "Payroll updated." : "Payroll created.");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save payroll.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-6xl overflow-y-auto p-0">
        <div className="bg-gradient-to-r from-[#05264d] via-[#0a5575] to-[#062b53] px-5 py-5 text-white sm:px-7">
          <DialogHeader>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100">
              Payroll workspace
            </p>
            <DialogTitle className="mt-1 text-2xl text-white">
              {payroll ? "Edit monthly payroll" : "Create monthly payroll"}
            </DialogTitle>
            <DialogDescription className="text-cyan-50">
              Enter salary components once; totals and the linked salary slip
              update automatically.
            </DialogDescription>
          </DialogHeader>
        </div>
        {form ? (
          <div className="space-y-5 bg-slate-50 p-4 sm:p-6">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-[#145487]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Payroll & employee
                </h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs font-semibold text-slate-700">
                  Employee
                  <select
                    disabled={Boolean(payroll)}
                    value={form.employeeDocumentId}
                    onChange={(event) => selectEmployee(event.target.value)}
                    className={`${inputClass} mt-1 disabled:bg-slate-100`}
                  >
                    {employees.length === 0 && (
                      <option value="">No employees available</option>
                    )}
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName} · {employee.employeeId}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Payroll month
                  <select
                    disabled={Boolean(payroll)}
                    value={form.payrollMonth}
                    onChange={(event) =>
                      setValue("payrollMonth", Number(event.target.value))
                    }
                    className={`${inputClass} mt-1 disabled:bg-slate-100`}
                  >
                    {months.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Payroll year
                  <select
                    disabled={Boolean(payroll)}
                    value={form.payrollYear}
                    onChange={(event) =>
                      setValue("payrollYear", Number(event.target.value))
                    }
                    className={`${inputClass} mt-1 disabled:bg-slate-100`}
                  >
                    {years.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Payment status
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setValue("status", event.target.value as PayrollStatus)
                    }
                    className={`${inputClass} mt-1`}
                  >
                    {PAYROLL_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Payment date
                  <input
                    type="date"
                    value={form.paymentDate}
                    onChange={(event) =>
                      setValue("paymentDate", event.target.value)
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <p className="text-slate-500">Department</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {form.department || "Not provided"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <p className="text-slate-500">Designation</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {form.designation || "Not provided"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <p className="text-slate-500">Employee email</p>
                  <p className="mt-1 truncate font-semibold text-slate-800">
                    {form.employeeEmail || "Required for self-service"}
                  </p>
                </div>
              </div>
            </section>
            <section className="grid gap-5 xl:grid-cols-2">
              <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white">
                <div className="flex items-center justify-between bg-emerald-50 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-bold text-emerald-900">
                      Earnings
                    </h3>
                    <p className="text-[11px] text-emerald-700">
                      All salary components are editable.
                    </p>
                  </div>
                  <p className="text-sm font-bold text-emerald-800">
                    {formatPayrollCurrency(totals?.totalEarnings || 0)}
                  </p>
                </div>
                <div className="grid gap-x-4 gap-y-3 p-4 sm:grid-cols-2">
                  {EARNING_FIELDS.map((field) => (
                    <label
                      className="text-xs font-medium text-slate-700"
                      key={field.key}
                    >
                      {field.label}
                      <input
                        min="0"
                        step="1"
                        type="number"
                        value={form.earnings[field.key] || ""}
                        onChange={(event) =>
                          setComponent(
                            "earnings",
                            field.key,
                            event.target.value,
                          )
                        }
                        className={`${inputClass} mt-1`}
                        placeholder="0"
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-rose-200 bg-white">
                <div className="flex items-center justify-between bg-rose-50 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-bold text-rose-900">
                      Deductions
                    </h3>
                    <p className="text-[11px] text-rose-700">
                      Deductions reduce the net pay in real time.
                    </p>
                  </div>
                  <p className="text-sm font-bold text-rose-800">
                    {formatPayrollCurrency(totals?.totalDeductions || 0)}
                  </p>
                </div>
                <div className="grid gap-x-4 gap-y-3 p-4 sm:grid-cols-2">
                  {DEDUCTION_FIELDS.map((field) => (
                    <label
                      className="text-xs font-medium text-slate-700"
                      key={field.key}
                    >
                      {field.label}
                      <input
                        min="0"
                        step="1"
                        type="number"
                        value={form.deductions[field.key] || ""}
                        onChange={(event) =>
                          setComponent(
                            "deductions",
                            field.key,
                            event.target.value,
                          )
                        }
                        className={`${inputClass} mt-1`}
                        placeholder="0"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </section>
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                  Gross salary
                </p>
                <p className="mt-1 text-lg font-bold text-blue-950">
                  {formatPayrollCurrency(totals?.grossSalary || 0)}
                </p>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                  Total deductions
                </p>
                <p className="mt-1 text-lg font-bold text-rose-950">
                  {formatPayrollCurrency(totals?.totalDeductions || 0)}
                </p>
              </div>
              <div className="rounded-xl bg-gradient-to-r from-[#06264d] to-[#087180] p-4 text-white">
                <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-100">
                  Net salary
                </p>
                <p className="mt-1 text-lg font-bold">
                  {formatPayrollCurrency(totals?.netSalary || 0)}
                </p>
              </div>
            </section>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={save}
                disabled={saving}
                className="bg-[#13834d] hover:bg-[#0d6c3e]"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {payroll ? "Save payroll" : "Create payroll"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500">
            Add an employee before creating payroll.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PayrollTable({
  records,
  selectedIds,
  onToggle,
  onEdit,
  onView,
  onDownload,
  canManage,
}: {
  records: PayrollRecord[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (record: PayrollRecord) => void;
  onView: (record: PayrollRecord) => void;
  onDownload: (record: PayrollRecord) => void;
  canManage: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1590px] w-full text-left text-xs">
        <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="w-10 px-3 py-3">
              <span className="sr-only">Select payroll</span>
            </th>
            <th className="px-3 py-3">Employee</th>
            <th className="px-3 py-3">Department</th>
            <th className="px-3 py-3">Designation</th>
            <th className="px-3 py-3 text-right">Basic</th>
            <th className="px-3 py-3 text-right">Allowances</th>
            <th className="px-3 py-3 text-right">Overtime</th>
            <th className="px-3 py-3 text-right">Bonus / Incentive</th>
            <th className="px-3 py-3 text-right">Gross</th>
            <th className="px-3 py-3 text-right">Deductions</th>
            <th className="px-3 py-3 text-right">Net salary</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Payment date</th>
            <th className="px-3 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records.map((record) => {
            const allowances =
              record.totalEarnings -
              record.earnings.basic -
              record.earnings.overtime -
              record.earnings.bonus -
              record.earnings.performanceIncentive -
              record.earnings.commission;
            const bonusIncentive =
              record.earnings.bonus +
              record.earnings.performanceIncentive +
              record.earnings.commission;
            return (
              <tr
                className="bg-white transition hover:bg-slate-50"
                key={record.id}
              >
                <td className="px-3 py-3">
                  <input
                    aria-label={`Select ${record.employeeName}`}
                    type="checkbox"
                    checked={selectedIds.has(record.id)}
                    onChange={() => onToggle(record.id)}
                    disabled={!canManage}
                    className="h-4 w-4 rounded border-slate-300 text-[#145487] disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    {record.employeePhotoUrl ? (
                      <img
                        src={record.employeePhotoUrl}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-700">
                        {record.employeeName.slice(0, 1)}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-slate-900">
                        {record.employeeName}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {record.employeeId}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {record.department || "—"}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {record.designation || "—"}
                </td>
                <td className="px-3 py-3 text-right font-medium text-slate-700">
                  {formatPayrollCurrency(record.earnings.basic)}
                </td>
                <td className="px-3 py-3 text-right font-medium text-slate-700">
                  {formatPayrollCurrency(allowances)}
                </td>
                <td className="px-3 py-3 text-right font-medium text-slate-700">
                  {formatPayrollCurrency(record.earnings.overtime)}
                </td>
                <td className="px-3 py-3 text-right font-medium text-slate-700">
                  {formatPayrollCurrency(bonusIncentive)}
                </td>
                <td className="px-3 py-3 text-right font-bold text-slate-900">
                  {formatPayrollCurrency(record.grossSalary)}
                </td>
                <td className="px-3 py-3 text-right font-medium text-rose-700">
                  {formatPayrollCurrency(record.totalDeductions)}
                </td>
                <td className="px-3 py-3 text-right font-bold text-emerald-700">
                  {formatPayrollCurrency(record.netSalary)}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold ${statusClass(record.status)}`}
                  >
                    {record.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {formatDate(record.paymentDate)}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onView(record)}
                      className="rounded p-1.5 text-[#145487] hover:bg-blue-50"
                      title="View salary slip"
                      aria-label={`View ${record.employeeName} salary slip`}
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                    {canManage && (
                      <button
                        onClick={() => onEdit(record)}
                        className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                        title="Edit payroll"
                        aria-label={`Edit ${record.employeeName} payroll`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onDownload(record)}
                      className="rounded p-1.5 text-emerald-700 hover:bg-emerald-50"
                      title="Download PDF"
                      aria-label={`Download ${record.employeeName} salary slip`}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {records.length === 0 && (
            <tr>
              <td colSpan={14} className="px-5 py-14 text-center">
                <FileClock className="mx-auto h-9 w-9 text-slate-300" />
                <p className="mt-3 font-medium text-slate-700">
                  No payroll records match these filters.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Create a payroll to begin monthly salary processing.
                </p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function MonthlyPayroll({
  historyOnly = false,
}: {
  historyOnly?: boolean;
}) {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const canManage = appUser?.role === "admin";
  const userEmail = appUser?.email?.trim().toLowerCase() || "";
  const [searchParams] = useSearchParams();
  const today = new Date();
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<PayrollRecord | null>(
    null,
  );
  const [viewingPayroll, setViewingPayroll] = useState<PayrollRecord | null>(
    null,
  );
  const [month, setMonth] = useState(
    Number(searchParams.get("month")) || today.getMonth() + 1,
  );
  const [year, setYear] = useState(
    Number(searchParams.get("year")) || today.getFullYear(),
  );
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [designation, setDesignation] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updatingStatus, setUpdatingStatus] = useState<PayrollStatus | null>(
    null,
  );
  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.employmentStatus !== "Inactive"),
    [employees],
  );
  const inactiveEmployeeKeys = useMemo(
    () => new Set(
      employees
        .filter((employee) => employee.employmentStatus === "Inactive")
        .flatMap((employee) => [employee.id, employee.employeeId])
        .filter((value): value is string => Boolean(value)),
    ),
    [employees],
  );

  useEffect(() => {
    const stopEmployees = employeesAPI.subscribeAll(setEmployees, (error) =>
      toast.error(error.message || "Unable to load employees."),
    );
    const stopPayrolls = canManage
      ? payrollsAPI.subscribeAll(
          (items) => {
            setRecords(items);
            setLoading(false);
          },
          (error) => {
            setLoading(false);
            toast.error(error.message || "Unable to load payroll records.");
          },
        )
      : payrollsAPI.subscribeForEmployee(
          userEmail,
          (items) => {
        setRecords(items);
        setLoading(false);
          },
          (error) => {
            setLoading(false);
            toast.error(error.message || "Unable to load payroll records.");
          },
        );
    companyProfileAPI
      .get()
      .then(setCompanyProfile)
      .catch(() => undefined);
    return () => {
      stopEmployees();
      stopPayrolls();
    };
  }, [canManage, userEmail]);

  useEffect(() => {
    if (!canManage || loading || !activeEmployees.length) return;
    const missingEmployees = activeEmployees.filter(
      (employee) =>
        employee.employeeId &&
        !records.some(
          (record) =>
            record.employeeId === employee.employeeId &&
            record.payrollMonth === month &&
            record.payrollYear === year,
        ),
    );
    if (!missingEmployees.length) return;

    const createMissingPayrolls = async () => {
      await Promise.allSettled(
        missingEmployees.map((employee) => {
          const earnings = createEmptyEarnings(numeric(employee.basicSalary));
          earnings.other = numeric(employee.allowances);
          const deductions = createEmptyDeductions();
          deductions.other = numeric(employee.deductions);
          return payrollsAPI.create(
            {
              employeeDocumentId: employee.id || "",
              employeeId: employee.employeeId,
              employeeName: employee.fullName || "",
              employeeEmail: (employee.officialEmail || employee.accountEmail || "").trim().toLowerCase(),
              employeePhotoUrl: employee.profilePhotoUrl || "",
              department: employee.department || "",
              designation: employee.designation || "",
              dateOfJoining: employee.dateOfJoining || "",
              reportingManager: employee.reportingTo || "",
              employmentType: employee.employmentType || employee.employeeType || "",
              bankAccount: employee.accountNumber || employee.iban || "",
              payrollMonth: month,
              payrollYear: year,
              paymentDate: "",
              status: "Draft",
              earnings,
              deductions,
            },
            appUser?.fullName || "Administrator",
          );
        }),
      );
    };
    void createMissingPayrolls();
  }, [activeEmployees, appUser?.fullName, canManage, loading, month, records, year]);

  const departments = useMemo(
    () =>
      Array.from(
        new Set(activeEmployees.map((item) => item.department).filter(Boolean)),
      ).sort(),
    [activeEmployees],
  );
  const designations = useMemo(
    () =>
      Array.from(
        new Set(activeEmployees.map((item) => item.designation).filter(Boolean)),
      ).sort(),
    [activeEmployees],
  );
  const filteredRecords = useMemo(
    () =>
      records
        .filter(
          (record) =>
            !inactiveEmployeeKeys.has(record.employeeDocumentId) &&
            !inactiveEmployeeKeys.has(record.employeeId) &&
            record.payrollMonth === month &&
            record.payrollYear === year &&
            (department === "all" || record.department === department) &&
            (designation === "all" || record.designation === designation) &&
            (status === "all" || record.status === status) &&
            [
              record.employeeName,
              record.employeeId,
              record.department,
              record.designation,
            ].some((value) =>
              value.toLowerCase().includes(search.toLowerCase()),
            ),
        )
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
    [inactiveEmployeeKeys, records, month, year, department, designation, status, search],
  );
  const summary = useMemo(
    () => ({
      totalEmployees: canManage
        ? employees.filter((item) => item.employmentStatus === "Active").length
        : filteredRecords.length,
      processed: filteredRecords.filter((item) =>
        ["Approved", "Paid"].includes(item.status),
      ).length,
      pending: filteredRecords.filter((item) =>
        ["Draft", "Processing"].includes(item.status),
      ).length,
      gross: filteredRecords.reduce((sum, item) => sum + item.grossSalary, 0),
      deductions: filteredRecords.reduce(
        (sum, item) => sum + item.totalDeductions,
        0,
      ),
      net: filteredRecords.reduce((sum, item) => sum + item.netSalary, 0),
    }),
    [employees, filteredRecords, canManage],
  );
  const selectedRecords = filteredRecords.filter((record) =>
    selectedIds.has(record.id),
  );

  const updateStatus = async (nextStatus: PayrollStatus) => {
    if (!canManage) return;
    const targets = selectedRecords.length
      ? selectedRecords
      : filteredRecords.filter((record) =>
          nextStatus === "Processing"
            ? record.status === "Draft"
            : record.status === "Processing",
        );
    if (!targets.length) {
      toast.error(
        nextStatus === "Processing"
          ? "Select draft payrolls to process."
          : "Select processing payrolls to approve.",
      );
      return;
    }
    setUpdatingStatus(nextStatus);
    try {
      await payrollsAPI.updateStatuses(
        targets,
        nextStatus,
        appUser?.fullName || "Administrator",
      );
      setSelectedIds(new Set());
      toast.success(
        `${targets.length} payroll record${targets.length === 1 ? "" : "s"} marked ${nextStatus.toLowerCase()}.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update payroll status.",
      );
    } finally {
      setUpdatingStatus(null);
    }
  };

  const download = async (record: PayrollRecord) => {
    try {
      await downloadSalarySlipPDF(record, companyProfile);
      toast.success("Salary slip PDF downloaded.");
    } catch {
      toast.error("Unable to generate salary slip PDF.");
    }
  };

  const exportRecords = () => {
    if (!filteredRecords.length) {
      toast.error("There are no payroll records to export.");
      return;
    }
    const rows = [
      [
        "Employee Name",
        "Employee ID",
        "Department",
        "Designation",
        "Basic Salary",
        "Allowances",
        "Overtime",
        "Bonus / Incentive",
        "Gross Salary",
        "Total Deductions",
        "Net Salary",
        "Status",
        "Payment Date",
      ],
      ...filteredRecords.map((record) => [
        record.employeeName,
        record.employeeId,
        record.department,
        record.designation,
        record.earnings.basic,
        record.totalEarnings -
          record.earnings.basic -
          record.earnings.overtime -
          record.earnings.bonus -
          record.earnings.performanceIncentive -
          record.earnings.commission,
        record.earnings.overtime,
        record.earnings.bonus +
          record.earnings.performanceIncentive +
          record.earnings.commission,
        record.grossSalary,
        record.totalDeductions,
        record.netSalary,
        record.status,
        record.paymentDate,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    link.download = `MonthlyPayroll_${formatPayrollMonth(month, year).replace(" ", "_")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const historyGroups = useMemo(
    () =>
      Object.values(
        records.reduce<
          Record<
            string,
            { month: number; year: number; records: PayrollRecord[] }
          >
        >((groups, record) => {
          const key = `${record.payrollYear}-${record.payrollMonth}`;
          (groups[key] ||= {
            month: record.payrollMonth,
            year: record.payrollYear,
            records: [],
          }).records.push(record);
          return groups;
        }, {}),
      ).sort((a, b) => b.year - a.year || b.month - a.month),
    [records],
  );

  if (historyOnly)
    return (
      <main className="min-h-full bg-[#f4f8fc] p-1 text-slate-800 sm:p-3">
        <div className="mx-auto max-w-6xl space-y-5">
          <header className="rounded-2xl bg-gradient-to-r from-[#041d3b] via-[#075a70] to-[#063b63] px-5 py-6 text-white shadow-lg sm:px-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100">
                  Workforce & HR
                </p>
                <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
                  Payroll History
                </h1>
                <p className="mt-1 text-sm text-cyan-50">
                  Review processed monthly payroll periods and totals.
                </p>
              </div>
              <Button
                onClick={() => navigate("/monthly-payroll")}
                className="bg-white/15 text-white hover:bg-white/25"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
                Monthly Payroll
              </Button>
            </div>
          </header>
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-bold text-slate-900">Previous payrolls</h2>
              <p className="mt-1 text-sm text-slate-500">
                Each period summarizes the payroll currently stored for its
                employees.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {historyGroups.map((group) => {
                const totalNet = group.records.reduce(
                  (sum, item) => sum + item.netSalary,
                  0,
                );
                const groupStatus: PayrollStatus = group.records.every(
                  (item) => item.status === "Paid",
                )
                  ? "Paid"
                  : group.records.every((item) =>
                        ["Approved", "Paid"].includes(item.status),
                      )
                    ? "Approved"
                    : group.records.some((item) => item.status === "Processing")
                      ? "Processing"
                      : "Draft";
                return (
                  <div
                    key={`${group.year}-${group.month}`}
                    className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900">
                          {formatPayrollMonth(group.month, group.year)}
                        </h3>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass(groupStatus)}`}
                        >
                          {groupStatus}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Employees: {group.records.length}{" "}
                        <span className="mx-2">·</span> Total payroll:{" "}
                        <span className="font-semibold text-slate-700">
                          {formatPayrollCurrency(totalNet)}
                        </span>
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() =>
                        navigate(
                          `/monthly-payroll?month=${group.month}&year=${group.year}`,
                        )
                      }
                    >
                      View Payroll <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              {historyGroups.length === 0 && (
                <div className="px-5 py-16 text-center text-sm text-slate-500">
                  No payroll history yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    );

  return (
    <main className="min-h-full bg-[#f4f8fc] p-1 text-slate-800 sm:p-3">
      <div className="mx-auto max-w-[1800px] space-y-4">
        <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#041d3b] via-[#075a70] to-[#063b63] px-5 py-6 text-white shadow-lg sm:px-7">
          <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100">
                Workforce & HR / Salary Operations
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                Monthly Payroll
              </h1>
              <p className="mt-1 text-sm text-cyan-50">
                {canManage
                  ? "Create, process, approve, and track monthly employee compensation."
                  : "View and download your monthly salary slips."}
              </p>
            </div>
            {canManage && (
            <div className="flex flex-wrap gap-2">
              {canManage && (
                <Button
                  onClick={() => {
                    setEditingPayroll(null);
                    setEditorOpen(true);
                  }}
                  className="bg-[#13834d] hover:bg-[#0d6c3e]"
                >
                  <Plus className="h-4 w-4" />
                  Create Payroll
                </Button>
              )}
              {canManage && (
                <Button
                  disabled={updatingStatus !== null}
                  onClick={() => updateStatus("Processing")}
                  className="bg-white/15 text-white hover:bg-white/25"
                >
                  {updatingStatus === "Processing" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Process
                </Button>
              )}
              {canManage && (
                <Button
                  disabled={updatingStatus !== null}
                  onClick={() => updateStatus("Approved")}
                  className="bg-white/15 text-white hover:bg-white/25"
                >
                  {updatingStatus === "Approved" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BadgeCheck className="h-4 w-4" />
                  )}
                  Approve
                </Button>
              )}
              <Button
                onClick={exportRecords}
                className="bg-white/15 text-white hover:bg-white/25"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export
              </Button>
            </div>
            )}
          </div>
        </header>
        {canManage && <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="text-[11px] font-semibold text-slate-600">
              Payroll month
              <select
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
                className={`${inputClass} mt-1`}
              >
                {months.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Year
              <select
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                className={`${inputClass} mt-1`}
              >
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Department
              <select
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                className={`${inputClass} mt-1`}
              >
                <option value="all">All departments</option>
                {departments.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Designation
              <select
                value={designation}
                onChange={(event) => setDesignation(event.target.value)}
                className={`${inputClass} mt-1`}
              >
                <option value="all">All designations</option>
                {designations.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Payroll status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={`${inputClass} mt-1`}
              >
                <option value="all">All statuses</option>
                {PAYROLL_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Search employee
              <div className="relative mt-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className={`${inputClass} pl-9`}
                  placeholder="Name or employee ID"
                />
              </div>
            </label>
          </div>
        </section>}
        {!canManage && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[11px] font-semibold text-slate-600">
                Payroll month
                <select
                  value={month}
                  onChange={(event) => setMonth(Number(event.target.value))}
                  className={`${inputClass} mt-1`}
                >
                  {months.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] font-semibold text-slate-600">
                Year
                <select
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                  className={`${inputClass} mt-1`}
                >
                  {years.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        )}
        {canManage && <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryCard
            label="Total employees"
            value={summary.totalEmployees}
            icon={Users}
            tone="bg-blue-50 text-blue-700"
          />
          <SummaryCard
            label="Processed payroll"
            value={summary.processed}
            icon={CheckCircle2}
            tone="bg-emerald-50 text-emerald-700"
          />
          <SummaryCard
            label="Pending payroll"
            value={summary.pending}
            icon={FileClock}
            tone="bg-amber-50 text-amber-700"
          />
          <SummaryCard
            label="Gross salary"
            value={formatPayrollCurrency(summary.gross)}
            icon={WalletCards}
            tone="bg-indigo-50 text-indigo-700"
          />
          <SummaryCard
            label="Deductions"
            value={formatPayrollCurrency(summary.deductions)}
            icon={FileText}
            tone="bg-rose-50 text-rose-700"
          />
          <SummaryCard
            label="Net payroll"
            value={formatPayrollCurrency(summary.net)}
            icon={CalendarDays}
            tone="bg-teal-50 text-teal-700"
          />
        </section>}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">
                {formatPayrollMonth(month, year)} payroll
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredRecords.length} record
                {filteredRecords.length === 1 ? "" : "s"} shown
                {selectedIds.size ? ` · ${selectedIds.size} selected` : ""}
              </p>
            </div>
            {canManage && selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs font-semibold text-[#145487] hover:underline"
              >
                Clear selection
              </button>
            )}
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading payroll records...
            </div>
          ) : (
            <PayrollTable
              records={filteredRecords}
              selectedIds={selectedIds}
              onToggle={(id) =>
                setSelectedIds((current) => {
                  const next = new Set(current);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onEdit={(record) => {
                setEditingPayroll(record);
                setEditorOpen(true);
              }}
              onView={setViewingPayroll}
              onDownload={download}
              canManage={canManage}
            />
          )}
        </section>
      </div>
      <PayrollEditor
        open={editorOpen}
        payroll={editingPayroll}
        employees={activeEmployees}
        month={month}
        year={year}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditingPayroll(null);
        }}
        onSaved={() => undefined}
      />
      <Dialog
        open={Boolean(viewingPayroll)}
        onOpenChange={(open) => !open && setViewingPayroll(null)}
      >
        <DialogContent className="max-h-[95vh] max-w-6xl overflow-y-auto bg-slate-100 p-3 sm:p-6">
          {viewingPayroll && (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>Salary slip</DialogTitle>
              </DialogHeader>
              <div className="mb-3 flex justify-end">
                <Link
                  to={`/salary-slip/${viewingPayroll.id}`}
                  className="text-xs font-semibold text-[#145487] hover:underline"
                >
                  Open full salary slip
                </Link>
              </div>
              <SalarySlip
                payroll={viewingPayroll}
                companyProfile={companyProfile}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
