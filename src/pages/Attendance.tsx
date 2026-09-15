import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { attendanceAPI, AUTOMATIC_ABSENT_NOTE, DEFAULT_ATTENDANCE_SETTINGS, WEEKDAYS, type AttendanceEmployee, type AttendanceRecord, type AttendanceSettings, type AttendanceStatus, type OfficeDaySchedule, type Weekday } from "@/integrations/firebase/attendanceAPI";
import { getLeaveDateRange, leaveRequestsAPI, type LeaveRequest, type LeaveRequestStatus } from "@/integrations/firebase/leaveRequestsAPI";
import { employeesAPI, type EmployeeData } from "@/integrations/firebase/employeesAPI";
import { usersAPI, type User } from "@/integrations/firebase/usersAPI";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AlertCircle, CalendarDays, Camera, Check, CheckCircle2, Clock3, Download, FileClock, Filter, LayoutDashboard, LogIn, LogOut, Palmtree, Pencil, RefreshCw, Search, Settings2, ShieldCheck, Timer, Trash2, TrendingUp, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const PAKISTAN_TIME_ZONE = "Asia/Karachi";
const ATTENDANCE_STATUSES: AttendanceStatus[] = ["Present", "Late", "On Leave", "Absent", "Weekly Off"];

type FilterStatus = "All" | AttendanceStatus;

type ManualEntry = {
  dateKey: string;
  checkInTime: string;
  checkOutTime: string;
  status: AttendanceStatus;
  note: string;
};

type AttendanceSummaryRow = {
  userId: string;
  employeeName: string;
  email: string;
  workingDays: number;
  present: number;
  late: number;
  leave: number;
  absent: number;
  attendancePercentage: number;
  workingMinutes: number;
  overtimeMinutes: number;
};

const statusStyles: Record<AttendanceStatus, string> = {
  Present: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Late: "border-amber-200 bg-amber-50 text-amber-700",
  "Early Checkout": "border-orange-200 bg-orange-50 text-orange-700",
  "Late & Early Checkout": "border-amber-200 bg-amber-50 text-amber-800",
  "Missing Check-in": "border-rose-200 bg-rose-50 text-rose-700",
  "Missing Check-out": "border-violet-200 bg-violet-50 text-violet-700",
  "On Leave": "border-blue-200 bg-blue-50 text-blue-700",
  Absent: "border-red-200 bg-red-50 text-red-700",
  "Weekly Off": "border-slate-200 bg-slate-100 text-slate-600",
};

function dateParts(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: PAKISTAN_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(date).reduce<Record<string, string>>((parts, part) => {
    if (part.type !== "literal") parts[part.type] = part.value;
    return parts;
  }, {});
}

function getDateKey(date = new Date()) {
  const parts = dateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: PAKISTAN_TIME_ZONE, day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatTime(timestamp?: string) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: PAKISTAN_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(timestamp));
}

function formatDuration(minutes: number) {
  if (!minutes) return "—";
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function getPakistanMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: PAKISTAN_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour")?.value || 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value || 0);
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function isLateArrival(date: Date, checkInTime = "09:15", gracePeriodMinutes = 15) {
  return getPakistanMinutes(date) > timeToMinutes(checkInTime) + gracePeriodMinutes;
}

function getPakistanWeekday(date = new Date()): Weekday {
  return new Intl.DateTimeFormat("en-US", { timeZone: PAKISTAN_TIME_ZONE, weekday: "long" }).format(date) as Weekday;
}

function getSchedule(settings: AttendanceSettings, dateKey: string) {
  const schedule = settings.weeklySchedule[getPakistanWeekday(new Date(`${dateKey}T12:00:00Z`))];
  return schedule || { enabled: true, checkInTime: settings.checkInTime || "09:15", checkOutTime: settings.checkOutTime || "17:00" };
}

type AttendanceCalculation = {
  status: AttendanceStatus;
  lateDurationMinutes: number;
  earlyCheckoutDurationMinutes: number;
};

function calculateAttendance(record: AttendanceRecord, settings: AttendanceSettings): AttendanceCalculation {
  if (record.status === "On Leave" || record.status === "Weekly Off") return { status: record.status, lateDurationMinutes: 0, earlyCheckoutDurationMinutes: 0 };
  if (!record.checkInAt && !record.checkOutAt) return { status: "Absent", lateDurationMinutes: 0, earlyCheckoutDurationMinutes: 0 };
  if (!record.checkInAt) return { status: "Missing Check-in", lateDurationMinutes: 0, earlyCheckoutDurationMinutes: 0 };

  const schedule = getSchedule(settings, record.dateKey);
  const actualCheckInMinutes = getPakistanMinutes(new Date(record.checkInAt));
  const expectedCheckInMinutes = timeToMinutes(schedule.checkInTime);
  const gracePeriodEndMinutes = expectedCheckInMinutes + settings.gracePeriodMinutes;
  const lateDurationMinutes = Math.max(0, actualCheckInMinutes - gracePeriodEndMinutes);
  if (!record.checkOutAt) return { status: "Missing Check-out", lateDurationMinutes, earlyCheckoutDurationMinutes: 0 };

  const actualCheckOutMinutes = getPakistanMinutes(new Date(record.checkOutAt));
  const expectedCheckOutMinutes = timeToMinutes(schedule.checkOutTime);
  const isLate = lateDurationMinutes > 0;
  const isEarlyCheckout = actualCheckOutMinutes < expectedCheckOutMinutes;

  return {
    status: isLate && isEarlyCheckout ? "Late & Early Checkout" : isLate ? "Late" : isEarlyCheckout ? "Early Checkout" : "Present",
    lateDurationMinutes,
    earlyCheckoutDurationMinutes: isEarlyCheckout ? expectedCheckOutMinutes - actualCheckOutMinutes : 0,
  };
}

function formatScheduledTime(dateKey: string, time: string) {
  return formatTime(toPakistanTimestamp(dateKey, time));
}

function isAfterCutoff(now: Date, dateKey: string, cutoff: string) {
  return getDateKey(now) > dateKey || (getDateKey(now) === dateKey && getPakistanMinutes(now) >= timeToMinutes(cutoff));
}

function toPakistanTimestamp(dateKey: string, time: string) {
  return new Date(`${dateKey}T${time || "00:00"}:00+05:00`).toISOString();
}

function getNextDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return getDateKey(date);
}

function getMonthKey(date = new Date()) {
  return getDateKey(date).slice(0, 7);
}

function displayDateKey(dateKey: string) {
  return formatDate(new Date(`${dateKey}T12:00:00Z`));
}

function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof Users; tone: string }) {
  return <Card className="border-slate-200/80 shadow-sm"><CardContent className="flex items-start justify-between p-4"><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p><p className="mt-1 text-[11px] text-slate-500">{detail}</p></div><span className={`rounded-xl p-2.5 ${tone}`}><Icon className="h-5 w-5" /></span></CardContent></Card>;
}

function StatusBadge({ status }: { status: AttendanceStatus }) {
  return <Badge variant="outline" className={`break-words whitespace-normal gap-1.5 font-semibold ${statusStyles[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</Badge>;
}

function formatLeaveDate(value?: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: PAKISTAN_TIME_ZONE }).format(date);
}

function formatAppliedOn(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: PAKISTAN_TIME_ZONE }).format(date);
}

function AdminLeaveRequestsTable({ requests, saving, onReview }: { requests: LeaveRequest[]; saving: boolean; onReview: (request: LeaveRequest, status: LeaveRequestStatus, remarks?: string) => Promise<void> }) {
  const [rejectingRequest, setRejectingRequest] = useState<LeaveRequest | null>(null);
  const [rejectionRemarks, setRejectionRemarks] = useState("");
  const [pageSize, setPageSize] = useState<15 | 30 | "all">(15);
  const [page, setPage] = useState(1);
  const pageCount = pageSize === "all" ? 1 : Math.max(1, Math.ceil(requests.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedRequests = pageSize === "all" ? requests : requests.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  if (requests.length === 0) return <p className="py-8 text-center text-sm text-slate-500">No leave requests yet.</p>;
  return <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200"><div className="order-last flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="text-xs text-slate-500">Showing {((currentPage - 1) * (pageSize === "all" ? requests.length : pageSize)) + 1}–{Math.min(currentPage * (pageSize === "all" ? requests.length : pageSize), requests.length)} of {requests.length} requests</div><div className="flex flex-wrap items-center gap-2"><label className="text-xs font-semibold text-slate-600" htmlFor="leave-page-size">Rows</label><select id="leave-page-size" value={pageSize} onChange={(event) => { const value = event.target.value === "all" ? "all" : Number(event.target.value) as 15 | 30; setPageSize(value); setPage(1); }} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"><option value="15">15</option><option value="30">30</option><option value="all">All</option></select><Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" disabled={currentPage === 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><span className="text-xs font-medium text-slate-600">Page {currentPage} of {pageCount}</span><Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" disabled={currentPage === pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button></div></div><div className="p-3 lg:hidden">{paginatedRequests.map((request) => <article key={`mobile-${request.id}`} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-800">{request.employeeName || "—"}</p><p className="mt-1 text-xs text-slate-500">{formatLeaveDate(request.startDate)} to {formatLeaveDate(request.endDate)}</p></div><Badge variant="outline" className={request.status === "Approved" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : request.status === "Rejected" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{request.status}</Badge></div><dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs"><div className="col-span-2 rounded bg-slate-50 p-2"><dt className="font-semibold text-slate-500">Description</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-700">{request.reason || "—"}</dd></div><div><dt className="font-semibold text-slate-500">Applied on</dt><dd className="mt-1 text-slate-700">{formatAppliedOn(request.createdAt)}</dd></div><div><dt className="font-semibold text-slate-500">Remarks</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-700">{request.reviewRemarks || (request.status === "Pending" ? "Awaiting review." : `${request.status} by ${request.reviewedByName || "Admin"}.`)}</dd></div></dl>{request.status === "Pending" && <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3"><Button size="sm" disabled={saving} onClick={() => onReview(request, "Approved")} className="h-8 bg-emerald-600 text-xs hover:bg-emerald-700"><Check className="h-3.5 w-3.5" />Approve</Button><Button size="sm" disabled={saving} onClick={() => { setRejectingRequest(request); setRejectionRemarks(""); }} className="h-8 bg-red-600 text-xs hover:bg-red-700"><XCircle className="h-3.5 w-3.5" />Reject</Button></div>}</article>)}</div><div className="hidden overflow-visible lg:block"><table className="w-full table-fixed border-collapse text-left text-xs"><thead className="bg-[#eaf2fb] text-[10px] uppercase tracking-wide text-slate-600"><tr><th className="border border-slate-200 px-3 py-2.5 font-bold">Employee name</th><th className="border border-slate-200 px-3 py-2.5 font-bold">Description</th><th className="border border-slate-200 px-3 py-2.5 font-bold">From Date</th><th className="border border-slate-200 px-3 py-2.5 font-bold">To Date</th><th className="border border-slate-200 px-3 py-2.5 font-bold">Applied on</th><th className="border border-slate-200 px-3 py-2.5 font-bold">Status</th><th className="border border-slate-200 px-3 py-2.5 font-bold">Remarks</th></tr></thead><tbody>{paginatedRequests.map((request) => <tr key={request.id} className="align-top even:bg-slate-50/70 hover:bg-blue-50/40"><td className="border border-slate-200 px-3 py-3 font-semibold text-slate-800">{request.employeeName || "—"}</td><td className="max-w-[260px] whitespace-pre-wrap break-words border border-slate-200 px-3 py-3 text-slate-700">{request.reason || "—"}</td><td className="whitespace-nowrap border border-slate-200 px-3 py-3 text-slate-600">{formatLeaveDate(request.startDate)}</td><td className="whitespace-nowrap border border-slate-200 px-3 py-3 text-slate-600">{formatLeaveDate(request.endDate)}</td><td className="whitespace-nowrap border border-slate-200 px-3 py-3 text-slate-600">{formatAppliedOn(request.createdAt)}</td><td className="border border-slate-200 px-3 py-3"><Badge variant="outline" className={request.status === "Approved" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : request.status === "Rejected" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{request.status}</Badge></td><td className="min-w-[190px] border border-slate-200 px-3 py-3"><p className="whitespace-pre-wrap break-words text-slate-600">{request.reviewRemarks || (request.status === "Pending" ? "Awaiting admin review." : `${request.status} by ${request.reviewedByName || "Admin"}.`)}</p>{request.status === "Pending" && <div className="mt-2 flex gap-1.5"><Button size="sm" disabled={saving} onClick={() => onReview(request, "Approved")} className="h-7 bg-emerald-600 px-2 text-[10px] hover:bg-emerald-700"><Check className="h-3 w-3" />Approve</Button><Button size="sm" disabled={saving} onClick={() => { setRejectingRequest(request); setRejectionRemarks(""); }} className="h-7 bg-red-600 px-2 text-[10px] hover:bg-red-700"><XCircle className="h-3 w-3" />Reject</Button></div>}</td></tr>)}</tbody></table></div><Dialog open={Boolean(rejectingRequest)} onOpenChange={(open) => { if (!open && !saving) { setRejectingRequest(null); setRejectionRemarks(""); } }}><DialogContent><DialogHeader><DialogTitle>Reject leave request</DialogTitle><DialogDescription>Enter a reason for rejecting {rejectingRequest?.employeeName || "this request"}. This remark will be saved with the request.</DialogDescription></DialogHeader><Textarea value={rejectionRemarks} onChange={(event) => setRejectionRemarks(event.target.value)} placeholder="Explain why this leave request is being rejected" className="min-h-24" autoFocus /><DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => { setRejectingRequest(null); setRejectionRemarks(""); }}>Cancel</Button><Button type="button" disabled={saving || !rejectionRemarks.trim() || !rejectingRequest} onClick={async () => { if (!rejectingRequest || !rejectionRemarks.trim()) return; await onReview(rejectingRequest, "Rejected", rejectionRemarks.trim()); setRejectingRequest(null); setRejectionRemarks(""); }} className="bg-red-600 hover:bg-red-700">Reject request</Button></DialogFooter></DialogContent></Dialog></div>;
}

function LeaveRequestsView({ isAdmin, appUser, requests, saving, onSubmit, onReview }: { isAdmin: boolean; appUser: User | null; requests: LeaveRequest[]; saving: boolean; onSubmit: (startDate: string, endDate: string, reason: string) => Promise<void>; onReview: (request: LeaveRequest, status: LeaveRequestStatus, remarks?: string) => Promise<void> }) {
  const today = getDateKey();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim() || endDate < startDate) return;
    await onSubmit(startDate, endDate, reason.trim());
    setReason("");
  };
  return <div className={isAdmin ? "grid gap-5" : "grid gap-5 xl:grid-cols-[380px_1fr]"}>
    {!isAdmin && <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="text-base text-[#145487]">Apply for leave</CardTitle><p className="text-xs text-slate-500">Select one date or a date range and submit it for admin approval.</p></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><label className="text-xs font-semibold text-slate-700">Start date<input required type="date" min={today} value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label><label className="text-xs font-semibold text-slate-700">End date<input required type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label></div><label className="block text-xs font-semibold text-slate-700">Reason<Textarea required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Tell admin why you need leave" className="mt-1 min-h-24" /></label><Button type="submit" disabled={saving || !reason.trim() || endDate < startDate} className="bg-[#145487] hover:bg-[#0f416a]"><Palmtree className="h-3.5 w-3.5" />Submit leave request</Button></form></CardContent></Card>}
    <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="text-base text-[#145487]">{isAdmin ? "Leave requests for approval" : "My leave requests"}</CardTitle><p className="text-xs text-slate-500">{isAdmin ? "Review requests and approve or reject them. Approved dates are automatically marked On Leave." : `Requests submitted by ${appUser?.fullName || "you"}.`}</p></CardHeader><CardContent className="space-y-3">{isAdmin ? <AdminLeaveRequestsTable requests={requests} saving={saving} onReview={onReview} /> : requests.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No leave requests yet.</p> : requests.map((request) => <div key={request.id} className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="font-semibold text-slate-800">{request.employeeName}</p><p className="text-xs text-slate-500">{request.startDate} to {request.endDate} · {request.dates.length} day{request.dates.length === 1 ? "" : "s"}</p><p className="mt-2 text-sm text-slate-700">{request.reason}</p></div><Badge variant="outline" className={request.status === "Approved" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : request.status === "Rejected" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{request.status}</Badge></div>{isAdmin && request.status === "Pending" && <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3"><Button size="sm" disabled={saving} onClick={() => onReview(request, "Approved")} className="bg-emerald-600 hover:bg-emerald-700"><Check className="h-3.5 w-3.5" />Approve</Button><Button size="sm" disabled={saving} onClick={() => onReview(request, "Rejected")} variant="outline" className="text-red-600"><XCircle className="h-3.5 w-3.5" />Reject</Button></div>}</div>)}</CardContent></Card>
  </div>;
}

function EmployeeLeaveRequestsView({ appUser, requests, saving, onSubmit, onEdit, onDelete }: { appUser: User | null; requests: LeaveRequest[]; saving: boolean; onSubmit: (startDate: string, endDate: string, reason: string) => Promise<void>; onEdit: (request: LeaveRequest, startDate: string, endDate: string, reason: string) => Promise<void>; onDelete: (request: LeaveRequest) => Promise<void> }) {
  const today = getDateKey();
  const [isApplying, setIsApplying] = useState(false);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim() || endDate < startDate) return;
    if (editingRequest) await onEdit(editingRequest, startDate, endDate, reason.trim());
    else await onSubmit(startDate, endDate, reason.trim());
    setReason("");
    setEditingRequest(null);
    setIsApplying(false);
  };
  const beginEdit = (request: LeaveRequest) => {
    setEditingRequest(request);
    setStartDate(request.startDate);
    setEndDate(request.endDate);
    setReason(request.reason);
    setIsApplying(true);
  };
  const cancelForm = () => {
    setEditingRequest(null);
    setReason("");
    setIsApplying(false);
  };
  const badgeClass = (status: LeaveRequestStatus) => status === "Approved" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "Rejected" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700";
  return <div className="space-y-5">
    <div className="flex justify-end"><Button onClick={isApplying ? cancelForm : () => setIsApplying(true)} className="bg-[#145487] hover:bg-[#0f416a]"><Palmtree className="h-3.5 w-3.5" />{isApplying ? "Cancel" : "Apply Leave"}</Button></div>
    {isApplying && <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="text-base text-[#145487]">{editingRequest ? "Edit leave request" : "Apply for leave"}</CardTitle><p className="text-xs text-slate-500">Select one date or a date range and submit it for admin approval.</p></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-700">From date<input required type="date" min={today} value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label><label className="text-xs font-semibold text-slate-700">To date<input required type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label></div><label className="block text-xs font-semibold text-slate-700">Description<Textarea required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Tell admin why you need leave" className="mt-1 min-h-24" /></label><Button type="submit" disabled={saving || !reason.trim() || endDate < startDate} className="bg-[#145487] hover:bg-[#0f416a]"><Palmtree className="h-3.5 w-3.5" />Submit leave request</Button></form></CardContent></Card>}
    <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="text-base text-[#145487]">My leave requests</CardTitle><p className="text-xs text-slate-500">Requests submitted by {appUser?.fullName || "you"}.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="hidden min-w-[980px] w-full border-collapse border border-slate-200 text-left text-xs md:table [&_td]:border [&_td]:border-slate-200 [&_th]:border [&_th]:border-slate-200"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-2.5 font-semibold">Employee name</th><th className="px-3 py-2.5 font-semibold">Description</th><th className="px-3 py-2.5 font-semibold">From Date</th><th className="px-3 py-2.5 font-semibold">To Date</th><th className="px-3 py-2.5 font-semibold">Applied on</th><th className="px-3 py-2.5 font-semibold">Status</th><th className="px-3 py-2.5 font-semibold">Remarks</th><th className="px-3 py-2.5 font-semibold">Actions</th></tr></thead><tbody>{requests.length === 0 ? <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">No leave requests yet.</td></tr> : requests.map((request) => <tr key={request.id} className="hover:bg-slate-50/70"><td className="px-3 py-3 font-semibold text-slate-800">{request.employeeName || "—"}</td><td className="max-w-xs whitespace-pre-wrap break-words px-3 py-3 text-slate-600">{request.reason || "—"}</td><td className="px-3 py-3 text-slate-600">{formatLeaveDate(request.startDate)}</td><td className="px-3 py-3 text-slate-600">{formatLeaveDate(request.endDate)}</td><td className="px-3 py-3 text-slate-600">{formatAppliedOn(request.createdAt)}</td><td className="px-3 py-3"><Badge variant="outline" className={badgeClass(request.status)}>{request.status}</Badge></td><td className="max-w-xs whitespace-pre-wrap break-words px-3 py-3 text-slate-600">{request.reviewRemarks || (request.status === "Pending" ? "Awaiting review." : `${request.status} by ${request.reviewedByName || "Admin"}.`)}</td><td className="px-3 py-3">{request.status === "Pending" && <div className="flex gap-1.5"><Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[10px]" disabled={saving} onClick={() => beginEdit(request)}><Pencil className="h-3 w-3" />Edit</Button><Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[10px] text-red-600 hover:text-red-700" disabled={saving} onClick={() => onDelete(request)}><Trash2 className="h-3 w-3" />Delete</Button></div>}</td></tr>)}</tbody></table></div><div className="space-y-3 p-3 md:hidden">{requests.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No leave requests yet.</p> : requests.map((request) => <article key={`mobile-${request.id}`} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-800">{request.employeeName || "—"}</p><p className="mt-1 text-xs text-slate-500">{formatLeaveDate(request.startDate)} to {formatLeaveDate(request.endDate)}</p></div><Badge variant="outline" className={badgeClass(request.status)}>{request.status}</Badge></div><dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs"><div className="col-span-2 rounded bg-slate-50 p-2"><dt className="font-semibold text-slate-500">Description</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-700">{request.reason || "—"}</dd></div><div><dt className="font-semibold text-slate-500">Applied on</dt><dd className="mt-1 text-slate-700">{formatAppliedOn(request.createdAt)}</dd></div><div><dt className="font-semibold text-slate-500">Remarks</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-700">{request.reviewRemarks || (request.status === "Pending" ? "Awaiting review." : `${request.status} by ${request.reviewedByName || "Admin"}.`)}</dd></div></dl>{request.status === "Pending" && <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3"><Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" disabled={saving} onClick={() => beginEdit(request)}><Pencil className="h-3 w-3" />Edit</Button><Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs text-red-600 hover:text-red-700" disabled={saving} onClick={() => onDelete(request)}><Trash2 className="h-3 w-3" />Delete</Button></div>}</article>)}</div></CardContent></Card>
  </div>;
}

function WeeklyOfficeSchedule({ settings, saving, onSave }: { settings: AttendanceSettings; saving: boolean; onSave: (settings: AttendanceSettings) => Promise<void> }) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  const updateDay = (weekday: Weekday, changes: Partial<OfficeDaySchedule>) => setDraft({ ...draft, weeklySchedule: { ...draft.weeklySchedule, [weekday]: { ...draft.weeklySchedule[weekday], ...changes } } });
  const submit = async (event: React.FormEvent) => { event.preventDefault(); await onSave(draft); };
  return <Card className="border-slate-200 shadow-sm"><CardHeader><div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-[#145487]" /><CardTitle className="text-base text-[#145487]">Office attendance settings</CardTitle></div><p className="text-xs text-slate-500">Set working days, expected shift timings, grace period, and the automatic absent cutoff.</p></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold text-slate-700">Grace period (minutes)<input required min="0" max="180" type="number" value={draft.gracePeriodMinutes} onChange={(event) => setDraft({ ...draft, gracePeriodMinutes: Number(event.target.value) })} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label><label className="text-xs font-semibold text-slate-700">Absent cutoff time<input required type="time" value={draft.absentCutoffTime} onChange={(event) => setDraft({ ...draft, absentCutoffTime: event.target.value })} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label><label className="text-xs font-semibold text-slate-700">Required working hours<input required min="1" max="24" step="0.5" type="number" value={draft.requiredWorkingHours} onChange={(event) => setDraft({ ...draft, requiredWorkingHours: Number(event.target.value) })} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label></div><div className="hidden grid-cols-[1.4fr_0.7fr_1fr_1fr] gap-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 md:grid"><span>Day</span><span>On / Off</span><span>Clock in time</span><span>Clock out time</span></div>{WEEKDAYS.map((weekday) => { const day = draft.weeklySchedule[weekday]; return <div key={weekday} className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3 md:grid-cols-[1.4fr_0.7fr_1fr_1fr] md:items-center md:border-0 md:bg-transparent md:p-3"><span className="text-sm font-semibold text-slate-800">{weekday}</span><label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={day.enabled} onChange={(event) => updateDay(weekday, { enabled: event.target.checked })} className="h-4 w-4 rounded text-[#145487]" /><span>{day.enabled ? "On" : "Off"}</span></label><label className="text-xs font-semibold text-slate-600"><span className="mb-1 block lg:hidden">Clock in time</span><input type="time" disabled={!day.enabled} value={day.checkInTime} onChange={(event) => updateDay(weekday, { checkInTime: event.target.value })} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label><label className="text-xs font-semibold text-slate-600"><span className="mb-1 block lg:hidden">Clock out time</span><input type="time" disabled={!day.enabled} value={day.checkOutTime} onChange={(event) => updateDay(weekday, { checkOutTime: event.target.value })} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label></div>; })}<Button type="submit" disabled={saving} className="bg-[#145487] hover:bg-[#0f416a]">{saving ? "Saving..." : "Save attendance settings"}</Button></form></CardContent></Card>;
}

function AdminAttendanceControls({ users, selectedUserId, selectedRecord, saving, onSelect, onCheckIn, onCheckOut, onManualEntry, settings }: { users: User[]; selectedUserId: string; selectedRecord?: AttendanceRecord; saving: boolean; onSelect: (userId: string) => void; onCheckIn: () => void; onCheckOut: () => void; onManualEntry: (entry: ManualEntry) => Promise<void>; settings: AttendanceSettings }) {
  const today = getDateKey();
  const initialSchedule = getSchedule(settings, today);
  const [manual, setManual] = useState<ManualEntry>({ dateKey: today, checkInTime: initialSchedule.checkInTime, checkOutTime: initialSchedule.checkOutTime, status: "Present", note: "" });
  const timeFieldsDisabled = manual.status === "On Leave" || manual.status === "Weekly Off";
  const selectedUserUnavailable = selectedRecord?.status === "On Leave" || selectedRecord?.status === "Weekly Off";
  useEffect(() => {
    const schedule = getSchedule(settings, today);
    const status = selectedRecord?.status === "On Leave" || selectedRecord?.status === "Weekly Off" ? selectedRecord.status : "Present";
    setManual({ dateKey: today, checkInTime: status === "On Leave" || status === "Weekly Off" ? "" : schedule.checkInTime, checkOutTime: status === "On Leave" || status === "Weekly Off" ? "" : schedule.checkOutTime, status, note: selectedRecord?.note || "" });
  }, [selectedRecord?.note, selectedRecord?.status, selectedUserId, settings, today]);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); await onManualEntry(manual.status === "On Leave" ? { ...manual, checkInTime: "", checkOutTime: "" } : manual); };
  return <Card className="border-blue-200 bg-blue-50/50 shadow-sm"><CardContent className="space-y-4 p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div className="flex-1"><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Admin attendance controls</p><p className="mt-1 text-xs text-slate-600">View, mark, or correct attendance for any active user.</p><label className="mt-3 block text-xs font-semibold text-slate-700" htmlFor="attendance-employee">Employee</label><select id="attendance-employee" value={selectedUserId} onChange={(event) => onSelect(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 lg:max-w-md">{users.map((user) => <option key={user.id} value={user.id}>{user.fullName} · {user.email}</option>)}</select></div><div className="flex items-center gap-2"><Button size="sm" disabled={saving || !selectedUserId || selectedUserUnavailable || Boolean(selectedRecord?.checkInAt)} onClick={onCheckIn} className="bg-[#145487] hover:bg-[#0f416a]"><LogIn className="h-3.5 w-3.5" />Clock in</Button><Button size="sm" variant="outline" disabled={saving || !selectedRecord?.checkInAt || Boolean(selectedRecord?.checkOutAt)} onClick={onCheckOut}><LogOut className="h-3.5 w-3.5" />Clock out</Button></div></div><form onSubmit={submit} className="grid gap-3 border-t border-blue-200 pt-4 sm:grid-cols-2 lg:grid-cols-5"><label className="text-xs font-semibold text-slate-700">Date<input required type="date" value={manual.dateKey} onChange={(event) => { const dateKey = event.target.value; const schedule = getSchedule(settings, dateKey); setManual({ ...manual, dateKey, checkInTime: schedule.checkInTime, checkOutTime: schedule.checkOutTime }); }} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label><label className="text-xs font-semibold text-slate-700">Clock in<input type="time" value={manual.checkInTime} disabled={timeFieldsDisabled} onChange={(event) => setManual({ ...manual, checkInTime: event.target.value })} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label><label className="text-xs font-semibold text-slate-700">Clock out<input type="time" value={manual.checkOutTime} disabled={timeFieldsDisabled} onChange={(event) => setManual({ ...manual, checkOutTime: event.target.value })} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label><label className="text-xs font-semibold text-slate-700">Status<select value={manual.status} onChange={(event) => setManual({ ...manual, status: event.target.value as AttendanceStatus })} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">{ATTENDANCE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label><label className="text-xs font-semibold text-slate-700">Note<input value={manual.note} onChange={(event) => setManual({ ...manual, note: event.target.value })} placeholder="Optional reason" className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label><Button type="submit" disabled={saving || !selectedUserId} className="bg-[#145487] hover:bg-[#0f416a] sm:col-span-2 lg:col-span-5">{manual.status === "On Leave" ? "Apply admin leave" : "Save Admin Entry"}</Button></form></CardContent></Card>;
}

function UserAttendanceControls({ todayRecord, saving, onCheckIn, onCheckOut }: { todayRecord?: AttendanceRecord; saving: boolean; onCheckIn: () => void; onCheckOut: () => void }) {
  const unavailable = todayRecord?.status === "On Leave" || todayRecord?.status === "Weekly Off";
  return <Card className="border-blue-200 bg-blue-50/50 shadow-sm"><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">My attendance</p><p className="mt-1 text-xs text-slate-600">Record your attendance for today using the clock in and clock out buttons.</p></div><div className="flex items-center gap-2"><Button size="sm" disabled={saving || unavailable || Boolean(todayRecord?.checkInAt)} onClick={onCheckIn} className="bg-[#145487] hover:bg-[#0f416a]"><LogIn className="h-3.5 w-3.5" />Clock in</Button><Button size="sm" variant="outline" disabled={saving || !todayRecord?.checkInAt || Boolean(todayRecord?.checkOutAt)} onClick={onCheckOut}><LogOut className="h-3.5 w-3.5" />Clock out</Button></div></CardContent></Card>;
}

function ShiftCheckInDialog({ open, saving, onClose, onOffice, onField }: { open: boolean; saving: boolean; onClose: () => void; onOffice: () => void; onField: (photo: Blob, latitude: number, longitude: number) => Promise<void> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState<"shift" | "camera">("shift");
  const [selectedShift, setSelectedShift] = useState<"Office" | "Field" | "">("");
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [cameraError, setCameraError] = useState("");

  const stopCamera = () => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; };
  useEffect(() => () => stopCamera(), []);
  useEffect(() => { if (!open) { setStep("shift"); setSelectedShift(""); setCoordinates(null); setCameraError(""); stopCamera(); } }, [open]);
  useEffect(() => {
    if (step === "camera" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play();
    }
  }, [step]);

  const startField = async () => {
    setCameraError("");
    setCoordinates(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setStep("camera");
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => setCoordinates({ latitude: coords.latitude, longitude: coords.longitude }),
        () => setCameraError("Camera on hai. Field clock in ke liye location permission bhi Allow karein, phir retry karein."),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    } catch { stopCamera(); setCameraError("Camera permission chahiye. Browser prompt par Allow karein, phir Next dobara click karein."); }
  };
  const captureField = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) { setCameraError("Camera is not ready yet. Please try again."); return; }
    if (!coordinates) { setCameraError("Location permission required. Please go back and click Next again, then Allow location."); return; }
    const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => { if (!blob) { setCameraError("Could not capture selfie."); return; } stopCamera(); await onField(blob, coordinates.latitude, coordinates.longitude); }, "image/jpeg", 0.85);
  };
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{step === "shift" ? "Select shift type" : "Field clock in selfie"}</DialogTitle><DialogDescription>{step === "shift" ? "Choose where you are working today." : "Next par camera aur location permission ke prompt par Allow karein, phir live selfie capture karein."}</DialogDescription></DialogHeader>{step === "shift" ? <><div className="grid gap-3 sm:grid-cols-2"><Button variant="outline" className="h-20 text-base" onClick={onOffice} disabled={saving}>Office</Button><Button variant={selectedShift === "Field" ? "default" : "outline"} className="h-20 text-base" onClick={() => setSelectedShift("Field")} disabled={saving}>Field</Button></div>{cameraError && <p className="text-sm text-red-600">{cameraError}</p>}<DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={startField} disabled={saving || selectedShift !== "Field"}>Next</Button></DialogFooter></> : <div className="space-y-3"><video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full rounded-lg bg-slate-900 object-cover" />{cameraError && <p className="text-sm text-red-600">{cameraError}</p>}<DialogFooter><Button variant="outline" onClick={() => { stopCamera(); setStep("shift"); }}>Back</Button><Button onClick={captureField} disabled={saving || !coordinates}>Capture selfie &amp; check in</Button></DialogFooter></div>}</DialogContent></Dialog>;
}

function AdminHistoryFilters({ users, selectedUserId, startDate, endDate, onSelectUser, onStartDateChange, onEndDateChange, onDownload }: { users: User[]; selectedUserId: string; startDate: string; endDate: string; onSelectUser: (userId: string) => void; onStartDateChange: (date: string) => void; onEndDateChange: (date: string) => void; onDownload: () => void }) {
  const invalidRange = endDate < startDate;
  return <Card className="border-blue-200 bg-blue-50/50 shadow-sm"><CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end"><label className="flex-1 text-xs font-semibold text-slate-700">Employee<select value={selectedUserId} onChange={(event) => onSelectUser(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500">{users.map((user) => <option key={user.id} value={user.id}>{user.fullName} · {user.email}</option>)}</select></label><label className="text-xs font-semibold text-slate-700">From date<input type="date" value={startDate} max={endDate} onChange={(event) => onStartDateChange(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label><label className="text-xs font-semibold text-slate-700">To date<input type="date" value={endDate} min={startDate} onChange={(event) => onEndDateChange(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label><Button type="button" onClick={onDownload} disabled={!selectedUserId || invalidRange} className="bg-[#145487] hover:bg-[#0f416a]"><Download className="h-3.5 w-3.5" />Download report</Button></CardContent></Card>;
}

function AdminAttendanceSummary({ rows, startDate, endDate, search, onSearch, onDownload }: { rows: AttendanceSummaryRow[]; startDate: string; endDate: string; search: string; onSearch: (value: string) => void; onDownload: () => void }) {
  const totals = rows.reduce((summary, row) => ({
    workingDays: summary.workingDays + row.workingDays,
    present: summary.present + row.present,
    late: summary.late + row.late,
    leave: summary.leave + row.leave,
    absent: summary.absent + row.absent,
    workingMinutes: summary.workingMinutes + row.workingMinutes,
    overtimeMinutes: summary.overtimeMinutes + row.overtimeMinutes,
  }), { workingDays: 0, present: 0, late: 0, leave: 0, absent: 0, workingMinutes: 0, overtimeMinutes: 0 });
  const attendedDays = totals.present + totals.late;
  const attendancePercentage = totals.workingDays ? Math.round((attendedDays / totals.workingDays) * 100) : 0;
  return <Card className="border-slate-200 shadow-sm"><CardHeader className="border-b border-slate-100 pb-3"><CardTitle className="text-base text-[#145487]">All users summary</CardTitle><p className="text-xs text-slate-500">Aggregate attendance for {displayDateKey(startDate)} to {displayDateKey(endDate)} · active users only</p></CardHeader><CardContent className="space-y-4 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">Search by employee name or email</p><div className="flex flex-wrap gap-2"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" /><Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search users" className="h-8 w-44 pl-8 text-xs" /></div><Button type="button" size="sm" onClick={onDownload} className="h-8 bg-[#145487] hover:bg-[#0f416a]"><Download className="h-3.5 w-3.5" />Download summary</Button></div></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-5"><MetricCard label="Users" value={String(rows.length)} detail="Active users" icon={Users} tone="bg-blue-50 text-blue-700" />{null}<MetricCard label="Absent days" value={String(totals.absent)} detail="Scheduled workdays" icon={AlertCircle} tone="bg-red-50 text-red-700" /><MetricCard label="Leave days" value={String(totals.leave)} detail="Approved leave" icon={Palmtree} tone="bg-blue-50 text-blue-700" /><MetricCard label="Attendance rate" value={`${attendancePercentage}%`} detail="Across working days" icon={TrendingUp} tone="bg-indigo-50 text-indigo-700" /><MetricCard label="Working hours" value={formatDuration(totals.workingMinutes)} detail={`Overtime ${formatDuration(totals.overtimeMinutes)}`} icon={Timer} tone="bg-amber-50 text-amber-700" /></div><div className="overflow-x-auto"><table className="w-full min-w-[920px] border-collapse border border-slate-200 text-center text-xs [&_td]:border [&_td]:border-slate-200 [&_th]:border [&_th]:border-slate-200"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-2.5 text-left font-semibold">Employee</th><th className="px-2 py-2.5 font-semibold">Working days</th><th className="px-2 py-2.5 font-semibold">Present</th><th className="px-2 py-2.5 font-semibold">Late</th><th className="px-2 py-2.5 font-semibold">Leave</th><th className="px-2 py-2.5 font-semibold">Absent</th><th className="px-2 py-2.5 font-semibold">Attendance</th><th className="px-2 py-2.5 font-semibold">Working hours</th><th className="px-2 py-2.5 font-semibold">Overtime</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={9} className="px-5 py-8 text-center text-sm text-slate-500">No active users or attendance data for this date range.</td></tr> : rows.map((row) => <tr key={row.userId} className="hover:bg-slate-50/70"><td className="px-3 py-2.5 text-left"><p className="font-semibold text-slate-800">{row.employeeName}</p><p className="text-[11px] text-slate-500">{row.email}</p></td><td className="px-2 py-2.5 text-slate-600">{row.workingDays}</td><td className="px-2 py-2.5 font-semibold text-emerald-700">{row.present}</td><td className="px-2 py-2.5 font-semibold text-amber-700">{row.late}</td><td className="px-2 py-2.5 text-blue-700">{row.leave}</td><td className="px-2 py-2.5 font-semibold text-red-700">{row.absent}</td><td className="px-2 py-2.5 font-semibold text-slate-700">{row.attendancePercentage}%</td><td className="px-2 py-2.5 text-slate-600">{formatDuration(row.workingMinutes)}</td><td className="px-2 py-2.5 text-slate-600">{formatDuration(row.overtimeMinutes)}</td></tr>)}</tbody></table></div></CardContent></Card>;
}

function LegacyAttendanceRows({ records, settings, showEmployee = true }: { records: AttendanceRecord[]; settings: AttendanceSettings; showEmployee?: boolean }) {
  return <div className="overflow-x-auto"><table className={`w-full ${showEmployee ? "min-w-[820px]" : "min-w-[660px]"} border-collapse border border-slate-200 text-left text-xs [&_td]:border [&_td]:border-slate-200 [&_th]:border [&_th]:border-slate-200`}><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{showEmployee && <th className="px-3 py-2.5 font-semibold">Employee</th>}<th className="px-2 py-2.5 font-semibold">Date</th><th className="px-2 py-2.5 font-semibold">Shift</th><th className="px-2 py-2.5 font-semibold">Field details</th><th className="px-2 py-2.5 font-semibold">Clock in</th><th className="px-2 py-2.5 font-semibold">Expected (with grace)</th><th className="px-2 py-2.5 font-semibold">Clock out</th><th className="px-2 py-2.5 font-semibold">Late duration</th><th className="px-2 py-2.5 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{records.length === 0 ? <tr><td colSpan={showEmployee ? 9 : 8} className="px-5 py-10 text-center text-sm text-slate-500">No attendance records match the current filters.</td></tr> : records.map((record) => <tr key={record.id} className="hover:bg-slate-50/70">{showEmployee && <td className="px-3 py-2.5"><p className="font-semibold text-slate-800">{record.employeeName}</p></td>}<td className="px-2 py-2.5 text-slate-600">{formatDate(new Date(`${record.dateKey}T12:00:00Z`))}</td><td className="px-2 py-2.5 text-slate-600">{record.shift}</td><td className="px-2 py-2.5 text-slate-600">{record.shift === "Field" ? <div className="flex min-w-[150px] items-center gap-2">{record.selfieUrl ? <a href={record.selfieUrl} target="_blank" rel="noreferrer"><img src={record.selfieUrl} alt="Field clock in selfie" className="h-10 w-10 rounded object-cover" /></a> : <span>No selfie</span>}<span className="text-[10px] leading-4">{record.latitude !== undefined && record.longitude !== undefined ? `${record.latitude.toFixed(5)}, ${record.longitude.toFixed(5)}` : "No coordinates"}</span></div> : "—"}</td><td className="px-2 py-2.5 font-medium text-slate-700">{record.status === "Absent" ? "-" : formatTime(record.checkInAt)}</td><td className="px-2 py-2.5 text-slate-600">{record.status === "Late" || record.checkInAt ? formatTime(toPakistanTimestamp(record.dateKey, getExpectedCheckInTime(settings, record.dateKey))) : "—"}</td><td className="px-2 py-2.5 text-slate-600">{record.status === "Absent" ? "-" : formatTime(record.checkOutAt)}</td><td className="px-2 py-2.5 text-amber-700">{record.status === "Late" && record.checkInAt ? formatDuration(Math.max(0, getPakistanMinutes(new Date(record.checkInAt)) - timeToMinutes(getExpectedCheckInTime(settings, record.dateKey)))) : "—"}</td><td className="px-2 py-2.5"><StatusBadge status={record.status} />{record.note && <p className="mt-1 max-w-32 truncate text-[10px] text-slate-500" title={record.note}>{record.note}</p>}</td></tr>)}</tbody></table></div>;
}

function AttendanceRows({ records, settings, showEmployee = true }: { records: AttendanceRecord[]; settings: AttendanceSettings; showEmployee?: boolean }) {
  const columnCount = showEmployee ? 10 : 9;

  return <div className="overflow-x-auto"><table className="min-w-[1100px] w-full table-fixed border-collapse border border-slate-200 text-left text-xs [&_td]:break-words [&_td]:whitespace-normal [&_td]:border [&_td]:border-slate-200 [&_th]:break-words [&_th]:whitespace-normal [&_th]:border [&_th]:border-slate-200">
    <colgroup>
      {showEmployee && <col />}
      <col />
      <col className="w-[1.6in]" />
      <col className="w-[1in]" />
      <col className="w-[1in]" />
      <col className="w-[1in]" />
      <col className="w-[1in]" />
      <col className="w-[1in]" />
      <col className="w-[1in]" />
      <col className="w-[1.5in]" />
    </colgroup>
    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>
      {showEmployee && <th className="px-3 py-2.5 font-semibold">Employee</th>}
      <th className="px-3 py-2.5 font-semibold">Date</th>
      <th className="px-3 py-2.5 font-semibold">Shift</th>
      <th className="px-3 py-2.5 font-semibold">Expected check-in</th>
      <th className="px-3 py-2.5 font-semibold">Actual check-in</th>
      <th className="px-3 py-2.5 font-semibold">Late duration</th>
      <th className="px-3 py-2.5 font-semibold">Expected check-out</th>
      <th className="px-3 py-2.5 font-semibold">Actual check-out</th>
      <th className="px-3 py-2.5 font-semibold">Early checkout</th>
      <th className="px-3 py-2.5 font-semibold">Status</th>
    </tr></thead>
    <tbody className="divide-y divide-slate-100">{records.length === 0 ? <tr><td colSpan={columnCount} className="px-5 py-10 text-center text-sm text-slate-500">No attendance records match the current filters.</td></tr> : records.map((record) => {
      const schedule = getSchedule(settings, record.dateKey);
      const calculation = calculateAttendance(record, settings);
      const status = record.dateKey === getDateKey() && (calculation.status === "Missing Check-in" || calculation.status === "Missing Check-out") ? calculation.lateDurationMinutes > 0 ? "Late" : "Present" : calculation.status;
      const hasCoordinates = record.latitude !== undefined && record.longitude !== undefined;
      return <tr key={record.id} className="hover:bg-slate-50/70">
        {showEmployee && <td className="px-3 py-2.5"><p className="font-semibold text-slate-800">{record.employeeName}</p></td>}
        <td className="px-3 py-2.5 text-slate-600">{formatDate(new Date(`${record.dateKey}T12:00:00Z`))}</td>
        <td className="px-3 py-2.5">
          {record.shift === "Field" ? <div className="flex items-center gap-2.5">
            {record.selfieUrl ? <img src={record.selfieUrl} alt={`${record.employeeName} field selfie`} className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover" loading="lazy" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400"><Camera className="h-5 w-5" /></div>}
            <div className="min-w-0 space-y-1">
              <p className="font-semibold text-slate-700">Field</p>
              {hasCoordinates ? <div className="mt-1 space-y-0.5 text-[10px] leading-tight text-slate-500"><p>{record.latitude?.toFixed(6)}</p><p>{record.longitude?.toFixed(6)}</p></div> : <p className="mt-1 text-[10px] text-slate-400">Coordinates unavailable</p>}
            </div>
          </div> : <span className="text-slate-600">{record.shift}</span>}
        </td>
        <td className="px-3 py-2.5 text-slate-600">{formatScheduledTime(record.dateKey, schedule.checkInTime)}</td>
        <td className="px-3 py-2.5 text-slate-600">{formatTime(record.checkInAt)}</td>
        <td className="px-3 py-2.5 text-slate-600">{formatDuration(calculation.lateDurationMinutes)}</td>
        <td className="px-3 py-2.5 text-slate-600">{formatScheduledTime(record.dateKey, schedule.checkOutTime)}</td>
        <td className="px-3 py-2.5 text-slate-600">{formatTime(record.checkOutAt)}</td>
        <td className="px-3 py-2.5 text-slate-600">{formatDuration(calculation.earlyCheckoutDurationMinutes)}</td>
        <td className="px-3 py-2.5"><StatusBadge status={status} /></td>
      </tr>;
    })}</tbody>
  </table></div>;
}

export default function Attendance({ fieldOnly = false }: { fieldOnly?: boolean }) {
  const { appUser, firebaseUser, isAdmin } = useAuth();
  const canUseSelfCheckIn = !isAdmin || fieldOnly;
  const [now, setNow] = useState(new Date());
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [employeeRecords, setEmployeeRecords] = useState<AttendanceRecord[]>([]);
  const [directoryEmployees, setDirectoryEmployees] = useState<EmployeeData[]>([]);
  const [allAdminUsers, setAllAdminUsers] = useState<User[]>([]);
  const [selectedAdminUserId, setSelectedAdminUserId] = useState("");
  const [selectedHistoryUserId, setSelectedHistoryUserId] = useState("");
  const [historyStartDate, setHistoryStartDate] = useState(getMonthKey() + "-01");
  const [historyEndDate, setHistoryEndDate] = useState(getDateKey());
  const [attendanceSettings, setAttendanceSettings] = useState(DEFAULT_ATTENDANCE_SETTINGS);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [summarySearch, setSummarySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("All");
  const [activeView, setActiveView] = useState<"overview" | "history" | "requests" | "settings">("overview");
  const [historyPageSize, setHistoryPageSize] = useState<15 | 30 | "all">(15);
  const [historyPage, setHistoryPage] = useState(1);
  const [calendarMonth, setCalendarMonth] = useState(getMonthKey());
  const [selectedDateKey, setSelectedDateKey] = useState(getDateKey());
  const dateKey = getDateKey(now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!firebaseUser || !appUser) { setLoading(false); return; }
    setLoading(true);
    const onError = () => { setLoading(false); toast.error("Attendance data could not be loaded."); };
    const unsubscribeSettings = attendanceAPI.subscribeSettings(setAttendanceSettings, onError);
    const unsubscribeEmployees = employeesAPI.subscribeAll(setDirectoryEmployees, onError);
    if (isAdmin) {
      usersAPI.getAll().then((users) => {
        setAllAdminUsers(users.filter((user) => !user.isDisabled));
      }).catch(() => toast.error("Employee list could not be loaded."));
      const unsubscribeAttendance = attendanceAPI.subscribeAll((records) => { setAllRecords(records); setTodayRecords(records.filter((record) => record.dateKey === dateKey)); setLoading(false); }, onError);
      const unsubscribeEmployeeAttendance = fieldOnly ? attendanceAPI.subscribeForEmployee([appUser.id, firebaseUser.uid], (records) => setEmployeeRecords(records), onError) : () => {};
      const unsubscribeRequests = leaveRequestsAPI.subscribeAll(setLeaveRequests, onError);
      return () => { unsubscribeSettings(); unsubscribeEmployees(); unsubscribeAttendance(); unsubscribeEmployeeAttendance(); unsubscribeRequests(); };
    }
    const userIds = Array.from(new Set([appUser.id, firebaseUser.uid]));
    const unsubscribeAttendance = attendanceAPI.subscribeForEmployee(userIds, (records) => { setEmployeeRecords(records); setLoading(false); }, onError);
    const unsubscribeRequests = leaveRequestsAPI.subscribeForUser(appUser.id, setLeaveRequests, onError);
    return () => { unsubscribeSettings(); unsubscribeEmployees(); unsubscribeAttendance(); unsubscribeRequests(); };
  }, [appUser, dateKey, fieldOnly, firebaseUser, isAdmin]);

  const adminUsers = useMemo(() => allAdminUsers.filter((user) => !directoryEmployees.some((employee) => employee.employmentStatus === "Inactive" && (employee.id === user.employeeRecordId || employee.userId === user.id))), [allAdminUsers, directoryEmployees]);
  const currentEmployee = useMemo(() => directoryEmployees.find((employee) => employee.id === appUser?.employeeRecordId || employee.userId === appUser?.id), [appUser?.employeeRecordId, appUser?.id, directoryEmployees]);
  const currentEmployeeInactive = !isAdmin && currentEmployee?.employmentStatus === "Inactive";

  useEffect(() => {
    if (!isAdmin) return;
    setSelectedAdminUserId((current) => adminUsers.some((user) => user.id === current) ? current : adminUsers[0]?.id || "");
    setSelectedHistoryUserId((current) => adminUsers.some((user) => user.id === current) ? current : adminUsers[0]?.id || "");
  }, [adminUsers, isAdmin]);

  const approvedLeaveDatesByUser = useMemo(() => {
    const datesByUser = new Map<string, Set<string>>();
    leaveRequests.filter((request) => request.status === "Approved").forEach((request) => {
      const dates = getLeaveDateRange(request.startDate, request.endDate);
      new Set([request.userId, request.employeeId]).forEach((userId) => {
        const userDates = datesByUser.get(userId) || new Set<string>();
        dates.forEach((date) => userDates.add(date));
        datesByUser.set(userId, userDates);
      });
    });
    return datesByUser;
  }, [leaveRequests]);
  const pendingLeaveCount = useMemo(() => leaveRequests.filter((request) => request.status === "Pending").length, [leaveRequests]);
  const selectedSchedule = getSchedule(attendanceSettings, dateKey);
  const makeSyntheticRecord = useCallback((user: User, key: string): AttendanceRecord => ({ id: `absent-${user.id}-${key}`, userId: user.id, employeeId: user.id, employeeName: user.fullName, email: user.email, department: "Unassigned", shift: "Office Shift", dateKey: key, status: approvedLeaveDatesByUser.get(user.id)?.has(key) ? "On Leave" : getSchedule(attendanceSettings, key).enabled ? "Absent" : "Weekly Off", late: false, workingMinutes: 0, overtimeMinutes: 0, createdAt: key, updatedAt: key }), [approvedLeaveDatesByUser, attendanceSettings]);
  const displayRecord = useCallback((record: AttendanceRecord): AttendanceRecord => {
    const leaveDates = approvedLeaveDatesByUser.get(record.userId) || approvedLeaveDatesByUser.get(record.employeeId);
    if (leaveDates?.has(record.dateKey)) return { ...record, checkInAt: undefined, checkOutAt: undefined, status: "On Leave", late: false, workingMinutes: 0, overtimeMinutes: 0 };
    const calculation = calculateAttendance(record, attendanceSettings);
    return { ...record, status: calculation.status, late: calculation.status === "Late" || calculation.status === "Late & Early Checkout" };
  }, [approvedLeaveDatesByUser, attendanceSettings]);
  const canAutoMarkAbsent = isAfterCutoff(now, dateKey, attendanceSettings.absentCutoffTime);

  useEffect(() => {
    if (!isAdmin) return;
    const overwrittenClockIns = todayRecords.filter((record) => record.status === "Absent" && record.checkInAt && record.note === AUTOMATIC_ABSENT_NOTE);
    if (!overwrittenClockIns.length) return;
    Promise.all(overwrittenClockIns.map((record) => {
      const schedule = getSchedule(attendanceSettings, record.dateKey);
      return attendanceAPI.restoreAutomaticAbsentClockIn(record.id, isLateArrival(new Date(record.checkInAt!), schedule.checkInTime, attendanceSettings.gracePeriodMinutes));
    })).catch(() => toast.error("Clock-in statuses could not be restored."));
  }, [attendanceSettings, isAdmin, todayRecords]);

  useEffect(() => {
    if (!isAdmin || !canAutoMarkAbsent || !selectedSchedule.enabled || !adminUsers.length) return;
    const missing = adminUsers.filter((user) => !todayRecords.some((record) => record.userId === user.id || record.employeeId === user.id) && !approvedLeaveDatesByUser.get(user.id)?.has(dateKey));
    if (!missing.length) return;
    Promise.all(missing.map((user) => attendanceAPI.markAbsent({ userId: user.id, employeeId: user.id, employeeName: user.fullName, email: user.email }, dateKey, new Date().toISOString(), AUTOMATIC_ABSENT_NOTE))).catch(() => toast.error("Automatic absent status could not be saved."));
  }, [adminUsers, approvedLeaveDatesByUser, canAutoMarkAbsent, dateKey, isAdmin, selectedSchedule.enabled, todayRecords]);

  useEffect(() => {
    if (!appUser || !firebaseUser) return;
    const openRecords = employeeRecords.filter((record) => record.dateKey < dateKey && record.checkInAt && !record.checkOutAt);
    if (!openRecords.length) return;
    Promise.all(openRecords.map((record) => attendanceAPI.checkOut([appUser.id, firebaseUser.uid], record.dateKey, toPakistanTimestamp(getNextDateKey(record.dateKey), "23:50"), Math.round(attendanceSettings.requiredWorkingHours * 60)))).catch(() => toast.error("Automatic midnight checkout could not be completed."));
  }, [appUser, attendanceSettings.requiredWorkingHours, dateKey, employeeRecords, firebaseUser]);

  const myTodayRecord = employeeRecords.find((record) => record.dateKey === dateKey);
  const myTodayDisplayRecord = useMemo(() => {
    const existingRecord = myTodayRecord ? displayRecord(myTodayRecord) : undefined;
    return existingRecord || (canAutoMarkAbsent ? { id: `absent-${appUser?.id}-${dateKey}`, userId: appUser?.id || "", employeeId: appUser?.id || "", employeeName: appUser?.fullName || "", email: appUser?.email || "", department: "Unassigned", shift: "Office Shift", dateKey, status: approvedLeaveDatesByUser.get(appUser?.id || "")?.has(dateKey) ? "On Leave" as const : selectedSchedule.enabled ? "Absent" as const : "Weekly Off" as const, late: false, workingMinutes: 0, overtimeMinutes: 0, createdAt: dateKey, updatedAt: dateKey } : undefined);
  }, [appUser, approvedLeaveDatesByUser, canAutoMarkAbsent, dateKey, displayRecord, myTodayRecord, selectedSchedule]);
  const adminTodayRows = useMemo(() => adminUsers.map((user) => {
    const record = todayRecords.find((entry) => entry.userId === user.id || entry.employeeId === user.id);
    return record ? displayRecord(record) : canAutoMarkAbsent ? makeSyntheticRecord(user, dateKey) : null;
  }).filter((record): record is AttendanceRecord => Boolean(record)), [adminUsers, canAutoMarkAbsent, dateKey, displayRecord, makeSyntheticRecord, todayRecords]);
  const selectedAdminUser = adminUsers.find((user) => user.id === selectedAdminUserId);
  const selectedAdminRecord = adminTodayRows.find((record) => record.userId === selectedAdminUserId);
  const selectedHistoryUser = adminUsers.find((user) => user.id === selectedHistoryUserId);
  const historyRecords = useMemo(() => {
    if (!isAdmin || !selectedHistoryUser || historyEndDate < historyStartDate) return [];
    const recordsByDate = new Map(allRecords.filter((record) => record.userId === selectedHistoryUser.id || record.employeeId === selectedHistoryUser.id).map((record) => [record.dateKey, record]));
    const records: AttendanceRecord[] = [];
    for (let key = historyStartDate; key <= historyEndDate; key = getNextDateKey(key)) {
      const record = recordsByDate.get(key);
      if (record) records.push(displayRecord(record));
      else if (key <= dateKey) records.push(makeSyntheticRecord(selectedHistoryUser, key));
    }
    return records;
  }, [allRecords, dateKey, displayRecord, historyEndDate, historyStartDate, isAdmin, makeSyntheticRecord, selectedHistoryUser]);
  const allUsersHistorySummary = useMemo<AttendanceSummaryRow[]>(() => {
    if (!isAdmin || historyEndDate < historyStartDate) return [];
    return adminUsers.map((user) => {
      const recordsByDate = new Map(allRecords.filter((record) => record.userId === user.id || record.employeeId === user.id).map((record) => [record.dateKey, record]));
      const records: AttendanceRecord[] = [];
      for (let key = historyStartDate; key <= historyEndDate; key = getNextDateKey(key)) {
        const record = recordsByDate.get(key);
        if (record) records.push(displayRecord(record));
        else if (key <= dateKey) records.push(makeSyntheticRecord(user, key));
      }
      const workingRecords = records.filter((record) => record.status !== "Weekly Off");
      const present = workingRecords.filter((record) => record.status === "Present").length;
      const late = workingRecords.filter((record) => record.status === "Late" || record.status === "Late & Early Checkout").length;
      const leave = workingRecords.filter((record) => record.status === "On Leave").length;
      const absent = workingRecords.filter((record) => record.status === "Absent").length;
      return {
        userId: user.id,
        employeeName: user.fullName,
        email: user.email,
        workingDays: workingRecords.length,
        present,
        late,
        leave,
        absent,
        attendancePercentage: workingRecords.length ? Math.round(((present + late) / workingRecords.length) * 100) : 0,
        workingMinutes: workingRecords.reduce((total, record) => total + record.workingMinutes, 0),
        overtimeMinutes: workingRecords.reduce((total, record) => total + record.overtimeMinutes, 0),
      };
    });
  }, [adminUsers, allRecords, dateKey, displayRecord, historyEndDate, historyStartDate, isAdmin, makeSyntheticRecord]);
  const filteredAllUsersHistorySummary = useMemo(() => {
    const query = summarySearch.trim().toLowerCase();
    if (!query) return allUsersHistorySummary;
    return allUsersHistorySummary.filter((row) => `${row.employeeName} ${row.email}`.toLowerCase().includes(query));
  }, [allUsersHistorySummary, summarySearch]);
  const displayedRecords = useMemo(() => {
    const records = isAdmin ? activeView === "history" ? historyRecords : adminTodayRows : activeView === "history" ? employeeRecords.map(displayRecord) : myTodayDisplayRecord ? [myTodayDisplayRecord] : [];
    return records.filter((record) => `${record.employeeName} ${record.employeeId} ${record.department}`.toLowerCase().includes(search.toLowerCase()) && (statusFilter === "All" || record.status === statusFilter || (statusFilter === "Late" && record.status === "Late & Early Checkout"))).sort((a, b) => b.dateKey.localeCompare(a.dateKey) || a.employeeName.localeCompare(b.employeeName));
  }, [activeView, adminTodayRows, displayRecord, employeeRecords, historyRecords, isAdmin, myTodayDisplayRecord, search, statusFilter]);
  const historyPageCount = historyPageSize === "all" ? 1 : Math.max(1, Math.ceil(displayedRecords.length / historyPageSize));
  const currentHistoryPage = Math.min(historyPage, historyPageCount);
  const paginatedHistoryRecords = historyPageSize === "all" ? displayedRecords : displayedRecords.slice((currentHistoryPage - 1) * historyPageSize, currentHistoryPage * historyPageSize);
  const metrics = useMemo(() => {
    const present = adminTodayRows.filter((record) => record.status === "Present");
    const late = adminTodayRows.filter((record) => record.status === "Late" || record.status === "Late & Early Checkout");
    const leave = adminTodayRows.filter((record) => record.status === "On Leave");
    const absent = adminTodayRows.filter((record) => record.status === "Absent");
    const checkedIn = adminTodayRows.filter((record) => Boolean(record.checkInAt));
    return { present, late, leave, absent, missingCheckout: checkedIn.filter((record) => !record.checkOutAt), totalOvertime: adminTodayRows.reduce((total, record) => total + record.overtimeMinutes, 0) };
  }, [adminTodayRows]);
  const userMonthRecords = useMemo(() => employeeRecords.map(displayRecord).filter((record) => record.dateKey.startsWith(`${calendarMonth}-`)), [calendarMonth, displayRecord, employeeRecords]);
  const userMonthStats = useMemo(() => {
    const workingDays = new Set(userMonthRecords.map((record) => record.dateKey)).size;
    const present = userMonthRecords.filter((record) => record.status === "Present").length;
    const late = userMonthRecords.filter((record) => record.status === "Late").length;
    const leave = userMonthRecords.filter((record) => record.status === "On Leave").length;
    const absent = userMonthRecords.filter((record) => record.status === "Absent").length;
    return { present, late, leave, absent, percentage: workingDays ? Math.round(((present + late) / workingDays) * 100) : 0 };
  }, [userMonthRecords]);
  const calendarYear = Number(calendarMonth.slice(0, 4));
  const calendarMonthNumber = Number(calendarMonth.slice(5, 7));
  const monthDays = new Date(Date.UTC(calendarYear, calendarMonthNumber, 0)).getUTCDate();
  const firstDayOffset = new Date(Date.UTC(calendarYear, calendarMonthNumber - 1, 1)).getUTCDay();
  const calendarRecords = isAdmin ? allRecords.filter((record) => record.userId === selectedHistoryUserId || record.employeeId === selectedHistoryUserId).map(displayRecord) : (() => {
    const records = employeeRecords.map(displayRecord);
    if (!appUser) return records;
    const recordDates = new Set(records.map((record) => record.dateKey));
    for (let day = 1; day <= monthDays; day += 1) {
      const calendarDate = `${calendarMonth}-${String(day).padStart(2, "0")}`;
      const shouldShowAsAbsent = calendarDate < dateKey || (calendarDate === dateKey && canAutoMarkAbsent);
      const isApprovedLeave = approvedLeaveDatesByUser.get(appUser.id)?.has(calendarDate) || false;
      if (calendarDate > dateKey || recordDates.has(calendarDate) || (!shouldShowAsAbsent && !isApprovedLeave)) continue;
      const schedule = getSchedule(attendanceSettings, calendarDate);
      if (!schedule.enabled && !isApprovedLeave) continue;
      records.push(makeSyntheticRecord(appUser, calendarDate));
    }
    return records;
  })();
  const recordsByDate = new Map(calendarRecords.map((record) => [record.dateKey, record]));
  const selectedDateRecords = calendarRecords.filter((record) => record.dateKey === selectedDateKey);

  const handleSettingsSave = async (nextSettings: AttendanceSettings) => { setSaving(true); try { await attendanceAPI.updateSettings(nextSettings); setAttendanceSettings(nextSettings); toast.success("Attendance settings saved."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save attendance settings."); } finally { setSaving(false); } };
  const handleLeaveSubmit = async (startDate: string, endDate: string, reason: string) => { if (!appUser) return; setSaving(true); try { await leaveRequestsAPI.create({ userId: appUser.id, employeeId: appUser.id, employeeName: appUser.fullName, email: appUser.email }, startDate, endDate, reason); toast.success("Leave request submitted for admin approval."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to submit leave request."); } finally { setSaving(false); } };
  const handleLeaveEdit = async (request: LeaveRequest, startDate: string, endDate: string, reason: string) => { if (!appUser || request.userId !== appUser.id || request.status !== "Pending") return; setSaving(true); try { await leaveRequestsAPI.updatePending(request, appUser.id, startDate, endDate, reason); toast.success("Leave request updated."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update leave request."); } finally { setSaving(false); } };
  const handleLeaveDelete = async (request: LeaveRequest) => { if (!appUser || request.userId !== appUser.id || request.status !== "Pending" || !window.confirm("Delete this pending leave request?")) return; setSaving(true); try { await leaveRequestsAPI.deletePending(request, appUser.id); toast.success("Leave request deleted."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to delete leave request."); } finally { setSaving(false); } };
  const handleLeaveReview = async (request: LeaveRequest, status: LeaveRequestStatus, remarks = "") => { if (!appUser) return; setSaving(true); try { await leaveRequestsAPI.updateStatus(request, status, appUser.id, appUser.fullName, remarks.trim()); toast.success(status === "Approved" ? "Leave approved and attendance updated." : "Leave request rejected."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update leave request."); } finally { setSaving(false); } };
  const handleOfficeCheckIn = async () => { if (!appUser || !firebaseUser || currentEmployeeInactive) return; const timestamp = new Date().toISOString(); setSaving(true); try { const record = await attendanceAPI.checkIn({ userId: appUser.id, employeeId: appUser.id, employeeName: appUser.fullName, email: appUser.email, shift: "Office" }, dateKey, timestamp, isLateArrival(new Date(), selectedSchedule.checkInTime, attendanceSettings.gracePeriodMinutes)); setShiftDialogOpen(false); toast.success(record.checkInAt === timestamp ? `Checked in at ${formatTime(timestamp)} PKT` : "You have already checked in today."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to check in."); } finally { setSaving(false); } };
  const handleFieldCheckIn = async (photo: Blob, latitude: number, longitude: number) => { if (!appUser || !firebaseUser || currentEmployeeInactive) return; setSaving(true); try { const path = `attendance-selfies/${appUser.id}/${dateKey}-${crypto.randomUUID()}.jpg`; const { error: uploadError } = await supabase.storage.from("company-logos").upload(path, photo, { contentType: "image/jpeg", upsert: false }); if (uploadError) throw uploadError; const { data } = supabase.storage.from("company-logos").getPublicUrl(path); const timestamp = new Date().toISOString(); const record = await attendanceAPI.checkIn({ userId: appUser.id, employeeId: appUser.id, employeeName: appUser.fullName, email: appUser.email, shift: "Field" }, dateKey, timestamp, isLateArrival(new Date(), selectedSchedule.checkInTime, attendanceSettings.gracePeriodMinutes), { selfieUrl: data.publicUrl, selfieStoragePath: path, latitude, longitude }); setShiftDialogOpen(false); toast.success(record.checkInAt === timestamp ? `Field clock in saved at ${formatTime(timestamp)} PKT` : "You have already checked in today."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save field clock in."); } finally { setSaving(false); } };
  const handleCheckOut = async () => { if (!appUser || !firebaseUser || currentEmployeeInactive) return; const timestamp = new Date().toISOString(); setSaving(true); try { const record = await attendanceAPI.checkOut([appUser.id, firebaseUser.uid], dateKey, timestamp, Math.round(attendanceSettings.requiredWorkingHours * 60)); toast.success(record.checkOutAt === timestamp ? `Checked out at ${formatTime(timestamp)} PKT` : "You have already checked out today."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to check out."); } finally { setSaving(false); } };
  const handleAdminCheckIn = async () => { if (!selectedAdminUser) return; const timestamp = new Date().toISOString(); setSaving(true); try { const record = await attendanceAPI.checkIn({ userId: selectedAdminUser.id, employeeId: selectedAdminUser.id, employeeName: selectedAdminUser.fullName, email: selectedAdminUser.email }, dateKey, timestamp, isLateArrival(new Date(), selectedSchedule.checkInTime, attendanceSettings.gracePeriodMinutes), { adminEntry: true }); toast.success(record.checkInAt === timestamp ? `${selectedAdminUser.fullName} checked in.` : "This user is already checked in today."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to mark check in."); } finally { setSaving(false); } };
  const handleAdminCheckOut = async () => { if (!selectedAdminUser) return; setSaving(true); try { const timestamp = new Date().toISOString(); const record = await attendanceAPI.checkOut(selectedAdminUser.id, dateKey, timestamp, Math.round(attendanceSettings.requiredWorkingHours * 60)); toast.success(record.checkOutAt === timestamp ? `${selectedAdminUser.fullName} checked out.` : "This user is already checked out today."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to mark check out."); } finally { setSaving(false); } };
  const handleManualEntry = async (entry: ManualEntry) => { if (!selectedAdminUser) return; setSaving(true); try { await attendanceAPI.saveManualEntry({ userId: selectedAdminUser.id, employeeId: selectedAdminUser.id, employeeName: selectedAdminUser.fullName, email: selectedAdminUser.email }, entry.dateKey, { checkInAt: entry.checkInTime ? toPakistanTimestamp(entry.dateKey, entry.checkInTime) : undefined, checkOutAt: entry.checkOutTime ? toPakistanTimestamp(entry.dateKey, entry.checkOutTime) : undefined, status: entry.status, note: entry.note.trim() || undefined }); setSelectedDateKey(entry.dateKey); toast.success(`${selectedAdminUser.fullName}'s admin entry was saved.`); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save admin entry."); } finally { setSaving(false); } };
  const exportCsv = () => { const rows = [["Employee ID", "Name", "Department", "Date", "Shift", "Expected Check-in", "Actual Check-in", "Late Duration", "Expected Check-out", "Actual Check-out", "Early Checkout Duration", "Status"], ...displayedRecords.map((record) => { const schedule = getSchedule(attendanceSettings, record.dateKey); const calculation = calculateAttendance(record, attendanceSettings); return [record.employeeId, record.employeeName, record.department, record.dateKey, record.shift, formatScheduledTime(record.dateKey, schedule.checkInTime), formatTime(record.checkInAt), formatDuration(calculation.lateDurationMinutes), formatScheduledTime(record.dateKey, schedule.checkOutTime), formatTime(record.checkOutAt), formatDuration(calculation.earlyCheckoutDurationMinutes), calculation.status]; })]; const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `attendance-${dateKey}.csv`; link.click(); URL.revokeObjectURL(url); toast.success("Attendance report exported."); };
  const exportAllUsersHistoryCsv = () => {
    if (!isAdmin || historyEndDate < historyStartDate) return;
    const rows = [["Employee ID", "Name", "Email", "Working days", "Present", "Late", "Leave", "Absent", "Attendance", "Working Hours", "Overtime"], ...allUsersHistorySummary.map((row) => [row.userId, row.employeeName, row.email, String(row.workingDays), String(row.present), String(row.late), String(row.leave), String(row.absent), `${row.attendancePercentage}%`, formatDuration(row.workingMinutes), formatDuration(row.overtimeMinutes)])];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-summary-all-users-${historyStartDate}-to-${historyEndDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("All users summary exported.");
  };
  const exportHistoryCsv = () => {
    if (!selectedHistoryUser || historyEndDate < historyStartDate) return;
    const rows = [["Employee ID", "Name", "Department", "Date", "Shift", "Expected Check-in", "Actual Check-in", "Late Duration", "Expected Check-out", "Actual Check-out", "Early Checkout Duration", "Status"], ...historyRecords.map((record) => { const schedule = getSchedule(attendanceSettings, record.dateKey); const calculation = calculateAttendance(record, attendanceSettings); return [record.employeeId, record.employeeName, record.department, record.dateKey, record.shift, formatScheduledTime(record.dateKey, schedule.checkInTime), formatTime(record.checkInAt), formatDuration(calculation.lateDurationMinutes), formatScheduledTime(record.dateKey, schedule.checkOutTime), formatTime(record.checkOutAt), formatDuration(calculation.earlyCheckoutDurationMinutes), calculation.status]; })];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${selectedHistoryUser.fullName.replaceAll(/[^a-z0-9]+/gi, "-").replaceAll(/^-|-$/g, "").toLowerCase()}-${historyStartDate}-to-${historyEndDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Attendance report exported.");
  };

  if (currentEmployeeInactive) return <main className="min-h-full bg-[#f4f8fc] p-3 text-slate-800 sm:p-5 lg:p-7"><div className="mx-auto max-w-[720px] space-y-5"><Card className="border-amber-200 bg-amber-50 shadow-sm"><CardContent className="p-6"><h1 className="text-lg font-bold text-amber-900">Attendance unavailable</h1><p className="mt-2 text-sm text-amber-800">Attendance is not available for inactive employees.</p></CardContent></Card></div></main>;

  return <main className="min-h-full bg-[#f4f8fc] p-3 text-slate-800 sm:p-5 lg:p-7"><div className="mx-auto max-w-[1800px] space-y-5">
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#061f42] via-[#0b5370] to-[#0b3b63] px-5 py-6 text-white shadow-lg sm:px-7"><div className="relative z-10 flex flex-col justify-between gap-5 md:flex-row md:items-center"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100"><ShieldCheck className="h-3.5 w-3.5" />Workforce &amp; HR</div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Attendance Management</h1><p className="mt-1 text-sm text-blue-100">Monitor attendance, working hours, and team availability in one place.</p></div><div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm"><Clock3 className="h-5 w-5 text-cyan-100" /><div><p className="text-[10px] uppercase tracking-wider text-cyan-100">Pakistan Standard Time</p><p className="text-lg font-bold">{formatTime(now.toISOString())} <span className="text-xs font-medium text-cyan-100">PKT</span></p><p className="text-[11px] text-blue-100">{formatDate(now)} · UTC+05:00</p></div></div></div></section>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="flex flex-wrap rounded-lg border border-slate-200 bg-white p-1 shadow-sm"><button onClick={() => setActiveView("overview")} className={`rounded-md px-3 py-2 text-xs font-semibold transition ${activeView === "overview" ? "bg-[#145487] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}><LayoutDashboard className="mr-1.5 inline h-3.5 w-3.5" />Overview</button><button onClick={() => setActiveView("history")} className={`rounded-md px-3 py-2 text-xs font-semibold transition ${activeView === "history" ? "bg-[#145487] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}><FileClock className="mr-1.5 inline h-3.5 w-3.5" />Attendance history</button><button onClick={() => setActiveView("requests")} className={`rounded-md px-3 py-2 text-xs font-semibold transition ${activeView === "requests" ? "bg-[#145487] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}><Palmtree className="mr-1.5 inline h-3.5 w-3.5" />Requests{pendingLeaveCount > 0 && <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">{pendingLeaveCount}</span>}</button>{isAdmin && <button onClick={() => setActiveView("settings")} className={`rounded-md px-3 py-2 text-xs font-semibold transition ${activeView === "settings" ? "bg-[#145487] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}><Settings2 className="mr-1.5 inline h-3.5 w-3.5" />Office attendance settings</button>}</div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setNow(new Date())}><RefreshCw className="h-3.5 w-3.5" />Refresh</Button><Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" />Export CSV</Button></div></div>
    {activeView === "requests" ? isAdmin ? <LeaveRequestsView isAdmin appUser={appUser} requests={leaveRequests} saving={saving} onSubmit={handleLeaveSubmit} onReview={handleLeaveReview} /> : <EmployeeLeaveRequestsView appUser={appUser} requests={leaveRequests} saving={saving} onSubmit={handleLeaveSubmit} onEdit={handleLeaveEdit} onDelete={handleLeaveDelete} /> : activeView === "settings" && isAdmin ? <WeeklyOfficeSchedule settings={attendanceSettings} saving={saving} onSave={handleSettingsSave} /> : <>
      {isAdmin ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-6"><MetricCard label="Marked today" value={String(todayRecords.length)} detail="Live attendance records" icon={Users} tone="bg-blue-50 text-blue-700" /><MetricCard label="Present Today" value={String(metrics.present.length)} detail="Checked in on time" icon={CheckCircle2} tone="bg-emerald-50 text-emerald-700" /><MetricCard label="Absent Today" value={String(metrics.absent.length)} detail={canAutoMarkAbsent ? "After office cutoff" : `Available after ${attendanceSettings.absentCutoffTime}`} icon={AlertCircle} tone="bg-red-50 text-red-700" /><MetricCard label="Late Today" value={String(metrics.late.length)} detail={`After ${selectedSchedule.checkInTime} + ${attendanceSettings.gracePeriodMinutes}m`} icon={Timer} tone="bg-amber-50 text-amber-700" /><MetricCard label="Leave Today" value={String(metrics.leave.length)} detail="Approved leave" icon={Palmtree} tone="bg-blue-50 text-blue-700" /><MetricCard label="Live sync" value={loading ? "Loading" : "Active"} detail="Firestore updates enabled" icon={ShieldCheck} tone="bg-indigo-50 text-indigo-700" /></div> : <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label="Present Days" value={String(userMonthStats.present)} detail={`${calendarMonth} · ${userMonthStats.percentage}% attendance`} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-700" /><MetricCard label="Leave Days" value={String(userMonthStats.leave)} detail={`Selected month: ${calendarMonth}`} icon={Palmtree} tone="bg-blue-50 text-blue-700" /><MetricCard label="Late Days" value={String(userMonthStats.late)} detail={`Selected month: ${calendarMonth}`} icon={Timer} tone="bg-amber-50 text-amber-700" /><MetricCard label="Absent Days" value={String(userMonthStats.absent)} detail={`Selected month: ${calendarMonth}`} icon={AlertCircle} tone="bg-red-50 text-red-700" /></div><div className="flex items-center gap-2"><label className="text-xs font-semibold text-slate-600">Attendance month<input type="month" value={calendarMonth} onChange={(event) => { setCalendarMonth(event.target.value); setSelectedDateKey(`${event.target.value}-01`); }} className="ml-2 h-8 rounded-md border border-slate-300 bg-white px-2 text-xs" /></label></div></div>}
      {isAdmin && activeView === "history" && <AdminHistoryFilters users={adminUsers} selectedUserId={selectedHistoryUserId} startDate={historyStartDate} endDate={historyEndDate} onSelectUser={setSelectedHistoryUserId} onStartDateChange={setHistoryStartDate} onEndDateChange={setHistoryEndDate} onDownload={exportHistoryCsv} />}
      {isAdmin && !fieldOnly && activeView === "overview" && <AdminAttendanceControls users={adminUsers} selectedUserId={selectedAdminUserId} selectedRecord={selectedAdminRecord} saving={saving} onSelect={setSelectedAdminUserId} onCheckIn={handleAdminCheckIn} onCheckOut={handleAdminCheckOut} onManualEntry={handleManualEntry} settings={attendanceSettings} />}
      {canUseSelfCheckIn && (activeView === "overview" || activeView === "history") && <UserAttendanceControls todayRecord={myTodayDisplayRecord} saving={saving} onCheckIn={() => setShiftDialogOpen(true)} onCheckOut={handleCheckOut} />}
      <div className={`grid min-w-0 gap-5 ${activeView === "history" ? "xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]" : ""}`}><Card className="min-w-0 border-slate-200 shadow-sm"><CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-base text-[#145487]">{isAdmin ? activeView === "history" ? `Attendance history · ${displayDateKey(selectedDateKey)}` : "Today's attendance" : activeView === "history" ? "My attendance history" : "My attendance"}</CardTitle><p className="mt-1 text-xs text-slate-500">All times shown in Pakistan Standard Time</p></div><div className="flex flex-wrap gap-2"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search attendance" className="h-8 w-40 pl-8 text-xs" /></div>{isAdmin && <Button variant="outline" size="sm" className="h-8" onClick={() => setStatusFilter(statusFilter === "All" ? "Late" : "All")}><Filter className="h-3.5 w-3.5" />{statusFilter === "All" ? "Late only" : "All records"}</Button>}</div></CardHeader><CardContent className="p-0"><AttendanceRows records={activeView === "history" ? paginatedHistoryRecords : displayedRecords} settings={attendanceSettings} showEmployee={isAdmin} />{activeView === "history" && <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="text-xs text-slate-500">Showing {displayedRecords.length ? ((currentHistoryPage - 1) * (historyPageSize === "all" ? displayedRecords.length : historyPageSize)) + 1 : 0}–{Math.min(currentHistoryPage * (historyPageSize === "all" ? displayedRecords.length : historyPageSize), displayedRecords.length)} of {displayedRecords.length} records</div><div className="flex flex-wrap items-center gap-2"><label className="text-xs font-semibold text-slate-600" htmlFor="attendance-history-page-size">Rows</label><select id="attendance-history-page-size" value={historyPageSize} onChange={(event) => { const value = event.target.value === "all" ? "all" : Number(event.target.value) as 15 | 30; setHistoryPageSize(value); setHistoryPage(1); }} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"><option value="15">15</option><option value="30">30</option><option value="all">All</option></select><Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" disabled={currentHistoryPage === 1} onClick={() => setHistoryPage((current) => current - 1)}>Previous</Button><span className="text-xs font-medium text-slate-600">Page {currentHistoryPage} of {historyPageCount}</span><Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" disabled={currentHistoryPage === historyPageCount} onClick={() => setHistoryPage((current) => current + 1)}>Next</Button></div></div>}</CardContent></Card>
        {activeView === "history" && <Card className="min-w-0 border-slate-200 shadow-sm"><CardHeader className="border-b border-slate-100 pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base text-[#145487]">Attendance calendar</CardTitle><CalendarDays className="h-4 w-4 text-slate-500" /></div><div className="flex items-center justify-between gap-2"><p className="text-xs text-slate-500">{new Intl.DateTimeFormat("en-US", { timeZone: PAKISTAN_TIME_ZONE, month: "long", year: "numeric" }).format(new Date(`${calendarMonth}-01T12:00:00Z`))}</p><input type="month" value={calendarMonth} onChange={(event) => { setCalendarMonth(event.target.value); setSelectedDateKey(`${event.target.value}-01`); }} className="h-7 rounded border border-slate-300 bg-white px-1 text-[10px]" /></div></CardHeader><CardContent className="p-4"><div className="mb-2 grid grid-cols-7 text-center text-[10px] font-semibold uppercase text-slate-400">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day}>{day}</span>)}</div><div className="grid min-w-0 grid-cols-7 gap-1.5">{Array.from({ length: firstDayOffset }, (_, index) => <span key={`empty-${index}`} aria-hidden="true" />)}{Array.from({ length: monthDays }, (_, index) => index + 1).map((day) => { const calendarDate = `${calendarMonth}-${String(day).padStart(2, "0")}`; const record = recordsByDate.get(calendarDate); const future = calendarDate > dateKey; const tone = future ? "bg-white text-slate-300" : record?.status === "Late" ? "bg-amber-100 text-amber-700" : record?.status === "Absent" ? "bg-red-100 text-red-700" : record?.status === "On Leave" ? "bg-blue-100 text-blue-700" : record ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"; return <button type="button" key={day} title={record ? `${record.status}: ${formatDuration(record.workingMinutes)}` : future ? "Not marked yet" : "No attendance record"} onClick={() => setSelectedDateKey(calendarDate)} className={`flex h-8 items-center justify-center rounded-md text-xs font-medium ${tone} ${calendarDate === selectedDateKey ? "ring-2 ring-[#145487]" : ""}`}>{day}</button>; })}</div><div className="hidden"><p className="break-words text-xs font-semibold text-slate-700">Selected date: {displayDateKey(selectedDateKey)}</p>{selectedDateRecords.length ? <div className="mt-3 space-y-2">{selectedDateRecords.map((record) => <div key={record.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3"><div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold text-slate-800">{record.employeeName}</p><StatusBadge status={record.status} /></div><p className="mt-1 text-[11px] text-slate-500">In {formatTime(record.checkInAt)} · Out {formatTime(record.checkOutAt)}</p><p className="text-[11px] text-slate-500">{record.status === "Late" ? `Late ${formatDuration(Math.max(0, getPakistanMinutes(new Date(record.checkInAt || 0)) - timeToMinutes(getSchedule(attendanceSettings, selectedDateKey).checkInTime)))}` : record.note || record.status}</p></div>)}</div> : <p className="mt-2 text-xs text-slate-500">No attendance history for this date.</p>}</div></CardContent></Card>}
      </div>
    </>}
      {isAdmin && activeView === "history" && <AdminAttendanceSummary rows={filteredAllUsersHistorySummary} startDate={historyStartDate} endDate={historyEndDate} search={summarySearch} onSearch={setSummarySearch} onDownload={exportAllUsersHistoryCsv} />}
      {canUseSelfCheckIn && <ShiftCheckInDialog open={shiftDialogOpen} saving={saving} onClose={() => setShiftDialogOpen(false)} onOffice={handleOfficeCheckIn} onField={handleFieldCheckIn} />}
  </div></main>;
}
