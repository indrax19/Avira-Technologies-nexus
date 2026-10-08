import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { jsPDF as JsPDF } from "jspdf";
import { useLocation } from "react-router-dom";
import { ArrowLeft, CalendarDays, CarFront, Check, CheckCircle2, ClipboardList, Copy, Download, Eye, FileText, Pencil, Plus, Printer, Search, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { employeeRequestsAPI, type EmployeeRequest, type EmployeeRequestType } from "@/integrations/firebase/employeeRequestsAPI";
import { rentalVehicleRequestsAPI } from "@/integrations/firebase/rentalVehicleRequestsAPI";
import { usersAPI, type User } from "@/integrations/firebase/usersAPI";
import { createRequestNumber } from "@/lib/requestNumber";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type RequestType = "loan" | "advance-salary" | "rental-car" | "room-rent";
type FieldType = "text" | "number" | "date" | "month" | "time" | "textarea" | "select";
type FieldDefinition = { key: string; label: string; type?: FieldType; options?: string[]; required?: boolean; placeholder?: string; readOnly?: boolean; min?: string; step?: string };
type RequestDefinition = { title: string; code: string; description: string; sections: { title: string; fields: FieldDefinition[] }[] };
type RequestRecord = { id?: string; request_no: string; request_type: RequestType; status: "Draft" | "Pending Approval" | "Approved"; requested_by: string; submitted_by?: string; submitted_by_email?: string; created_at: string; updated_at?: string; created_by?: string; owner_uid?: string; owner_email?: string; approved_by?: string; approved_by_email?: string; approved_at?: string; fields: Record<string, string> };
type FormMode = "new" | "edit" | "view";
type ActionConfirm = { type: "approve" | "delete"; requestNo: string };

const definitions: Record<RequestType, RequestDefinition> = {
  loan: {
    title: "Loan Form", code: "LOAN", description: "Employee loan request and repayment details",
    sections: [
      { title: "Employee Information", fields: [{ key: "requested_by", label: "Requested By", readOnly: true }, { key: "department", label: "Department", type: "select", required: true, options: ["Administration", "Engineering", "Finance", "Human Resources", "IT", "Operations", "Projects"] }, { key: "company", label: "Company", type: "select", required: true, options: ["Avira Technologies", "Avira Technologies (Pvt.) Ltd."] }] },
      { title: "Loan Details", fields: [{ key: "loan_amount", label: "Loan Amount (PKR)", type: "number", required: true, min: "1" }, { key: "loan_purpose", label: "Loan Purpose", type: "select", required: true, options: ["Personal", "Medical", "Education", "Emergency", "Other"] }, { key: "repayment_tenure", label: "Repayment Tenure (Months)", type: "number", required: true, min: "1", step: "1" }, { key: "repayment_start_date", label: "Repayment Start Date", type: "date", required: true }, { key: "monthly_installment", label: "Estimated Monthly Installment (PKR)", type: "number", readOnly: true }, { key: "reason", label: "Reason / Supporting Details", type: "textarea", required: true }] },

    ],
  },
  "advance-salary": {
    title: "Advance Salary Form", code: "ADV", description: "Request an advance against your salary",
    sections: [
      { title: "Employee Information", fields: [{ key: "requested_by", label: "Requested By", readOnly: true }, { key: "department", label: "Department", type: "select", required: true, options: ["Administration", "Engineering", "Finance", "Human Resources", "IT", "Operations", "Projects"] }, { key: "company", label: "Company", type: "select", required: true, options: ["Avira Technologies", "Avira Technologies (Pvt.) Ltd."] }] },
      { title: "Advance Details", fields: [{ key: "advance_amount", label: "Advance Amount (PKR)", type: "number", required: true, min: "1" }, { key: "salary_month", label: "Salary Month", type: "month", required: true }, { key: "repayment_method", label: "Repayment Method", type: "select", required: true, options: ["Deduct from next salary", "Split over multiple months", "Other"] }, { key: "installments", label: "Number of Installments", type: "number", min: "1", step: "1" }, { key: "reason", label: "Reason for Advance", type: "textarea", required: true }] },

    ],
  },
  "rental-car": {
    title: "Rental Vehicle Form", code: "VEH", description: "Request a rental vehicle for business travel",
    sections: [
      { title: "Request Information", fields: [{ key: "requested_by", label: "Requested By" }, { key: "project", label: "Project / POC", required: true }, { key: "purpose", label: "Travel Purpose", required: true }] },
      { title: "Rental Details", fields: [{ key: "vehicle_type", label: "Vehicle Type", type: "select", required: true, options: ["Economy Sedan", "Executive Sedan", "SUV", "Van", "Pickup"] }, { key: "pickup_date", label: "Pickup Date", type: "date", required: true }, { key: "pickup_time", label: "Pickup Time", type: "time" }, { key: "return_date", label: "Return Date", type: "date", required: true }, { key: "pickup_location", label: "Pickup Location", required: true }, { key: "destination", label: "Destination", required: true }, { key: "passengers", label: "Number of Passengers", type: "number", min: "1", step: "1" }, { key: "driver_required", label: "Driver Required", type: "select", required: true, options: ["Yes", "No"] }, { key: "fuel", label: "Fuel (PKR)", type: "number", min: "0", step: "1" }, { key: "toll", label: "Toll (PKR)", type: "number", min: "0", step: "1" }, { key: "estimated_cost", label: "Estimated Rental Cost (PKR)", type: "number", min: "0" }, { key: "other_amount", label: "Other Amount (PKR)", type: "number", min: "0", step: "1" }, { key: "advance_payment", label: "Advance Payment (PKR)", type: "number", min: "0", step: "1" }, { key: "remarks", label: "Travel Notes", type: "textarea" }] },
    ],
  },
  "room-rent": {
    title: "Room Rent Form", code: "ROOM", description: "Request accommodation for a work assignment",
    sections: [
      { title: "Employee & Assignment", fields: [{ key: "requested_by", label: "Requested By", readOnly: true }, { key: "department", label: "Department", type: "select", required: true, options: ["Administration", "Engineering", "Finance", "IT", "Operations", "Projects"] }, { key: "project", label: "Project / POC", required: true }, { key: "site_location", label: "Site / Location", required: true }] },
      { title: "Accommodation Details", fields: [{ key: "room_type", label: "Room Type", type: "select", required: true, options: ["Single Room", "Shared Room", "Apartment", "Guest House"] }, { key: "check_in_date", label: "Check-in Date", type: "date", required: true }, { key: "check_out_date", label: "Check-out Date", type: "date", required: true }, { key: "occupants", label: "Number of Occupants", type: "number", required: true, min: "1", step: "1" }, { key: "monthly_rent", label: "Rent / Accommodation Cost (PKR)", type: "number", required: true, min: "0" }, { key: "landlord_contact", label: "Landlord / Property Contact" }, { key: "property_address", label: "Property Address", type: "textarea", required: true }, { key: "remarks", label: "Additional Requirements", type: "textarea" }] },
    ],
  },
};

const inputClass = "h-9 w-full rounded border border-slate-200 bg-white px-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-600";
const readOnlyClass = "h-9 w-full rounded border border-blue-100 bg-blue-50/70 px-2.5 text-sm font-medium text-slate-700 outline-none";
const storageKey = (type: RequestType) => `nexus.hr.${type}.requests.v1`;
const readRequests = (type: RequestType): RequestRecord[] => {
  try {
    return JSON.parse(localStorage.getItem(storageKey(type)) || "[]") as RequestRecord[];
  } catch {
    return [];
  }
};
const legacyRentalRequestId = (record: RequestRecord) => `legacy_${encodeURIComponent(`${record.request_no}_${record.requested_by}_${record.created_at}`)}`;
const legacyRequestId = (type: EmployeeRequestType, record: RequestRecord) => `legacy_${encodeURIComponent(`${type}_${record.request_no}_${record.requested_by}_${record.created_at}`)}`;
const isEmployeeRequestType = (type: RequestType): type is EmployeeRequestType => type !== "rental-car";
const formatMoney = (amount: number) => `PKR ${Math.round(amount).toLocaleString("en-PK")}`;
const rentalTotals = (fields: Record<string, string>) => {
  const rentalCost = Number(fields.estimated_cost) || 0;
  const fuel = Number(fields.fuel) || 0;
  const toll = Number(fields.toll) || 0;
  const otherAmount = Number(fields.other_amount) || 0;
  const advancePayment = Number(fields.advance_payment) || 0;
  const total = rentalCost + fuel + toll + otherAmount;
  return { rentalCost, fuel, toll, otherAmount, total, advancePayment, netTotal: total - advancePayment };
};
const makeRequestNo = (code: string) => createRequestNumber(code);
const recordSummary = (type: RequestType, record: RequestRecord) => {
  if (type === "loan") return `${formatMoney(Number(record.fields.loan_amount || 0))} · ${record.fields.repayment_tenure || "—"} months`;
  if (type === "advance-salary") return `${formatMoney(Number(record.fields.advance_amount || 0))} · ${record.fields.salary_month || "Salary month not set"}`;
  if (type === "rental-car") return `${record.fields.vehicle_type || "Rental vehicle"} · ${record.fields.destination || "Destination not set"}`;
  return `${record.fields.room_type || "Accommodation"} · ${record.fields.site_location || record.fields.project || "Assignment not set"}`;
};
const formatCreatedDate = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

async function createRequestPdf(definition: RequestDefinition, record: RequestRecord) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const pdf = new jsPDF("p", "mm", "a4");
  const margin = 13;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const blue: [number, number, number] = [6, 37, 93];
  const red: [number, number, number] = [220, 38, 38];
  const slate: [number, number, number] = [30, 41, 59];
  const border: [number, number, number] = [203, 213, 225];
  let y = 42;

  pdf.setFillColor(...blue);
  pdf.rect(0, 0, pageWidth, 35, "F");
  pdf.setFillColor(...red);
  pdf.rect(0, 33, pageWidth, 2, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  const isRentalVehicle = record.request_type === "rental-car";
  if (isRentalVehicle) {
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.7);
    pdf.roundedRect(margin, 9.5, 13, 5.5, 1, 1, "S");
    pdf.line(margin + 3, 9.5, margin + 5, 7);
    pdf.line(margin + 5, 7, margin + 9.5, 7);
    pdf.line(margin + 9.5, 7, margin + 12, 9.5);
    pdf.circle(margin + 4, 15, 1.2, "S");
    pdf.circle(margin + 10, 15, 1.2, "S");
  }
  pdf.text(isRentalVehicle ? "Rental Vehicle" : definition.title.replace(" Form", "").toUpperCase(), margin + (isRentalVehicle ? 17 : 0), 15);
  pdf.setFontSize(9.5);
  pdf.text("WORKFORCE & HR REQUEST", margin, 21);
  pdf.setFontSize(10.5);
  pdf.text(`Request No. ${record.request_no}`, pageWidth - margin, 15, { align: "right" });
  pdf.text(`Status: ${record.status}`, pageWidth - margin, 21, { align: "right" });

  for (const [index, section] of definition.sections.entries()) {
    if (y > pageHeight - 36) {
      pdf.addPage();
      y = 16;
    }
    pdf.setFillColor(239, 246, 255);
    pdf.setDrawColor(...border);
    pdf.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, "FD");
    pdf.setFillColor(...red);
    pdf.circle(margin + 5, y + 4, 2.7, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(String(index + 1), margin + 5, y + 5, { align: "center" });
    pdf.setTextColor(...blue);
    pdf.setFontSize(9.5);
    pdf.text(section.title.toUpperCase(), margin + 10, y + 5.2);

    const body = section.fields.map((field) => {
      const rawValue = String(record.fields[field.key] || "").trim();
      const value = /amount|cost|rent|installment|fuel|toll|payment/i.test(field.key) && rawValue ? formatMoney(Number(rawValue)) : rawValue || "—";
      return [field.label, value];
    });
    const rows = Array.from({ length: Math.ceil(body.length / 3) }, (_, rowIndex) =>
      Array.from({ length: 3 }, (_, columnIndex) => body[rowIndex * 3 + columnIndex] || ["", ""]).flat(),
    );
    autoTable(pdf, {
      startY: y + 10,
      margin: { left: margin, right: margin, bottom: 20 },
      theme: "grid",
      body: rows,
      bodyStyles: { fontSize: 7, cellPadding: 1.8, textColor: slate, lineColor: border, lineWidth: 0.2, valign: "middle" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 20, fontStyle: "bold", fillColor: [248, 250, 252] }, 1: { cellWidth: 41.333 },
        2: { cellWidth: 20, fontStyle: "bold", fillColor: [248, 250, 252] }, 3: { cellWidth: 41.333 },
        4: { cellWidth: 20, fontStyle: "bold", fillColor: [248, 250, 252] }, 5: { cellWidth: 41.334 },
      },
      rowPageBreak: "avoid",
    });
    y = ((pdf as JsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 10) + 7;
  }

  if (record.request_type === "rental-car") {
    const totals = rentalTotals(record.fields);
    const summaryHeight = 47;
    if (y + summaryHeight > pageHeight - 20) {
      pdf.addPage();
      y = 16;
    }
    pdf.setFillColor(239, 246, 255);
    pdf.setDrawColor(...border);
    pdf.roundedRect(margin, y, contentWidth, summaryHeight, 1.5, 1.5, "FD");
    pdf.setFillColor(...red);
    pdf.roundedRect(margin + 3, y + 3, 2, 4, 0.5, 0.5, "F");
    pdf.setTextColor(...blue);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("COST SUMMARY", margin + 8, y + 6);

    const drawSummaryRow = (items: [string, number][], top: number, highlighted = false) => {
      const gap = 2;
      const itemWidth = (contentWidth - gap * (items.length - 1)) / items.length;
      items.forEach(([label, amount], index) => {
        const x = margin + index * (itemWidth + gap);
        const isHighlighted = highlighted && index === items.length - 1;
        pdf.setFillColor(...(isHighlighted ? blue : [255, 255, 255] as [number, number, number]));
        pdf.setDrawColor(...(isHighlighted ? blue : border));
        pdf.roundedRect(x, top, itemWidth, 16, 1, 1, "FD");
        pdf.setTextColor(...(isHighlighted ? [255, 255, 255] as [number, number, number] : slate));
        pdf.setFont("helvetica", isHighlighted ? "bold" : "normal");
        pdf.setFontSize(6.7);
        pdf.text(label, x + itemWidth / 2, top + 5, { align: "center" });
        pdf.setFontSize(isHighlighted ? 8.5 : 7.8);
        pdf.text(formatMoney(amount), x + itemWidth / 2, top + 12, { align: "center" });
      });
    };
    drawSummaryRow([
      ["Rental Cost", totals.rentalCost], ["Fuel", totals.fuel], ["Toll", totals.toll], ["Other Amount", totals.otherAmount],
    ], y + 9);
    drawSummaryRow([
      ["Gross Total", totals.total], ["Advance Paid", totals.advancePayment], ["Net Total", totals.netTotal],
    ], y + 28, true);
    y += summaryHeight + 7;
  }

  if (record.status === "Approved" && record.approved_by) {
    const signatureHeight = 34;
    if (y + signatureHeight > pageHeight - 20) {
      pdf.addPage();
      y = 16;
    }
    pdf.setFillColor(236, 253, 245);
    pdf.setDrawColor(167, 243, 208);
    pdf.roundedRect(margin, y, contentWidth, signatureHeight, 1.5, 1.5, "FD");
    pdf.setFillColor(5, 150, 105);
    pdf.circle(margin + 7, y + 8, 3.2, "F");
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.7);
    pdf.line(margin + 5.3, y + 8, margin + 6.5, y + 9.2);
    pdf.line(margin + 6.5, y + 9.2, margin + 8.8, y + 6.8);
    pdf.setTextColor(6, 95, 70);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("ELECTRONIC APPROVAL", margin + 13, y + 8.8);
    pdf.setFont("times", "italic");
    pdf.setFontSize(14);
    pdf.text(record.approved_by, margin + 13, y + 18);
    pdf.setTextColor(...slate);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    if (record.approved_by_email) pdf.text(record.approved_by_email, margin + 13, y + 24);
    if (record.approved_at) pdf.text(`Approved ${new Date(record.approved_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, margin + 13, y + 29);
    pdf.setDrawColor(5, 150, 105);
    pdf.roundedRect(pageWidth - margin - 33, y + 8, 29, 12, 1.5, 1.5, "S");
    pdf.setTextColor(5, 150, 105);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("APPROVED", pageWidth - margin - 18.5, y + 15.5, { align: "center" });
    y += signatureHeight + 7;
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
}

export default function RequestTypeForm() {
  const { pathname } = useLocation();
  const routeType = pathname.slice("/request-form/".length);
  const type = (routeType in definitions ? routeType : "loan") as RequestType;
  const definition = definitions[type];
  const { appUser, firebaseUser, isAdmin } = useAuth();
  const requestedBy = appUser?.fullName || firebaseUser?.displayName || "Current User";
  const [users, setUsers] = useState<User[]>([]);
  const [requestedUserId, setRequestedUserId] = useState("");
  const requestedUser = users.find((user) => user.id === requestedUserId) || appUser || null;
  const [records, setRecords] = useState<RequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("new");
  const [selectedRecord, setSelectedRecord] = useState<RequestRecord | null>(null);
  const [requestNo, setRequestNo] = useState("");
  const [status, setStatus] = useState<RequestRecord["status"]>("Draft");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageSize, setPageSize] = useState<number | "all">(15);
  const [page, setPage] = useState(1);
  const initialValues = useMemo(() => {
    const values: Record<string, string> = { requested_by: requestedBy };
    definition.sections.flatMap((section) => section.fields).forEach((field) => { values[field.key] = ""; });
    values.requested_by = requestedBy;
    return values;
  }, [definition, requestedBy]);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [actionConfirm, setActionConfirm] = useState<ActionConfirm | null>(null);
  const [saving, setSaving] = useState(false);
  const isReadOnly = formMode === "view";

  useEffect(() => {
    if (!isAdmin) return;
    usersAPI.getAll().then(setUsers).catch(() => toast.error("Could not load users for request assignment."));
  }, [isAdmin]);

  useEffect(() => {
    if (appUser && !requestedUserId) setRequestedUserId(appUser.id);
  }, [appUser, requestedUserId]);

  useEffect(() => {
    setShowForm(false);
    setFormMode("new");
    setSelectedRecord(null);
    setStatus("Draft");
    setSearch("");
    setStatusFilter(type === "rental-car" ? "Pending Approval" : "");
    setPage(1);
    setValues(initialValues);
    setErrors({});
    setConfirmSubmit(false);
    setActionConfirm(null);

    if (type === "rental-car") {
      setRecords([]);
      setIsLoading(true);
      setLoadError(false);
      let migrationStarted = false;
      const migrationKey = "nexus.hr.rental-car.firebase-migrated.v1";
      const subscribe = isAdmin ? rentalVehicleRequestsAPI.subscribeAll : (callback: Parameters<typeof rentalVehicleRequestsAPI.subscribeAll>[0], onError: Parameters<typeof rentalVehicleRequestsAPI.subscribeAll>[1]) => rentalVehicleRequestsAPI.subscribeByOwner(firebaseUser?.uid || "", callback, onError);
      const unsubscribe = subscribe(
        (nextRecords, fromCache) => {
          setRecords(nextRecords);
          setIsLoading(false);
          setLoadError(false);
          if (fromCache || migrationStarted || localStorage.getItem(migrationKey) === "true") return;
          migrationStarted = true;
          const existingIds = new Set(nextRecords.map((record) => record.id));
          const legacyRequests = readRequests("rental-car").filter((record) => !existingIds.has(legacyRentalRequestId(record)));
          if (!legacyRequests.length) {
            localStorage.setItem(migrationKey, "true");
            return;
          }
          void Promise.all(legacyRequests.map((record) => {
            const createdAt = record.created_at || new Date().toISOString();
            const ownerUid = record.owner_uid || record.created_by || firebaseUser?.uid || "";
            return rentalVehicleRequestsAPI.create({
              ...record,
              request_type: "rental-car",
              updated_at: record.updated_at || createdAt,
              created_by: record.created_by || firebaseUser?.uid || appUser?.id || "",
              owner_uid: ownerUid,
              owner_email: record.owner_email || firebaseUser?.email || appUser?.email || "",
            }, legacyRentalRequestId(record));
          })).then(() => {
            localStorage.setItem(migrationKey, "true");
            toast.success("Existing Rental Vehicle requests were migrated to Firebase.");
          }).catch((error: unknown) => {
            migrationStarted = false;
            toast.error("Could not migrate existing Rental Vehicle requests to Firebase.", { description: error instanceof Error ? error.message : "Please try again." });
          });
        },
        (error) => {
          setIsLoading(false);
          setLoadError(true);
          toast.error("Could not load Rental Vehicle requests from Firebase.", { description: error.message });
        },
      );
      return unsubscribe;
    }

    if (isEmployeeRequestType(type)) {
      setRecords([]);
      setIsLoading(true);
      setLoadError(false);
      let migrationStarted = false;
      const migrationKey = `nexus.hr.${type}.firebase-migrated.v1`;
      const unsubscribe = isAdmin
        ? employeeRequestsAPI.subscribeAll(type, (nextRecords, fromCache) => {
          setRecords(nextRecords);
          setIsLoading(false);
          setLoadError(false);
          if (fromCache || migrationStarted || localStorage.getItem(migrationKey) === "true") return;
          migrationStarted = true;
          const existingIds = new Set(nextRecords.map((record) => record.id));
          const legacyRequests = readRequests(type).filter((record) => !existingIds.has(legacyRequestId(type, record)));
          if (!legacyRequests.length) {
            localStorage.setItem(migrationKey, "true");
            return;
          }
          void Promise.all(legacyRequests.map((record) => {
            const createdAt = record.created_at || new Date().toISOString();
            const ownerUid = record.owner_uid || record.created_by || firebaseUser?.uid || "";
            return employeeRequestsAPI.create(type, {
              ...record,
              request_type: type,
              updated_at: record.updated_at || createdAt,
              created_by: record.created_by || firebaseUser?.uid || appUser?.id || "",
              owner_uid: ownerUid,
              owner_email: record.owner_email || firebaseUser?.email || appUser?.email || "",
            }, legacyRequestId(type, record));
          })).then(() => {
            localStorage.setItem(migrationKey, "true");
            toast.success(`Existing ${definition.title.replace(" Form", "")} requests were migrated to Firebase.`);
          }).catch((error: unknown) => {
            migrationStarted = false;
            toast.error(`Could not migrate existing ${definition.title.replace(" Form", "")} requests to Firebase.`, { description: error instanceof Error ? error.message : "Please try again." });
          });
        },
        (error) => {
          setIsLoading(false);
          setLoadError(true);
          toast.error(`Could not load ${definition.title.replace(" Form", "")} requests from Firebase.`, { description: error.message });
        })
        : employeeRequestsAPI.subscribeByOwner(type, firebaseUser?.uid || "", (nextRecords, fromCache) => {
          setRecords(nextRecords);
          setIsLoading(false);
          setLoadError(false);
          if (fromCache || migrationStarted || localStorage.getItem(migrationKey) === "true") return;
          migrationStarted = true;
          const existingIds = new Set(nextRecords.map((record) => record.id));
          const legacyRequests = readRequests(type).filter((record) => !existingIds.has(legacyRequestId(type, record)));
          if (!legacyRequests.length) {
            localStorage.setItem(migrationKey, "true");
            return;
          }
          void Promise.all(legacyRequests.map((record) => {
            const createdAt = record.created_at || new Date().toISOString();
            const ownerUid = record.owner_uid || record.created_by || firebaseUser?.uid || "";
            return employeeRequestsAPI.create(type, {
              ...record,
              request_type: type,
              updated_at: record.updated_at || createdAt,
              created_by: record.created_by || firebaseUser?.uid || appUser?.id || "",
              owner_uid: ownerUid,
              owner_email: record.owner_email || firebaseUser?.email || appUser?.email || "",
            }, legacyRequestId(type, record));
          })).then(() => {
            localStorage.setItem(migrationKey, "true");
          }).catch((error: unknown) => {
            migrationStarted = false;
            toast.error(`Could not migrate existing ${definition.title.replace(" Form", "")} requests to Firebase.`, { description: error instanceof Error ? error.message : "Please try again." });
          });
        }, (error) => {
          setIsLoading(false);
          setLoadError(true);
          toast.error(`Could not load ${definition.title.replace(" Form", "")} requests from Firebase.`, { description: error.message });
        });
      return unsubscribe;
    }

    setRecords([]);
    setIsLoading(false);
    setLoadError(false);
    setRequestNo("");
  }, [type, definition.code, definition.title, initialValues, firebaseUser?.uid, firebaseUser?.email, appUser?.id, appUser?.email, isAdmin]);

  const update = (key: string, value: string) => {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (type === "loan" && (key === "loan_amount" || key === "repayment_tenure")) {
        const amount = Number(next.loan_amount || 0);
        const months = Number(next.repayment_tenure || 0);
        next.monthly_installment = amount && months ? String(Math.ceil(amount / months)) : "";
      }
      return next;
    });
    setErrors((current) => ({ ...current, [key]: "" }));
  };
  const validate = () => {
    const next: Record<string, string> = {};
    definition.sections.flatMap((section) => section.fields).forEach((field) => {
      if (field.required && !String(values[field.key] || "").trim()) next[field.key] = "This field is required.";
      if (field.type === "number" && values[field.key] && Number(values[field.key]) < Number(field.min || 0)) next[field.key] = `Enter a value of at least ${field.min || 0}.`;
    });
    const datePairs: [string, string, string][] = type === "rental-car" ? [["pickup_date", "return_date", "Return date cannot be before pickup date."]] : type === "room-rent" ? [["check_in_date", "check_out_date", "Check-out date cannot be before check-in date."]] : [];
    datePairs.forEach(([start, end, message]) => { if (values[start] && values[end] && values[end] < values[start]) next[end] = message; });
    setErrors(next);
    return !Object.keys(next).length;
  };
  const save = async (nextStatus: RequestRecord["status"]) => {
    if (isAdmin && formMode === "new" && !requestedUserId) {
      toast.error("Select the user this request is for.");
      return;
    }
    const now = new Date().toISOString();
    const record: RequestRecord = {
      request_no: requestNo,
      request_type: type,
      status: nextStatus,
      requested_by: isAdmin && formMode === "new" ? requestedUser?.fullName || requestedBy : values.requested_by?.trim() || requestedBy,
      created_at: selectedRecord?.created_at || now,
      updated_at: now,
      created_by: selectedRecord?.created_by || firebaseUser?.uid || appUser?.id || "",
      owner_uid: selectedRecord?.owner_uid || selectedRecord?.created_by || (isAdmin && formMode === "new" ? requestedUser?.id : firebaseUser?.uid) || firebaseUser?.uid || "",
      owner_email: selectedRecord?.owner_email || (isAdmin && formMode === "new" ? requestedUser?.email : firebaseUser?.email) || firebaseUser?.email || "",
      submitted_by: firebaseUser?.uid || appUser?.id || "",
      submitted_by_email: firebaseUser?.email || appUser?.email || "",
      fields: values,
    };
    setSaving(true);
    try {
      let savedRecord = record;
      if (type === "rental-car") {
        const rentalRecord = {
          ...record,
          request_type: "rental-car" as const,
          updated_at: now,
          created_by: record.created_by || firebaseUser?.uid || appUser?.id || "",
        };
        if (selectedRecord?.id) {
          await rentalVehicleRequestsAPI.update({ ...rentalRecord, id: selectedRecord.id });
          savedRecord = { ...rentalRecord, id: selectedRecord.id };
        } else {
          savedRecord = await rentalVehicleRequestsAPI.create(rentalRecord);
        }
        setRecords((current) => [savedRecord, ...current.filter((item) => item.request_no !== savedRecord.request_no)]);
      } else if (isEmployeeRequestType(type)) {
        const employeeRecord = {
          ...record,
          request_type: type,
          updated_at: now,
          created_by: record.created_by || firebaseUser?.uid || appUser?.id || "",
        };
        if (selectedRecord?.id) {
          await employeeRequestsAPI.update(type, { ...employeeRecord, id: selectedRecord.id } as EmployeeRequest);
          savedRecord = { ...employeeRecord, id: selectedRecord.id };
        } else {
          savedRecord = await employeeRequestsAPI.create(type, employeeRecord);
        }
        setRecords((current) => [savedRecord, ...current.filter((item) => item.request_no !== savedRecord.request_no)]);
      }
      toast.success(nextStatus === "Draft" ? `${definition.title} saved as draft` : `${definition.title} submitted successfully`, { description: `Request No. ${requestNo}` });
      setConfirmSubmit(false);
      setShowForm(false);
      setFormMode("new");
      setSelectedRecord(null);
      setStatus("Draft");
      setRequestNo("");
      setValues(initialValues);
      setErrors({});
    } catch (error) {
      toast.error(`Could not save ${definition.title} to Firebase.`, { description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  };
  const submit = async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    await save("Pending Approval");
  };
  const openNewRequest = async () => {
    if (isLoading || loadError) return;
    try {
      const nextRequestNo = await makeRequestNo(definition.code);
      setRequestedUserId(appUser?.id || "");
      setFormMode("new");
      setSelectedRecord(null);
      setStatus("Draft");
      setRequestNo(nextRequestNo);
      setValues(initialValues);
      setErrors({});
      setShowForm(true);
    } catch (error) {
      toast.error("Could not generate a request number.", { description: error instanceof Error ? error.message : "Please try again." });
    }
  };
  const openRecord = (record: RequestRecord, mode: FormMode) => {
    if (mode === "edit" && !isAdmin && (record.owner_uid || record.created_by) !== firebaseUser?.uid) return;
    setSelectedRecord(record);
    setFormMode(mode);
    setRequestNo(record.request_no);
    setStatus(record.status);
    setValues({ ...record.fields });
    setErrors({});
    setShowForm(true);
  };
  const closeForm = () => {
    setShowForm(false);
    setFormMode("new");
    setSelectedRecord(null);
    setErrors({});
  };
  const duplicateRecord = async (record: RequestRecord) => {
    const now = new Date().toISOString();
    try {
      const copy: RequestRecord = {
        ...record,
        request_no: await makeRequestNo(definition.code),
        status: "Pending Approval",
        created_at: now,
        updated_at: now,
        created_by: firebaseUser?.uid || appUser?.id || "",
        owner_uid: isAdmin ? record.owner_uid || record.created_by : firebaseUser?.uid || "",
        owner_email: isAdmin ? record.owner_email : firebaseUser?.email || "",
        submitted_by: firebaseUser?.uid || appUser?.id || "",
        submitted_by_email: firebaseUser?.email || appUser?.email || "",
        approved_by: undefined,
        approved_by_email: undefined,
        approved_at: undefined,
      };
      if (type === "rental-car") {
        await rentalVehicleRequestsAPI.create({
          ...copy,
          request_type: "rental-car",
          updated_at: now,
          created_by: copy.created_by || firebaseUser?.uid || appUser?.id || "",
        });
      } else if (isEmployeeRequestType(type)) {
        await employeeRequestsAPI.create(type, {
          ...copy,
          request_type: type,
          updated_at: now,
          created_by: copy.created_by || firebaseUser?.uid || appUser?.id || "",
        });
      }
      toast.success(`Duplicated as ${copy.request_no}`);
    } catch (error) {
      toast.error("Could not duplicate the request.", { description: error instanceof Error ? error.message : "Please try again." });
    }
  };
  const confirmAction = async () => {
    if (!actionConfirm || !isAdmin) return;
    const record = records.find((item) => item.request_no === actionConfirm.requestNo);
    if (!record) return;
    try {
      if (type === "rental-car" && record.id) {
        if (actionConfirm.type === "approve") {
          const approvedAt = new Date().toISOString();
          await rentalVehicleRequestsAPI.approve(
            record.id,
            appUser?.fullName || firebaseUser?.displayName || firebaseUser?.email || "Current User",
            appUser?.email || firebaseUser?.email || undefined,
            approvedAt,
          );
        } else {
          await rentalVehicleRequestsAPI.delete(record.id);
        }
      } else if (isEmployeeRequestType(type) && record.id) {
        if (actionConfirm.type === "approve") {
          const approvedAt = new Date().toISOString();
          await employeeRequestsAPI.approve(
            type,
            record.id,
            appUser?.fullName || firebaseUser?.displayName || firebaseUser?.email || "Current User",
            appUser?.email || firebaseUser?.email || undefined,
            approvedAt,
          );
        } else {
          await employeeRequestsAPI.delete(type, record.id);
        }
      }
      toast.success(actionConfirm.type === "approve" ? "Request approved" : "Request deleted");
      setActionConfirm(null);
    } catch (error) {
      toast.error(`Could not ${actionConfirm.type === "approve" ? "approve" : "delete"} the request.`, { description: error instanceof Error ? error.message : "Please try again." });
    }
  };
  const downloadPdf = async (record: RequestRecord) => {
    try {
      const pdf = await createRequestPdf(definition, record);
      pdf.save(`${record.request_no}-${type}-request.pdf`);
    } catch {
      toast.error("Could not generate the request PDF.");
    }
  };
  const printRequest = async (record: RequestRecord) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow pop-ups to view or print this request.");
      return;
    }
    try {
      const pdf = await createRequestPdf(definition, record);
      printWindow.addEventListener("load", () => printWindow.print(), { once: true });
      printWindow.location.href = String(pdf.output("bloburl"));
    } catch {
      printWindow.close();
      toast.error("Could not generate the request PDF.");
    }
  };
  const filteredRecords = useMemo(() => records.filter((record) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [record.request_no, record.requested_by, recordSummary(type, record)].some((value) => value.toLowerCase().includes(query));
    const matchesStatus = !statusFilter || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [records, search, statusFilter, type]);
  const pageCount = pageSize === "all" ? 1 : Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedRecords = pageSize === "all" ? filteredRecords : filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstVisible = filteredRecords.length ? (pageSize === "all" ? 1 : (currentPage - 1) * pageSize + 1) : 0;
  const lastVisible = pageSize === "all" ? filteredRecords.length : Math.min(currentPage * pageSize, filteredRecords.length);
  const formatPdfRecord = (): RequestRecord => ({
    request_no: requestNo,
    request_type: type,
    status: formMode === "new" ? "Draft" : status,
    requested_by: values.requested_by?.trim() || requestedBy,
    created_at: selectedRecord?.created_at || new Date().toISOString(),
    approved_by: status === "Approved" ? selectedRecord?.approved_by : undefined,
    approved_by_email: status === "Approved" ? selectedRecord?.approved_by_email : undefined,
    approved_at: status === "Approved" ? selectedRecord?.approved_at : undefined,
    fields: values,
  });

  if (!showForm) return <div className="min-h-full bg-slate-50/70 px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:px-7 sm:py-6">
        <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700">{type === "rental-car" ? <CarFront className="h-3.5 w-3.5" /> : <ClipboardList className="h-3.5 w-3.5" />} Workforce &amp; HR</div><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{definition.title.replace(" Form", " Requests")}</h1><p className="mt-1 text-sm text-slate-500">{definition.description}</p></div>
        <button onClick={openNewRequest} disabled={isLoading || loadError} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" /> Add New Request</button>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ClipboardList className="h-5 w-5" /></span><div><p className="text-xs font-medium text-slate-500">Total Requests</p><p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{records.length}</p></div></div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><FileText className="h-5 w-5" /></span><div><p className="text-xs font-medium text-slate-500">Pending Approval</p><p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{records.filter((record) => record.status === "Pending Approval").length}</p></div></div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><CalendarDays className="h-5 w-5" /></span><div><p className="text-xs font-medium text-slate-500">Approved</p><p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{records.filter((record) => record.status === "Approved").length}</p></div></div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Search className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-slate-900">Search &amp; Filters</h2><p className="text-xs text-slate-500">Find requests by number, requester, or details</p></div></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Request No. / Details</span><input className={inputClass} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search requests" /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Status</span><select className={inputClass} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="Draft">Draft</option><option value="Pending Approval">Pending Approval</option><option value="Approved">Approved</option></select></label><div className="flex items-end"><button onClick={() => { setSearch(""); setStatusFilter(""); setPage(1); }} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"><X className="h-4 w-4" /> Reset</button></div></div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:px-5"><div><h2 className="text-base font-bold text-slate-900">{definition.title.replace(" Form", " Requests")}</h2><p className="mt-0.5 text-xs text-slate-500">{filteredRecords.length} {filteredRecords.length === 1 ? "request" : "requests"}{search || statusFilter ? " found" : " in total"}</p></div><div className="flex flex-wrap items-center gap-3"><label className="hidden items-center gap-2 text-xs font-medium text-slate-600">Rows per page<select className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700" value={pageSize} onChange={(event) => { setPageSize(event.target.value === "all" ? "all" : Number(event.target.value)); setPage(1); }}><option value="15">15</option><option value="30">30</option><option value="100">100</option><option value="all">All</option></select></label><div className="hidden items-center gap-2 text-xs text-slate-600"><span className="hidden sm:inline">{firstVisible}–{lastVisible} / {filteredRecords.length}</span><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1} className="rounded border border-slate-200 px-2.5 py-2 font-medium disabled:opacity-40">Previous</button><span>Page {currentPage}/{pageCount}</span><button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage >= pageCount} className="rounded border border-slate-200 px-2.5 py-2 font-medium disabled:opacity-40">Next</button></div><button onClick={openNewRequest} disabled={isLoading || loadError} className="inline-flex h-9 items-center gap-2 self-start rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"><Plus className="h-4 w-4" /> New Request</button></div></div>
        {isLoading ? <div className="px-5 py-14 text-center text-sm text-slate-500">Loading {definition.title.replace(" Form", "")} requests from Firebase...</div> : loadError ? <div className="px-5 py-14 text-center text-sm text-red-600">Could not load requests from Firebase. Check your connection and Firestore permissions, then refresh.</div> : filteredRecords.length ? <div className="overflow-x-auto"><table className="w-full min-w-[800px] border-collapse text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="border-b border-slate-200 px-4 py-3 font-semibold">Request No.</th><th className="border-b border-slate-200 px-4 py-3 font-semibold">Request Details</th><th className="border-b border-slate-200 px-4 py-3 font-semibold">Requested By</th><th className="border-b border-slate-200 px-4 py-3 font-semibold">Approval</th><th className="border-b border-slate-200 px-4 py-3 font-semibold">Created Date</th><th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">Action</th></tr></thead><tbody>{paginatedRecords.map((record) => <tr key={record.request_no} className="border-b border-slate-100 last:border-0 hover:bg-blue-50/30"><td className="whitespace-nowrap px-4 py-3 font-semibold text-blue-700">{record.request_no}</td><td className="px-4 py-3 text-slate-700">{recordSummary(type, record)}</td><td className="px-4 py-3 text-slate-600">{record.requested_by || "—"}</td><td className="px-4 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${record.status === "Draft" ? "bg-slate-100 text-slate-700" : record.status === "Approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{record.status}</span></td><td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatCreatedDate(record.created_at)}</td><td className="px-4 py-2"><div className="grid grid-cols-3 justify-items-center gap-1"><ActionButton label="View" onClick={() => openRecord(record, "view")}><Eye className="h-4 w-4" /></ActionButton><ActionButton label="Download PDF" onClick={() => downloadPdf(record)}><Download className="h-4 w-4" /></ActionButton>{(isAdmin || (record.owner_uid || record.created_by) === firebaseUser?.uid) && <ActionButton label="Edit" onClick={() => openRecord(record, "edit")}><Pencil className="h-4 w-4" /></ActionButton>}{isAdmin && record.status === "Pending Approval" && <ActionButton label="Approve request" onClick={() => setActionConfirm({ type: "approve", requestNo: record.request_no })} className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"><Check className="h-4 w-4" /></ActionButton>}{(isAdmin || (record.owner_uid || record.created_by) === firebaseUser?.uid) && <ActionButton label="Duplicate" onClick={() => duplicateRecord(record)}><Copy className="h-4 w-4" /></ActionButton>}{isAdmin && <ActionButton label="Delete" onClick={() => setActionConfirm({ type: "delete", requestNo: record.request_no })} danger><Trash2 className="h-4 w-4" /></ActionButton>}</div></td></tr>)}</tbody></table></div>
          : <div className="px-5 py-14 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><ClipboardList className="h-7 w-7" /></span><h3 className="mt-4 text-base font-bold text-slate-900">No {definition.title.replace(" Form", " Requests")} Found</h3><p className="mt-1 text-sm text-slate-500">Create a request to get started.</p><button onClick={openNewRequest} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"><Plus className="h-4 w-4" /> Add New Request</button></div>}
        {filteredRecords.length > 0 && <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between"><label className="flex items-center gap-2 font-medium">Rows per page<select className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700" value={pageSize} onChange={(event) => { setPageSize(event.target.value === "all" ? "all" : Number(event.target.value)); setPage(1); }}><option value="15">15</option><option value="30">30</option><option value="100">100</option><option value="all">All</option></select></label><span>Showing {firstVisible}–{lastVisible} of {filteredRecords.length}</span><div className="flex items-center gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1} className="rounded border border-slate-200 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40">Previous</button><span>Page {currentPage} of {pageCount}</span><button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage >= pageCount} className="rounded border border-slate-200 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40">Next</button></div></div>}
      </section>
    </div>
    <AlertDialog open={!!actionConfirm} onOpenChange={(open) => { if (!open) setActionConfirm(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{actionConfirm?.type === "approve" ? "Approve Request?" : "Delete Request?"}</AlertDialogTitle><AlertDialogDescription>{actionConfirm?.type === "approve" ? `This ${definition.title.replace(" Form", "").toLowerCase()} request will be marked as approved.` : "This request will be permanently removed from this list."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); confirmAction(); }} className={actionConfirm?.type === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}>{actionConfirm?.type === "approve" ? "Approve" : "Delete"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;

  return <div className="min-h-full bg-slate-50/70 px-3 py-5 pb-4 sm:px-6 sm:py-6 sm:pb-4 lg:px-8">
    <div className="mx-auto max-w-[1440px] space-y-4">
      <header className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid min-h-[70px] grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2 bg-[#06255d] px-3 py-2 text-white sm:grid-cols-[180px_minmax(0,1fr)_180px] sm:px-5">
          <div className="flex items-center gap-2"><button onClick={closeForm} aria-label="Back to requests" className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/20 text-white hover:bg-white/10"><ArrowLeft className="h-4 w-4" /></button></div>
          <div className="min-w-0 text-center"><h1 className="text-base font-extrabold tracking-wide sm:text-xl">{type === "rental-car" && <CarFront className="mr-2 inline h-5 w-5 align-[-3px]" />}{type === "rental-car" ? "Rental Vehicle" : definition.title.replace(" Form", "").toUpperCase()}</h1><p className="mt-0.5 text-[10px] font-semibold tracking-wide text-blue-100 sm:text-xs">WORKFORCE &amp; HR REQUEST</p><p className="text-xs font-bold text-blue-100 sm:text-sm">Request No. {requestNo}</p></div>
          <div className="flex items-center justify-end gap-2"><span className="rounded border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-bold sm:text-sm">Approval: {formMode === "new" ? "New" : status}</span>{formMode === "view" && <><button type="button" onClick={() => downloadPdf(formatPdfRecord())} title="Download PDF" aria-label="Download PDF" className="inline-flex h-8 items-center gap-2 rounded bg-white px-2.5 text-xs font-semibold text-blue-900 hover:bg-blue-50"><Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">Download</span></button>{(isAdmin || (selectedRecord?.owner_uid || selectedRecord?.created_by) === firebaseUser?.uid) && <button onClick={() => setFormMode("edit")} className="inline-flex h-8 items-center gap-2 rounded bg-red-600 px-2.5 text-xs font-semibold text-white hover:bg-red-700"><Pencil className="h-3.5 w-3.5" /><span className="hidden sm:inline">Edit</span></button>}</>}</div>
        </div>
      </header>

      {isAdmin && formMode === "new" && <section className="rounded-lg border border-blue-200 bg-blue-50 p-4"><label className="block max-w-xl"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Create request for</span><select className={inputClass} value={requestedUserId} onChange={(event) => { const user = users.find((item) => item.id === event.target.value); setRequestedUserId(event.target.value); update("requested_by", user?.fullName || requestedBy); }}><option value="">Select a user</option>{users.filter((user) => !user.isDisabled).map((user) => <option key={user.id} value={user.id}>{user.fullName} ({user.email})</option>)}</select></label></section>}
      {definition.sections.map((section, index) => <section key={section.title} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">{index + 1}</span><h2 className="inline-block bg-[#06255d] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white [clip-path:polygon(0_0,calc(100%-10px)_0,100%_100%,0_100%)] sm:text-sm">{section.title}</h2></div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">{section.fields.map((field) => {
          const locked = isReadOnly || !!field.readOnly || (field.key === "requested_by" && !isAdmin);
          const className = locked ? readOnlyClass : inputClass;
          return <label key={field.key} className={`block min-w-0 ${field.type === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""}`}>
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">{field.label}{field.required && <span className="ml-1 text-red-600">*</span>}</span>
            {field.type === "textarea" ? <textarea className={`${locked ? "min-h-[82px] w-full resize-y rounded border border-blue-100 bg-blue-50/70 px-2.5 py-2.5 text-sm font-medium text-slate-700 outline-none" : `${inputClass} min-h-[82px] resize-y py-2.5`}`} value={values[field.key] || ""} onChange={(event) => update(field.key, event.target.value)} disabled={locked} placeholder={field.placeholder || "Enter details"} required={field.required} />
              : field.type === "select" ? <select className={className} value={values[field.key] || ""} onChange={(event) => update(field.key, event.target.value)} disabled={locked} required={field.required}><option value="">Select {field.label.toLowerCase()}</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select>
                : <input type={field.type || "text"} className={className} value={values[field.key] || ""} onChange={(event) => update(field.key, event.target.value)} readOnly={locked} disabled={locked} placeholder={field.placeholder} min={field.min} step={field.step} required={field.required} />}
            {errors[field.key] && <span className="mt-1 block text-xs font-medium text-red-600">{errors[field.key]}</span>}
            {field.key === "monthly_installment" && values.monthly_installment && <span className="mt-1 block text-[11px] text-blue-700">{formatMoney(Number(values.monthly_installment))} per month</span>}
          </label>;
        })}</div>
      </section>)}
      {type === "rental-car" && (() => {
        const totals = rentalTotals(values);
        return <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm sm:p-5"><h2 className="text-sm font-bold uppercase tracking-wide text-[#06255d]">Rental Cost Summary</h2><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7"><SummaryAmount label="Rental Cost" amount={totals.rentalCost} /><SummaryAmount label="Fuel" amount={totals.fuel} /><SummaryAmount label="Toll" amount={totals.toll} /><SummaryAmount label="Other Amount" amount={totals.otherAmount} /><SummaryAmount label="Gross Total" amount={totals.total} /><SummaryAmount label="Advance Payment" amount={totals.advancePayment} /><SummaryAmount label="Net Total" amount={totals.netTotal} emphasized /></div></section>;
      })()}
    </div>

    <div className="sticky bottom-0 z-30 mx-auto mt-4 w-full max-w-[1440px] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-[0_-6px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-2"><button onClick={closeForm} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><X className="h-4 w-4" /> Cancel</button>{!isReadOnly && formMode === "new" && <button onClick={openNewRequest} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100"><Plus className="h-4 w-4" /> Add New Request</button>}</div>{isReadOnly ? <button onClick={closeForm} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800"><ArrowLeft className="h-4 w-4" /> Back to Requests</button> : <div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => printRequest(formatPdfRecord())} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Printer className="h-4 w-4" /> Print</button><button onClick={() => save("Draft")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><FileText className="h-4 w-4" /> Save as Draft</button><button onClick={() => { if (validate()) setConfirmSubmit(true); else toast.error("Complete the required fields to continue."); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"><Send className="h-4 w-4" /> {formMode === "edit" ? "Update Request" : "Submit for Approval"}</button></div>}</div></div>

    {confirmSubmit && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="submit-request-title"><div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"><h2 id="submit-request-title" className="text-lg font-bold text-slate-900">{formMode === "edit" ? "Update" : "Submit"} {definition.title}?</h2><p className="mt-2 text-sm text-slate-600">This request will be sent through the approval workflow.</p><div className="mt-6 flex justify-end gap-2"><button onClick={() => setConfirmSubmit(false)} disabled={saving} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button onClick={submit} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"><CheckCircle2 className="h-4 w-4" />{saving ? "Submitting..." : formMode === "edit" ? "Update" : "Submit"}</button></div></div></div>}
  </div>;
}

function SummaryAmount({ label, amount, emphasized = false }: { label: string; amount: number; emphasized?: boolean }) {
  return <div className={`rounded-lg border px-3 py-3 ${emphasized ? "border-blue-300 bg-white text-blue-900" : "border-blue-100 bg-white/70 text-slate-700"}`}><p className="text-xs font-medium text-slate-500">{label}</p><p className={`mt-1 ${emphasized ? "text-lg font-bold" : "text-base font-semibold"}`}>{formatMoney(amount)}</p></div>;
}

function ActionButton({ label, onClick, children, danger = false, className = "" }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean; className?: string }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition ${danger ? "text-red-600 hover:bg-red-50" : "text-slate-500 hover:bg-blue-50 hover:text-blue-700"} ${className}`}>{children}</button>;
}
