import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import type { jsPDF as JsPDF } from "jspdf";
import {
  ArrowDown, ArrowLeft, ArrowUp, CalendarDays, Check, ChevronDown, ClipboardList,
  Download, Eye, FileImage, FileText, Filter, Pencil, Plus, Printer, Search, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { dailyWageRequestsAPI, usersAPI, type User } from "@/integrations/firebase";
import { createRequestNumber } from "@/lib/requestNumber";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Status = "Pending" | "Cleared";
type Worker = { worker_name: string; trade_skill: string; contact_no: string; daily_rate: string; no_of_days: string; remarks: string };
type Attachment = { category: string; name: string; size: number; type: string };
type HiringRequest = {
  id: string; request_no: string; requested_by: string; department: string; company: string;
  project_poc: string; customer: string; site_location: string; purpose: string; work_description: string;
  required_from_date: string; required_to_date: string; site_supervisor: string; remarks: string; total_days: number;
  work_type_trade: string; total_persons_required: string; expected_daily_rate: string; nature_of_work: string[];
  nature_other: string; team_members: Worker[]; other_allowance: string; payment_terms: string;
  attachments: Attachment[];
  status: Status; approval_status: "Pending Approval" | "Approved"; approved_by?: string; approved_by_email?: string; approved_at?: string;
  created_by: string; owner_uid: string; owner_email: string; submitted_by: string; submitted_by_email: string; created_at: string; updated_at: string;
};
type Filters = { request_no: string; project_poc: string; customer: string; site_location: string; requested_by: string; department: string; status: string; from_date: string; to_date: string };
type SortKey = "request_no" | "project_poc" | "customer" | "site_location" | "requested_by" | "team_members" | "total_days" | "total_amount" | "status" | "created_at";

const natureOptions = ["POC", "Deployment", "Installation", "Civil Work", "Cabling", "Configuration", "Testing", "Other"];
const companies = ["Avira Technologies", "Avira Technologies (Pvt.) Ltd."];
const projects = ["Nexus Portal", "Field Operations", "POC - Client Support", "Deployment - Lahore"];
const customers = ["ABC Corporation", "Acme Industries", "Internal Project"];
const sites = ["Lahore", "Islamabad", "Karachi", "Head Office"];
const purposes = ["Project Deployment", "Site Installation", "Maintenance", "Testing & Commissioning", "Other"];
const trades = ["Electrician", "Technician", "Helper", "Fiber Optic Technician", "Network Engineer", "Welder", "Mason", "Other"];
const emptyFilters: Filters = { request_no: "", project_poc: "", customer: "", site_location: "", requested_by: "", department: "", status: "", from_date: "", to_date: "" };
const inputClass = "h-9 w-full rounded border border-slate-200 bg-white px-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-600";
const readOnlyClass = "h-9 w-full rounded border border-blue-100 bg-blue-50/70 px-2.5 text-sm font-medium text-slate-700 outline-none";
const formatPKR = (amount: number) => `PKR ${Math.round(amount || 0).toLocaleString("en-PK")}`;
const calcDays = (from: string, to: string) => {
  if (!from || !to) return 0;
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime();
  return end >= start ? Math.floor((end - start) / 86400000) + 1 : 0;
};
const totalDaysFor = (record: HiringRequest) => calcDays(record.required_from_date, record.required_to_date);
const labourCost = (workers: Worker[]) => workers.reduce((sum, worker) => sum + Number(worker.daily_rate || 0) * Number(worker.no_of_days || 0), 0);
const requestTotal = (record: HiringRequest) => labourCost(record.team_members) + Number(record.other_allowance || 0);
const teamSize = (record: HiringRequest) => record.team_members.length;
const formatDate = (value: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const nextRequestNo = () => createRequestNumber("DWH");
const createBlank = (requestedBy: string, requestNo: string): HiringRequest => ({
  id: crypto.randomUUID(), request_no: requestNo, requested_by: requestedBy, department: "", company: "",
  project_poc: "", customer: "", site_location: "", purpose: "", work_description: "", required_from_date: "",
  required_to_date: "", site_supervisor: "", remarks: "", total_days: 0, work_type_trade: "", total_persons_required: "",
  expected_daily_rate: "", nature_of_work: [], nature_other: "", team_members: [], other_allowance: "", payment_terms: "Per Day Payment",
  attachments: [], status: "Pending", approval_status: "Pending Approval", created_by: "", owner_uid: "", owner_email: "", submitted_by: "", submitted_by_email: "", created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
});

function Field({ label, value, onChange, type = "text", placeholder, options, required, disabled, readOnly, error, min, step, wide = false }: {
  label: string; value: string | number; onChange?: (value: string) => void; type?: string; placeholder?: string;
  options?: string[]; required?: boolean; disabled?: boolean; readOnly?: boolean; error?: string; min?: string; step?: string; wide?: boolean;
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <label className={`block min-w-0 ${wide ? "md:col-span-2" : ""}`} htmlFor={id}>
    <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}{required && <span className="ml-1 text-red-600">*</span>}</span>
    {options ? <div className="relative"><input id={id} list={`${id}-options`} className={disabled || readOnly ? readOnlyClass : inputClass} value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder || "Select or search"} disabled={disabled} readOnly={readOnly} required={required} /><datalist id={`${id}-options`}>{options.map((option) => <option key={option} value={option} />)}</datalist><ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" /></div>
      : <input id={id} type={type} min={min} step={step} className={readOnly ? readOnlyClass : inputClass} value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} disabled={disabled} readOnly={readOnly} required={required} />}
    {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
  </label>;
}

function Section({ number, title, description, children, right }: { number: string; title: string; description?: string; children: ReactNode; right?: ReactNode }) {
  return <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 sm:px-4">
      <div className="flex min-w-0 items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">{number}</span><div className="min-w-0"><h2 className="inline-block bg-[#06255d] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white [clip-path:polygon(0_0,calc(100%-10px)_0,100%_100%,0_100%)] sm:text-sm">{title}</h2>{description && <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>}</div></div>{right}
    </div>
    <div className="p-3 sm:p-4">{children}</div>
  </section>;
}

function StatCard({ label, value, accent, icon }: { label: string; value: number; accent: string; icon: ReactNode }) {
  return <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>{icon}</span><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p></div></div>;
}

export default function DailyWageRequestForm() {
  const { appUser, firebaseUser, isAdmin } = useAuth();
  const requestedBy = appUser?.fullName || firebaseUser?.displayName || firebaseUser?.email || "Current User";
  const [users, setUsers] = useState<User[]>([]);
  const [requestedUserId, setRequestedUserId] = useState("");
  const requestedUser = users.find((user) => user.id === requestedUserId) || appUser || null;
  const [records, setRecords] = useState<HiringRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<HiringRequest | null>(null);
  const [formMode, setFormMode] = useState<"new" | "edit" | "view">("new");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [activeFilters, setActiveFilters] = useState<Filters>(emptyFilters);
  const [pageSize, setPageSize] = useState<number | "all">(15);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAscending, setSortAscending] = useState(false);
  const [confirm, setConfirm] = useState<{ type: "clear"; id: string } | { type: "delete"; id: string } | null>(null);
  const [isSearched, setIsSearched] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    usersAPI.getAll().then(setUsers).catch(() => toast.error("Could not load users for request assignment."));
  }, [isAdmin]);

  useEffect(() => {
    if (appUser && !requestedUserId) setRequestedUserId(appUser.id);
  }, [appUser, requestedUserId]);

  useEffect(() => {
    setIsLoading(true);
    setLoadError(false);
    const onError = () => { setIsLoading(false); setLoadError(true); toast.error("Could not load Daily Wage requests. Check Firebase connection and Firestore permissions."); };
    const callback = (nextRecords: HiringRequest[]) => { setRecords(nextRecords); setIsLoading(false); setLoadError(false); };
    return isAdmin
      ? dailyWageRequestsAPI.subscribeAll<HiringRequest>(callback, onError)
      : dailyWageRequestsAPI.subscribeByOwner<HiringRequest>(firebaseUser?.uid || "", callback, onError);
  }, [isAdmin, firebaseUser?.uid]);

  const openNew = async () => {
    if (isLoading || loadError) return;
    try {
      const requestNo = await nextRequestNo();
      setRequestedUserId(appUser?.id || "");
      setForm(createBlank(requestedBy, requestNo));
      setErrors({});
      setFormMode("new");
    } catch (error) {
      toast.error("Could not generate a request number.", { description: error instanceof Error ? error.message : "Please try again." });
    }
  };
  const openRecord = (record: HiringRequest, mode: "edit" | "view") => {
    if (mode === "edit" && !isAdmin && (record.owner_uid || record.created_by) !== firebaseUser?.uid) return;
    setForm(structuredClone(record));
    setErrors({});
    setFormMode(mode);
  };
  const closeForm = () => { setForm(null); setErrors({}); };
  const updateForm = (key: keyof HiringRequest, value: HiringRequest[keyof HiringRequest]) => {
    setForm((current) => current ? { ...current, [key]: value, updated_at: new Date().toISOString() } : current);
    setErrors((current) => ({ ...current, [key]: "" }));
  };
  const totalDays = form ? calcDays(form.required_from_date, form.required_to_date) : 0;
  const totalLabour = form ? labourCost(form.team_members) : 0;

  const validate = () => {
    if (!form) return false;
    const next: Record<string, string> = {};
    ["company", "project_poc", "customer", "site_location", "purpose", "required_from_date", "required_to_date", "work_type_trade"].forEach((key) => {
      if (!String(form[key as keyof HiringRequest] || "").trim()) next[key] = "This field is required.";
    });
    if (form.required_from_date && form.required_to_date && form.required_from_date > form.required_to_date) next.required_to_date = "End date cannot be before the start date.";
    if (!form.total_persons_required || Number(form.total_persons_required) < 1) next.total_persons_required = "Enter at least one person.";
    if (!form.expected_daily_rate || Number(form.expected_daily_rate) <= 0) next.expected_daily_rate = "Enter a valid daily rate.";
    if (!form.nature_of_work.length) next.nature_of_work = "Select at least one nature of work.";
    if (form.nature_of_work.includes("Other") && !form.nature_other.trim()) next.nature_other = "Please describe the work type.";
    if (!form.team_members.length) next.team_members = "Add at least one team member.";
    form.team_members.forEach((worker, index) => {
      if (!worker.worker_name.trim()) next[`worker-${index}-name`] = "Worker name is required.";
      if (!worker.trade_skill.trim()) next[`worker-${index}-trade`] = "Trade / skill is required.";
      if (Number(worker.daily_rate) <= 0) next[`worker-${index}-rate`] = "Enter a valid rate.";
      if (Number(worker.no_of_days) <= 0) next[`worker-${index}-days`] = "Enter at least one day.";
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveRecord = async () => {
    if (!form) return;
    if (isAdmin && formMode === "new" && !requestedUserId) {
      toast.error("Select the user this request is for.");
      return;
    }
    const actorUid = firebaseUser?.uid || appUser?.id || "";
    const saved: HiringRequest = {
      ...form,
      requested_by: isAdmin && formMode === "new" ? requestedUser?.fullName || requestedBy : form.requested_by,
      total_days: totalDays,
      updated_at: new Date().toISOString(),
      created_by: formMode === "new" ? actorUid : form.created_by,
      owner_uid: formMode === "new" ? (isAdmin ? requestedUser?.id : actorUid) || actorUid : form.owner_uid,
      owner_email: formMode === "new" ? (isAdmin ? requestedUser?.email : firebaseUser?.email) || "" : form.owner_email,
      submitted_by: formMode === "new" ? actorUid : form.submitted_by,
      submitted_by_email: formMode === "new" ? firebaseUser?.email || appUser?.email || "" : form.submitted_by_email,
      approval_status: formMode === "new" ? "Pending Approval" : form.approval_status || "Pending Approval",
    };
    setIsSaving(true);
    try {
      if (formMode === "new") await dailyWageRequestsAPI.create(saved);
      else await dailyWageRequestsAPI.update(saved);
      setForm(null);
      setErrors({});
      toast.success(saved.status === "Cleared" ? "Request updated; dues remain cleared" : "Request saved as pending", { description: `Request No. ${saved.request_no}` });
    } catch (error) {
      toast.error("Could not save request to Firebase.", { description: error instanceof Error ? error.message : "Check Firebase connection and Firestore permissions." });
    } finally {
      setIsSaving(false);
    }
  };
  const saveAsPending = async () => {
    if (!validate()) { toast.error("Please complete the required fields before saving."); return; }
    await saveRecord();
  };

  const updateWorker = (index: number, key: keyof Worker, value: string) => {
    if (!form) return;
    setForm((current) => current ? { ...current, team_members: current.team_members.map((worker, row) => row === index ? { ...worker, [key]: value } : worker) } : current);
    setErrors((current) => ({ ...current, [`worker-${index}-name`]: "", [`worker-${index}-trade`]: "", [`worker-${index}-rate`]: "", [`worker-${index}-days`]: "" }));
  };
  const addWorker = () => {
    if (!form) return;
    const worker: Worker = { worker_name: "", trade_skill: "", contact_no: "", daily_rate: "", no_of_days: totalDays ? String(totalDays) : "", remarks: "" };
    updateForm("team_members", [...form.team_members, worker]);
  };
  const toggleNature = (value: string) => {
    if (!form) return;
    updateForm("nature_of_work", form.nature_of_work.includes(value) ? form.nature_of_work.filter((item) => item !== value) : [...form.nature_of_work, value]);
  };
  const uploadAttachment = async (category: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !form) return;
    if (!/(pdf|jpe?g|png)$/i.test(file.name.split(".").pop() || "")) { toast.error("Upload a PDF, JPG, or PNG file."); return; }
    setForm((current) => current ? { ...current, attachments: [...current.attachments.filter((attachment) => attachment.category !== category), { category, name: file.name, size: file.size, type: file.type }] } : current);
  };
  const removeAttachment = (category: string) => updateForm("attachments", form?.attachments.filter((item) => item.category !== category) || []);

  const filteredRecords = useMemo(() => {
    const source = records.filter((record) => {
      const matches = (key: keyof Filters, value: string) => !value || String(record[key as keyof HiringRequest] || "").toLowerCase().includes(value.toLowerCase());
      const from = activeFilters.from_date ? record.required_from_date >= activeFilters.from_date : true;
      const to = activeFilters.to_date ? record.required_from_date <= activeFilters.to_date : true;
      const requestOrCustomerMatches = !activeFilters.request_no || matches("request_no", activeFilters.request_no) || matches("customer", activeFilters.request_no);
      return requestOrCustomerMatches && matches("project_poc", activeFilters.project_poc) && matches("site_location", activeFilters.site_location) && matches("requested_by", activeFilters.requested_by) && matches("department", activeFilters.department) && (!activeFilters.status || record.status === activeFilters.status) && from && to;
    });
    return source.sort((a, b) => {
      const value = (record: HiringRequest): string | number => sortKey === "team_members" ? teamSize(record) : sortKey === "total_days" ? totalDaysFor(record) : sortKey === "total_amount" ? requestTotal(record) : String(record[sortKey] || "").toLowerCase();
      const left = value(a), right = value(b);
      const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right));
      return sortAscending ? result : -result;
    });
  }, [records, activeFilters, sortKey, sortAscending]);
  const pageCount = pageSize === "all" ? 1 : Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedRecords = pageSize === "all" ? filteredRecords : filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstVisible = filteredRecords.length ? (pageSize === "all" ? 1 : (currentPage - 1) * pageSize + 1) : 0;
  const lastVisible = pageSize === "all" ? filteredRecords.length : Math.min(currentPage * pageSize, filteredRecords.length);

  const resetFilters = () => { setFilters(emptyFilters); setActiveFilters(emptyFilters); setIsSearched(false); setPage(1); };
  const toggleSort = (key: SortKey) => { if (sortKey === key) setSortAscending((current) => !current); else { setSortKey(key); setSortAscending(true); } };
  const duplicateRecord = async (record: HiringRequest) => {
    const actorUid = firebaseUser?.uid || appUser?.id || "";
    try {
      const copy = {
        ...structuredClone(record),
        id: crypto.randomUUID(),
        request_no: await nextRequestNo(),
        status: "Pending" as Status,
        approval_status: "Pending Approval" as const,
        created_by: actorUid,
        submitted_by: actorUid,
        submitted_by_email: firebaseUser?.email || appUser?.email || "",
        owner_uid: isAdmin ? record.owner_uid || record.created_by : actorUid,
        owner_email: isAdmin ? record.owner_email : firebaseUser?.email || "",
        approved_by: undefined,
        approved_by_email: undefined,
        approved_at: undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await dailyWageRequestsAPI.create(copy);
      toast.success(`Duplicated as ${copy.request_no}`);
    } catch (error) {
      toast.error("Could not duplicate request to Firebase.", { description: error instanceof Error ? error.message : "Check Firebase connection and Firestore permissions." });
    }
  };
  const createRequestPdf = async (record: HiringRequest, options?: { includeAttachments?: boolean }) => {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const includeAttachments = options?.includeAttachments ?? true;
    const pdf = new jsPDF("p", "mm", "a4");
    const margin = 13;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    const blue: [number, number, number] = [6, 37, 93];
    const red: [number, number, number] = [220, 38, 38];
    const slate: [number, number, number] = [30, 41, 59];
    const border: [number, number, number] = [203, 213, 225];
    const value = (input: string | number | undefined) => String(input ?? "").trim() || "—";
    const lastTableY = () => (pdf as JsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y;
    const formatFileSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
    let y = 18;

    const newPage = () => { pdf.addPage(); y = 16; };
    const ensureSpace = (height: number) => { if (y + height > pageHeight - 20) newPage(); };
    const section = (number: string, title: string) => {
      ensureSpace(22);
      pdf.setFillColor(239, 246, 255);
      pdf.setDrawColor(...border);
      pdf.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, "FD");
      pdf.setFillColor(...red);
      pdf.circle(margin + 5, y + 4, 2.7, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(number, margin + 5, y + 5, { align: "center" });
      pdf.setTextColor(...blue);
      pdf.setFontSize(9.5);
      pdf.text(title.toUpperCase(), margin + 10, y + 5.2);
      y += 10;
    };
    const grid = (rows: Array<[string, string | number | undefined]>, columnsCount: 2 | 3 | 4 = 2) => {
      const itemsPerRow = columnsCount;
      const pairs = Array.from({ length: Math.ceil(rows.length / itemsPerRow) }, (_, rowIndex) => {
        const rowCells: string[] = [];
        for (let colIndex = 0; colIndex < itemsPerRow; colIndex += 1) {
          const item = rows[rowIndex * itemsPerRow + colIndex];
          rowCells.push(item ? item[0] : "");
          rowCells.push(item ? value(item[1]) : "");
        }
        return rowCells;
      });

      const columnStyles: Record<number, { cellWidth: number; fontStyle?: "bold"; fillColor?: [number, number, number] }> = {};
      if (itemsPerRow === 3) {
        for (let i = 0; i < 3; i += 1) {
          columnStyles[i * 2] = { cellWidth: 26, fontStyle: "bold", fillColor: [248, 250, 252] };
          columnStyles[i * 2 + 1] = { cellWidth: 35.33 };
        }
      } else if (itemsPerRow === 4) {
        for (let i = 0; i < 4; i += 1) {
          columnStyles[i * 2] = { cellWidth: 20, fontStyle: "bold", fillColor: [248, 250, 252] };
          columnStyles[i * 2 + 1] = { cellWidth: 26 };
        }
      } else {
        columnStyles[0] = { cellWidth: 29, fontStyle: "bold", fillColor: [248, 250, 252] };
        columnStyles[1] = { cellWidth: 61 };
        columnStyles[2] = { cellWidth: 29, fontStyle: "bold", fillColor: [248, 250, 252] };
        columnStyles[3] = { cellWidth: 61 };
      }

      autoTable(pdf, {
        startY: y,
        margin: { left: margin, right: margin, bottom: 20 },
        theme: "grid",
        body: pairs,
        columnStyles,
        bodyStyles: { fontSize: itemsPerRow === 4 ? 7.2 : 7.8, cellPadding: itemsPerRow === 4 ? 1.8 : 2.2, textColor: slate, lineColor: border, lineWidth: 0.2, valign: "middle" },
        didParseCell: (data) => { if (!data.cell.raw) data.cell.styles.fillColor = [255, 255, 255]; },
        rowPageBreak: "avoid",
      });
      y = lastTableY() + 5;
    };

    pdf.setFillColor(...blue);
    pdf.rect(0, 0, pageWidth, 35, "F");
    pdf.setFillColor(...red);
    pdf.rect(0, 33, pageWidth, 2, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("DAILY WAGE TEAM", margin, 15);
    pdf.setFontSize(9.5);
    pdf.text("POC / DEPLOYMENT / PROJECT", margin, 21);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.text(`Request No. ${value(record.request_no)}`, pageWidth - margin, 15, { align: "right" });
    pdf.text(`Status: ${value(record.status)}`, pageWidth - margin, 21, { align: "right" });
    y = 42;

    section("1", "Request Information");
    grid([
      ["Request No.", record.request_no], ["Requested By", record.requested_by],
      ["Company", record.company], ["Project / POC", record.project_poc],
      ["Customer", record.customer], ["Site / Location", record.site_location],
      ["Purpose", record.purpose], ["Required From Date", formatDate(record.required_from_date)],
      ["Required To Date", formatDate(record.required_to_date)], ["Total Days", totalDaysFor(record)],
      ["Site Supervisor", record.site_supervisor], ["Work Description", record.work_description],
    ], 3);

    section("2", "Team Requirement");
    const requirementRows: Array<[string, string | number | undefined]> = [
      ["Work Type / Trade", record.work_type_trade], ["Total Persons Required", record.total_persons_required],
      ["Expected Daily Rate", formatPKR(Number(record.expected_daily_rate))], ["Nature of Work", record.nature_of_work.join(", ")],
    ];
    if (record.nature_of_work.includes("Other")) requirementRows.push(["Other Nature of Work", record.nature_other]);
    grid(requirementRows, 4);

    section("3", "Team Details (Daily Wage)");
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin, bottom: 20 },
      theme: "grid",
      head: [["Worker Name", "Trade / Skill", "Contact No.", "Daily Rate", "No. of Days", "Total Amount", "Remarks"]],
      body: record.team_members.length ? record.team_members.map((worker) => [
        value(worker.worker_name), value(worker.trade_skill), value(worker.contact_no), formatPKR(Number(worker.daily_rate)),
        value(worker.no_of_days), formatPKR(Number(worker.daily_rate) * Number(worker.no_of_days)), value(worker.remarks),
      ]) : [["No team members added", "—", "—", "—", "—", "—", "—"]],
      headStyles: { fillColor: blue, textColor: 255, fontStyle: "bold", fontSize: 7.3, cellPadding: 2, halign: "center", valign: "middle" },
      bodyStyles: { fontSize: 7.3, cellPadding: 2, textColor: slate, lineColor: border, lineWidth: 0.2, valign: "middle" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 27 }, 1: { cellWidth: 25 }, 2: { cellWidth: 24 }, 3: { cellWidth: 23, halign: "right" }, 4: { cellWidth: 16, halign: "center" }, 5: { cellWidth: 26, halign: "right" }, 6: { cellWidth: 43 } },
      rowPageBreak: "avoid",
    });
    y = lastTableY() + 3;
    ensureSpace(9);
    pdf.setFillColor(239, 246, 255);
    pdf.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, "F");
    pdf.setTextColor(...slate);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.text("Team Total Amount", margin + 3, y + 4.7);
    pdf.setTextColor(...blue);
    pdf.text(formatPKR(labourCost(record.team_members)), pageWidth - margin - 3, y + 4.7, { align: "right" });
    y += 12;

    section("4", "Cost Summary");
    grid([
      ["Total Team Members", teamSize(record)], ["Total Days", totalDaysFor(record)],
      ["Total Labour Cost", formatPKR(labourCost(record.team_members))], ["Other Allowance", formatPKR(Number(record.other_allowance))],
      ["Total Amount", formatPKR(requestTotal(record))],
    ]);

    section("5", "Payment Terms");
    ensureSpace(12);
    const paymentTerms = ["Per Day Payment", "After Completion", "Advance Payment"];
    const cardWidth = (contentWidth - 4) / 3;
    paymentTerms.forEach((term, index) => {
      const x = margin + index * (cardWidth + 2);
      const selected = record.payment_terms === term;
      pdf.setFillColor(...(selected ? [239, 246, 255] as [number, number, number] : [255, 255, 255] as [number, number, number]));
      pdf.setDrawColor(...(selected ? [147, 197, 253] as [number, number, number] : border));
      pdf.roundedRect(x, y, cardWidth, 10, 1.5, 1.5, "FD");
      if (selected) { pdf.setFillColor(...blue); pdf.circle(x + 4, y + 5, 1.8, "F"); }
      pdf.setTextColor(...(selected ? blue : slate));
      pdf.setFont("helvetica", selected ? "bold" : "normal");
      pdf.setFontSize(7.6);
      pdf.text(term, x + (selected ? 8 : 4), y + 5.8);
    });
    y += 15;

    if (includeAttachments) {
      section("6", "Attachments (Optional)");
      const attachmentCategories = ["Upload Quotation", "Worker CNIC Copies", "Work Pictures (if any)", "Other Documents"];
      autoTable(pdf, {
        startY: y,
        margin: { left: margin, right: margin, bottom: 20 },
        theme: "grid",
        head: [["Category", "File Name", "File Size"]],
        body: attachmentCategories.map((category) => {
          const attachment = record.attachments.find((item) => item.category === category);
          return attachment ? [category, attachment.name, formatFileSize(attachment.size)] : [category, "No attachment", "—"];
        }),
        headStyles: { fillColor: blue, textColor: 255, fontStyle: "bold", fontSize: 8, cellPadding: 2.2 },
        bodyStyles: { fontSize: 8, cellPadding: 2.3, textColor: slate, lineColor: border, lineWidth: 0.2 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 48, fontStyle: "bold" }, 1: { cellWidth: 104 }, 2: { cellWidth: 31, halign: "right" } },
        rowPageBreak: "avoid",
      });
    }

    const generatedDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const pages = pdf.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      pdf.setPage(page);
      pdf.setDrawColor(...border);
      pdf.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
      pdf.setTextColor(100, 116, 139);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(`Generated: ${generatedDate}`, margin, pageHeight - 8);
      pdf.text(`Page ${page} of ${pages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
    }
    return pdf;
  };
  const downloadPdf = async (record: HiringRequest) => {
    try {
      const pdf = await createRequestPdf(record, { includeAttachments: false });
      pdf.save(`${record.request_no}-daily-wage-request.pdf`);
    } catch {
      toast.error("Could not generate the request PDF.");
    }
  };
  const printRequest = async (record: HiringRequest) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Please allow pop-ups to print this request."); return; }
    try {
      const pdf = await createRequestPdf(record, { includeAttachments: false });
      printWindow.addEventListener("load", () => printWindow.print(), { once: true });
      printWindow.location.href = pdf.output("bloburl");
    } catch {
      printWindow.close();
      toast.error("Could not generate the request PDF.");
    }
  };
  const requestDelete = (id: string) => { if (isAdmin) setConfirm({ type: "delete", id }); };
  const requestClear = (id: string) => { if (isAdmin) setConfirm({ type: "clear", id }); };
  const requestApprove = async (record: HiringRequest) => {
    if (!isAdmin) return;
    try {
      const approvedAt = new Date().toISOString();
      await dailyWageRequestsAPI.approve(record.id, appUser?.fullName || firebaseUser?.displayName || requestedBy, appUser?.email || firebaseUser?.email || "", approvedAt);
      toast.success("Request approved");
    } catch (error) {
      toast.error("Could not approve the request.", { description: error instanceof Error ? error.message : "Please try again." });
    }
  };
  const confirmAction = async () => {
    if (!confirm || !isAdmin) return;
    setIsSaving(true);
    try {
      if (confirm.type === "clear") {
        await dailyWageRequestsAPI.setStatus(confirm.id, "Cleared", new Date().toISOString());
        toast.success("Dues marked as cleared");
      } else {
        await dailyWageRequestsAPI.delete(confirm.id);
        toast.success("Request deleted");
      }
      setConfirm(null);
    } catch (error) {
      toast.error("Could not update the request in Firebase.", { description: error instanceof Error ? error.message : "Check Firebase connection and Firestore permissions." });
    } finally {
      setIsSaving(false);
    }
  };

  const sortableHeaders: { label: string; key: SortKey; align?: string }[] = [
    { label: "Request No.", key: "request_no" }, { label: "Project / POC", key: "project_poc" },
    { label: "Customer", key: "customer" }, { label: "Site / Location", key: "site_location" },
    { label: "Requested By", key: "requested_by" }, { label: "Team Size", key: "team_members", align: "text-center" },
    { label: "Total Days", key: "total_days", align: "text-center" }, { label: "Total Amount", key: "total_amount", align: "text-right" },
    { label: "Status", key: "status" }, { label: "Created Date", key: "created_at" },
  ];

  if (!form) return <div className="min-h-full bg-slate-50/70 px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:px-7 sm:py-6">
        <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700"><ClipboardList className="h-3.5 w-3.5" /> Workforce &amp; HR</div><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Daily Wage Team</h1><p className="mt-1 text-sm text-slate-500">POC / Deployment / Project</p></div>
        <button onClick={openNew} disabled={isLoading || loadError} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"><Plus className="h-4 w-4" /> Add New Request</button>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard label="Total Requests" value={records.length} accent="bg-blue-50 text-blue-700" icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Pending Dues" value={records.filter((record) => record.status === "Pending").length} accent="bg-amber-50 text-amber-700" icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label="Cleared Dues" value={records.filter((record) => record.status === "Cleared").length} accent="bg-emerald-50 text-emerald-700" icon={<Check className="h-5 w-5" />} />
        <StatCard label="Pending Approval" value={records.filter((record) => (record.approval_status || "Pending Approval") === "Pending Approval").length} accent="bg-amber-50 text-amber-700" icon={<ClipboardList className="h-5 w-5" />} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Filter className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-slate-900">Search &amp; Filters</h2><p className="text-xs text-slate-500">Refine requests by project, team, or status</p></div></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Field label="Request No. / Customer" value={filters.request_no} onChange={(value) => setFilters({ ...filters, request_no: value })} placeholder="DWH-2026-0001 or customer" />
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Status</span><select className={inputClass} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{["Pending", "Cleared"].map((status) => <option key={status}>{status}</option>)}</select></label>
          <Field label="From Date" value={filters.from_date} onChange={(value) => setFilters({ ...filters, from_date: value })} type="date" />
          <Field label="To Date" value={filters.to_date} onChange={(value) => setFilters({ ...filters, to_date: value })} type="date" />
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1"><button onClick={() => { setActiveFilters(filters); setIsSearched(true); setPage(1); }} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"><Search className="h-4 w-4" /> Search</button><button onClick={resetFilters} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"><X className="h-4 w-4" /><span className="sr-only sm:not-sr-only">Reset</span></button></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:px-5"><div><h2 className="text-base font-bold text-slate-900">Daily Wage Requests</h2><p className="mt-0.5 text-xs text-slate-500">{filteredRecords.length} {filteredRecords.length === 1 ? "request" : "requests"}{isSearched ? " found" : " in total"}</p></div><div className="flex flex-wrap items-center gap-3"><label className="hidden items-center gap-2 text-xs font-medium text-slate-600">Rows per page<select className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700" value={pageSize} onChange={(event) => { setPageSize(event.target.value === "all" ? "all" : Number(event.target.value)); setPage(1); }}><option value="15">15</option><option value="30">30</option><option value="100">100</option><option value="all">All</option></select></label><span className="hidden">{firstVisible}–{lastVisible} / {filteredRecords.length}</span><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1} className="hidden">Previous</button><span className="hidden">Page {currentPage}/{pageCount}</span><button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage >= pageCount} className="hidden">Next</button><button onClick={openNew} disabled={isLoading || loadError} className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 sm:self-auto"><Plus className="h-4 w-4" /> New Request</button></div></div>
        {isLoading ? <div className="px-5 py-14 text-center text-sm text-slate-500">Loading Daily Wage requests from Firebase...</div> : loadError ? <div className="px-5 py-14 text-center text-sm text-red-600">Could not load requests. Check Firebase connection and Firestore permissions, then refresh.</div> : filteredRecords.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1250px] border-collapse text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr>{sortableHeaders.map(({ label, key, align }) => <th key={key} className={`border-b border-slate-200 px-3 py-3 font-semibold ${align || ""}`}><button onClick={() => toggleSort(key)} className={`inline-flex items-center gap-1 hover:text-blue-700 ${align === "text-center" ? "justify-center" : align === "text-right" ? "justify-end" : ""}`}>{label}{sortKey === key && (sortAscending ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</button></th>)}<th className="border-b border-slate-200 px-3 py-3 font-semibold">Approval</th><th className="border-b border-slate-200 px-3 py-3 text-right font-semibold">Action</th></tr></thead><tbody>{paginatedRecords.map((record) => <tr key={record.id} className="border-b border-slate-100 last:border-0 hover:bg-blue-50/30"><td className="whitespace-nowrap px-3 py-3 font-semibold text-blue-700">{record.request_no}</td><td className="max-w-[175px] truncate px-3 py-3 font-medium text-slate-800">{record.project_poc || "—"}</td><td className="max-w-[150px] truncate px-3 py-3 text-slate-600">{record.customer || "—"}</td><td className="px-3 py-3 text-slate-600">{record.site_location || "—"}</td><td className="px-3 py-3 text-slate-600">{record.requested_by}</td><td className="px-3 py-3 text-center text-slate-700">{teamSize(record)}</td><td className="px-3 py-3 text-center text-slate-700">{totalDaysFor(record) || "—"}</td><td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-800">{formatPKR(requestTotal(record)).replace("PKR ", "")}</td><td className="px-3 py-3"><StatusBadge status={record.status} /></td><td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatDate(record.created_at.slice(0, 10))}</td><td className="px-3 py-3"><ApprovalBadge status={record.approval_status || "Pending Approval"} /></td><td className="px-3 py-3"><div className="grid grid-cols-3 justify-items-center gap-1"><IconButton label="View" onClick={() => openRecord(record, "view")}><Eye className="h-4 w-4" /></IconButton><IconButton label="Download PDF" onClick={() => downloadPdf(record)}><Download className="h-4 w-4" /></IconButton>{(isAdmin || (record.owner_uid || record.created_by) === firebaseUser?.uid) && <IconButton label="Edit" onClick={() => openRecord(record, "edit")}><Pencil className="h-4 w-4" /></IconButton>}{isAdmin && record.status === "Pending" && <IconButton label="Mark dues as cleared" onClick={() => requestClear(record.id)}><Check className="h-4 w-4" /></IconButton>}{isAdmin && (record.approval_status || "Pending Approval") === "Pending Approval" && <IconButton label="Approve request" onClick={() => requestApprove(record)}><Check className="h-4 w-4" /></IconButton>}{(isAdmin || (record.owner_uid || record.created_by) === firebaseUser?.uid) && <IconButton label="Duplicate" onClick={() => duplicateRecord(record)}><ClipboardList className="h-4 w-4" /></IconButton>}{isAdmin && <IconButton label="Delete" danger onClick={() => requestDelete(record.id)}><Trash2 className="h-4 w-4" /></IconButton>}</div></td></tr>)}</tbody></table></div>
          : <div className="px-5 py-14 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><ClipboardList className="h-7 w-7" /></span><h3 className="mt-4 text-base font-bold text-slate-900">No Daily Wage Requests Found</h3><p className="mt-1 text-sm text-slate-500">Create a hiring request to get your team started.</p><button onClick={openNew} disabled={isLoading || loadError} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"><Plus className="h-4 w-4" /> Add New Request</button></div>}
        {filteredRecords.length > 0 && <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between"><label className="flex items-center gap-2 font-medium">Rows per page<select className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700" value={pageSize} onChange={(event) => { setPageSize(event.target.value === "all" ? "all" : Number(event.target.value)); setPage(1); }}><option value="15">15</option><option value="30">30</option><option value="100">100</option><option value="all">All</option></select></label><span>Showing {firstVisible}–{lastVisible} of {filteredRecords.length}</span><div className="flex items-center gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1} className="rounded border border-slate-200 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40">Previous</button><span>Page {currentPage} of {pageCount}</span><button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage >= pageCount} className="rounded border border-slate-200 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40">Next</button></div></div>}
      </section>
    </div>
    <ConfirmDialog confirm={confirm} onCancel={() => setConfirm(null)} onConfirm={confirmAction} />
  </div>;

  const isReadOnly = formMode === "view";
  const setField = (key: keyof HiringRequest) => (value: string) => updateForm(key, value);
  const attachmentCategories = ["Upload Quotation", "Worker CNIC Copies", "Work Pictures (if any)", "Other Documents"];
  return <div className="min-h-full bg-slate-50/70 px-3 py-5 pb-4 sm:px-6 sm:py-6 sm:pb-4 lg:px-8">
    <div className="mx-auto max-w-[1440px] space-y-4">
      {isAdmin && formMode === "new" && <section className="rounded-lg border border-blue-200 bg-blue-50 p-4"><label className="block max-w-xl"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Create request for</span><select className={inputClass} value={requestedUserId} onChange={(event) => { const user = users.find((item) => item.id === event.target.value); setRequestedUserId(event.target.value); setForm((current) => current ? { ...current, requested_by: user?.fullName || "" } : current); }}><option value="">Select a user</option>{users.filter((user) => !user.isDisabled).map((user) => <option key={user.id} value={user.id}>{user.fullName} ({user.email})</option>)}</select></label></section>}
      <header className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid min-h-[70px] grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2 bg-[#06255d] px-3 py-2 text-white sm:grid-cols-[180px_minmax(0,1fr)_180px] sm:px-5">
          <div className="flex items-center gap-2"><button onClick={closeForm} aria-label="Back to requests" className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/20 text-white hover:bg-white/10"><ArrowLeft className="h-4 w-4" /></button></div>
          <div className="min-w-0 text-center"><h1 className="text-base font-extrabold tracking-wide sm:text-xl">DAILY WAGE TEAM</h1><p className="mt-0.5 text-[10px] font-semibold tracking-wide text-blue-100 sm:text-xs">POC / DEPLOYMENT / PROJECT</p><p className="text-xs font-bold text-blue-100 sm:text-sm">Request No. {form.request_no}</p></div>
          <div className="flex items-center justify-end gap-2"><span className="rounded border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-bold sm:text-sm">Status: {formMode === "new" ? "New" : form.status}</span>{formMode === "view" && <><button type="button" onClick={() => downloadPdf(form)} title="Download PDF" aria-label="Download PDF" className="inline-flex h-8 items-center gap-2 rounded bg-white px-2.5 text-xs font-semibold text-blue-900 hover:bg-blue-50"><Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">Download</span></button>{(isAdmin || (form.owner_uid || form.created_by) === firebaseUser?.uid) && <button onClick={() => setFormMode("edit")} className="inline-flex h-8 items-center gap-2 rounded bg-red-600 px-2.5 text-xs font-semibold text-white hover:bg-red-700"><Pencil className="h-3.5 w-3.5" /><span className="hidden sm:inline">Edit</span></button>}</>}</div>
        </div>
      </header>

      <Section number="1" title="Request Information" description="Basic project details and required work dates">
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Request No." value={form.request_no} readOnly />
          <Field label="Requested By" value={form.requested_by} onChange={setField("requested_by")} disabled={isReadOnly || !isAdmin} />
          <Field label="Company" value={form.company} onChange={setField("company")} required disabled={isReadOnly} error={errors.company} />
          <Field label="Project / POC" value={form.project_poc} onChange={setField("project_poc")} required disabled={isReadOnly} error={errors.project_poc} />
          <Field label="Customer" value={form.customer} onChange={setField("customer")} required disabled={isReadOnly} error={errors.customer} />
          <Field label="Site / Location" value={form.site_location} onChange={setField("site_location")} required disabled={isReadOnly} error={errors.site_location} />
          <Field label="Purpose" value={form.purpose} onChange={setField("purpose")} required disabled={isReadOnly} error={errors.purpose} />
          <Field label="Required From Date" value={form.required_from_date} onChange={setField("required_from_date")} type="date" required disabled={isReadOnly} error={errors.required_from_date} />
          <Field label="Required To Date" value={form.required_to_date} onChange={setField("required_to_date")} type="date" required disabled={isReadOnly} error={errors.required_to_date || (form.required_from_date && form.required_to_date && form.required_from_date > form.required_to_date ? "End date cannot be before the start date." : "")} min={form.required_from_date || undefined} />
          <Field label="Total Days" value={totalDays || "—"} readOnly />
          <Field label="Site Supervisor" value={form.site_supervisor} onChange={setField("site_supervisor")} disabled={isReadOnly} />
          <label className="block sm:col-span-2 lg:col-span-3"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Work Description</span><textarea className={`${inputClass} min-h-[82px] resize-y py-2.5`} value={form.work_description} onChange={(event) => setField("work_description")(event.target.value)} placeholder="Describe the work to be performed" disabled={isReadOnly} /></label>
        </div>
      </Section>

      <Section number="2" title="Team Requirement" description="Define the required trade, team size, and nature of work">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Work Type / Trade" value={form.work_type_trade} onChange={setField("work_type_trade")} options={trades} required disabled={isReadOnly} error={errors.work_type_trade} />
          <Field label="Total Persons Required" value={form.total_persons_required} onChange={setField("total_persons_required")} type="number" min="1" step="1" required disabled={isReadOnly} error={errors.total_persons_required} />
          <Field label="Expected Daily Rate" value={form.expected_daily_rate} onChange={setField("expected_daily_rate")} type="number" min="0" step="1" required disabled={isReadOnly} error={errors.expected_daily_rate} />
        </div>
        <div className="mt-5 rounded-xl border border-red-100 bg-red-50/40 p-4"><p className="mb-3 text-xs font-bold text-slate-700">Nature of Work <span className="font-normal text-slate-500">(Select all that apply)</span><span className="ml-1 text-red-600">*</span></p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">{natureOptions.map((nature) => <label key={nature} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${form.nature_of_work.includes(nature) ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-700"}`}><input type="checkbox" className="h-4 w-4 accent-blue-700" checked={form.nature_of_work.includes(nature)} onChange={() => toggleNature(nature)} disabled={isReadOnly} />{nature}</label>)}</div>{errors.nature_of_work && <p className="mt-2 text-xs font-medium text-red-600">{errors.nature_of_work}</p>}{form.nature_of_work.includes("Other") && <div className="mt-4 max-w-md"><Field label="Other Nature of Work" value={form.nature_other} onChange={setField("nature_other")} required disabled={isReadOnly} error={errors.nature_other} placeholder="Describe the nature of work" /></div>}</div>
      </Section>

      <Section number="3" title="Team Details (Daily Wage)" description="Add worker details; individual amounts are calculated automatically" right={!isReadOnly && <button onClick={addWorker} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-red-700"><Plus className="h-4 w-4" /> Add Team Member</button>}>
        <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[1080px] text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr>{["#", "Worker Name", "Trade / Skill", "Contact No.", "Daily Rate", "No. of Days", "Total Amount", "Remarks", ""].map((heading, index) => <th key={`${heading}-${index}`} className="border-b border-slate-200 px-2.5 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody>{form.team_members.length ? form.team_members.map((worker, index) => <tr key={index} className="border-b border-slate-100 last:border-0"><td className="px-3 py-2 font-semibold text-slate-500">{index + 1}</td><td className="min-w-[145px] px-2 py-2"><input className={inputClass} value={worker.worker_name} onChange={(event) => updateWorker(index, "worker_name", event.target.value)} disabled={isReadOnly} placeholder="Worker name" />{errors[`worker-${index}-name`] && <span className="mt-1 block text-[10px] text-red-600">{errors[`worker-${index}-name`]}</span>}</td><td className="min-w-[145px] px-2 py-2"><input list="worker-trades" className={inputClass} value={worker.trade_skill} onChange={(event) => updateWorker(index, "trade_skill", event.target.value)} disabled={isReadOnly} placeholder="Trade / skill" /><datalist id="worker-trades">{trades.map((trade) => <option key={trade} value={trade} />)}</datalist>{errors[`worker-${index}-trade`] && <span className="mt-1 block text-[10px] text-red-600">{errors[`worker-${index}-trade`]}</span>}</td><td className="min-w-[130px] px-2 py-2"><input type="tel" className={inputClass} value={worker.contact_no} onChange={(event) => updateWorker(index, "contact_no", event.target.value)} disabled={isReadOnly} placeholder="03XX-XXXXXXX" /></td><td className="min-w-[130px] px-2 py-2"><input type="number" min="0" step="1" className={inputClass} value={worker.daily_rate} onChange={(event) => updateWorker(index, "daily_rate", event.target.value)} disabled={isReadOnly} placeholder="0" />{errors[`worker-${index}-rate`] && <span className="mt-1 block text-[10px] text-red-600">{errors[`worker-${index}-rate`]}</span>}</td><td className="min-w-[105px] px-2 py-2"><input type="number" min="1" step="1" className={inputClass} value={worker.no_of_days} onChange={(event) => updateWorker(index, "no_of_days", event.target.value)} disabled={isReadOnly} placeholder={String(totalDays || 0)} />{errors[`worker-${index}-days`] && <span className="mt-1 block text-[10px] text-red-600">{errors[`worker-${index}-days`]}</span>}</td><td className="whitespace-nowrap px-2 py-2 font-semibold text-slate-800">{formatPKR(Number(worker.daily_rate || 0) * Number(worker.no_of_days || 0))}</td><td className="min-w-[135px] px-2 py-2"><input className={inputClass} value={worker.remarks} onChange={(event) => updateWorker(index, "remarks", event.target.value)} disabled={isReadOnly} placeholder="Optional" /></td><td className="px-2 py-2">{!isReadOnly && <IconButton label="Remove team member" danger onClick={() => updateForm("team_members", form.team_members.filter((_, row) => row !== index))}><Trash2 className="h-4 w-4" /></IconButton>}</td></tr>) : <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">No team members added yet. Use “Add Team Member” to begin.</td></tr>}</tbody></table></div>
        {errors.team_members && <p className="mt-2 text-xs font-medium text-red-600">{errors.team_members}</p>}
        <div className="mt-4 flex flex-col justify-between gap-2 rounded-lg bg-blue-50 px-4 py-3 sm:flex-row sm:items-center"><span className="text-sm font-semibold text-slate-700">Team Total Amount</span><strong className="text-lg font-bold text-blue-800">{formatPKR(totalLabour)}</strong></div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section number="4" title="Cost Summary" description="Live totals based on the team details"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5 xl:[&>label>span:first-child]:min-h-[3.75rem]"><Field label="Total Team Members" value={form.team_members.length} readOnly /><Field label="Total Days" value={totalDays || "—"} readOnly /><Field label="Total Labour Cost" value={formatPKR(totalLabour)} readOnly /><Field label="Other Allowance" value={form.other_allowance} onChange={setField("other_allowance")} type="number" min="0" step="1" placeholder="0" disabled={isReadOnly} /><Field label="Total Amount" value={formatPKR(totalLabour + Number(form.other_allowance || 0))} readOnly /></div></Section>
        <Section number="5" title="Payment Terms" description="Select one payment schedule"><div className="grid grid-cols-3 gap-2">{["Per Day Payment", "After Completion", "Advance Payment"].map((option) => <label key={option} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm transition ${form.payment_terms === option ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700"}`}><input type="radio" name="payment-terms" className="h-4 w-4 accent-blue-700" value={option} checked={form.payment_terms === option} onChange={(event) => setField("payment_terms")(event.target.value)} disabled={isReadOnly} />{option}</label>)}</div></Section>
      </div>

      <Section number="6" title="Attachments (Optional)" description="PDF, JPG, or PNG files">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{attachmentCategories.map((category, index) => {
          const attachment = form.attachments.find((item) => item.category === category);
          return <div key={category} className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">{index === 2 ? <FileImage className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{category}</p><p className="text-[11px] text-slate-500">PDF, JPG, PNG</p></div></div>{attachment ? <div className="mt-3 flex items-start justify-between gap-2 rounded-lg bg-white p-2.5"><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-700">{attachment.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{(attachment.size / 1024).toFixed(1)} KB</p></div>{!isReadOnly && <button onClick={() => removeAttachment(category)} className="shrink-0 text-xs font-semibold text-red-600 hover:underline">Remove</button>}</div> : <label className={`mt-3 flex h-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-blue-700 hover:bg-blue-50 ${isReadOnly ? "pointer-events-none opacity-50" : ""}`}><Plus className="mr-1 h-3.5 w-3.5" /> Choose file<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" onChange={(event) => uploadAttachment(category, event)} disabled={isReadOnly} /></label>}</div>;
        })}</div>
      </Section>

    </div>
    <div className="sticky bottom-0 z-30 mx-auto mt-4 w-full max-w-[1440px] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-[0_-6px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-2"><button onClick={closeForm} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><X className="h-4 w-4" /> Cancel</button><button onClick={openNew} disabled={isLoading || loadError} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100"><Plus className="h-4 w-4" /> Add New Request</button></div>{isReadOnly ? <button onClick={closeForm} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800"><ArrowLeft className="h-4 w-4" /> Back to Requests</button> : <div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => printRequest(form)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Printer className="h-4 w-4" /> Print</button><button onClick={saveAsPending} disabled={isSaving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"><FileText className="h-4 w-4" /> {isSaving ? "Saving..." : formMode === "new" ? "Save as Pending" : "Save Changes"}</button></div>}</div></div>
    <ConfirmDialog confirm={confirm} onCancel={() => setConfirm(null)} onConfirm={confirmAction} />
  </div>;
}

function StatusBadge({ status }: { status: Status }) {
  const classes: Record<Status, string> = { Pending: "bg-amber-100 text-amber-800", Cleared: "bg-emerald-100 text-emerald-800" };
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${classes[status]}`}>{status}</span>;
}
function ApprovalBadge({ status }: { status: "Pending Approval" | "Approved" }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${status === "Approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{status}</span>;
}
function IconButton({ label, onClick, children, danger = false }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition ${danger ? "text-red-600 hover:bg-red-50" : "text-slate-500 hover:bg-blue-50 hover:text-blue-700"}`}>{children}</button>;
}
function ConfirmDialog({ confirm, onCancel, onConfirm }: { confirm: { type: "clear" | "delete"; id: string } | null; onCancel: () => void; onConfirm: () => void }) {
  const deleting = confirm?.type === "delete";
  return <AlertDialog open={!!confirm} onOpenChange={(open) => { if (!open) onCancel(); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{deleting ? "Delete Request?" : "Mark Dues as Cleared?"}</AlertDialogTitle><AlertDialogDescription>{deleting ? "This request will be permanently removed from this list." : "Confirm that the outstanding dues for this hiring request have been paid."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); onConfirm(); }} className={deleting ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}>{deleting ? "Delete" : "Mark Cleared"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
