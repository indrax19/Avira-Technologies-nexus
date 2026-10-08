import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { CompanyProfileSelector } from "@/components/CompanyProfileSelector";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  createEmptyDeductions,
  createEmptyEarnings,
  payrollsAPI,
} from "@/integrations/firebase/payrollAPI";
import { usersAPI } from "@/integrations/firebase/usersAPI";
import { supabase } from "@/integrations/supabase/client";
import { downloadEmployeePDF } from "@/lib/employeePDF";
import { isBirthdayReminder } from "@/utils/birthdayReminder";
import { toast } from "sonner";
import {
  AlertTriangle,
  Cake,
  CalendarDays,
  Check,
  Download,
  Eye,
  FileText,
  ImagePlus,
  Landmark,
  Mail,
  Phone,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";

type EmployeeForm = {
  employeeId: string;
  profilePhotoPath: string;
  profilePhotoUrl: string;
  company: string;
  employeeType: string;
  employmentStatus: string;
  dateOfJoining: string;
  probationPeriod: string;
  confirmationDate: string;
  fullName: string;
  fatherName: string;
  cnic: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  bloodGroup: string;
  nationality: string;
  religion: string;
  department: string;
  employeeCategory: string;
  designation: string;
  grade: string;
  reportingTo: string;
  costCenter: string;
  jobLocation: string;
  employmentType: string;
  noticePeriod: string;
  workingShift: string;
  probationExtension: string;
  mobileNumber: string;
  whatsappNumber: string;
  personalEmail: string;
  officialEmail: string;
  accountEmail: string;
  accountPassword: string;
  landline: string;
  currentAddress: string;
  permanentAddress: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyNumber1: string;
  emergencyNumber2: string;
  emergencyAddress: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string;
  basicSalary: string;
  allowances: string;
  deductions: string;
  passportNumber: string;
  drivingLicense: string;
  vehicle: string;
  hobbies: string;
  languages: string;
  linkedin: string;
  remarks: string;
  createdBy: string;
  createdOn: string;
  lastUpdatedBy: string;
  lastUpdatedOn: string;
  lastWorkingDate: string;
  reasonForLeaving: string;
  exitStatus: string;
  finalSettlementStatus: string;
  documents: string;
};

const initialForm: EmployeeForm = {
  employeeId: "EMP-000126",
  profilePhotoPath: "",
  profilePhotoUrl: "",
  company: "",
  employeeType: "Monthly Employee",
  employmentStatus: "Active",
  dateOfJoining: "",
  probationPeriod: "3",
  confirmationDate: "",
  fullName: "",
  fatherName: "",
  cnic: "",
  dateOfBirth: "",
  gender: "Male",
  maritalStatus: "Single",
  bloodGroup: "",
  nationality: "Pakistani",
  religion: "Islam",
  department: "",
  employeeCategory: "Technical",
  designation: "",
  grade: "",
  reportingTo: "",
  costCenter: "",
  jobLocation: "Lahore",
  employmentType: "Permanent",
  noticePeriod: "30",
  workingShift: "General (9 AM - 6 PM)",
  probationExtension: "No",
  mobileNumber: "",
  whatsappNumber: "",
  personalEmail: "",
  officialEmail: "",
  accountEmail: "",
  accountPassword: "",
  landline: "",
  currentAddress: "",
  permanentAddress: "",
  city: "Lahore",
  state: "Punjab",
  country: "Pakistan",
  postalCode: "",
  emergencyName: "",
  emergencyRelationship: "Brother",
  emergencyNumber1: "",
  emergencyNumber2: "",
  emergencyAddress: "",
  bankName: "",
  accountTitle: "",
  accountNumber: "",
  iban: "",
  basicSalary: "",
  allowances: "",
  deductions: "",
  passportNumber: "",
  drivingLicense: "",
  vehicle: "No",
  hobbies: "",
  languages: "Urdu, English",
  linkedin: "",
  remarks: "",
  createdBy: "Admin",
  createdOn: "12-Aug-2026 10:30 AM",
  lastUpdatedBy: "Admin",
  lastUpdatedOn: "12-Aug-2026 10:30 AM",
  lastWorkingDate: "",
  reasonForLeaving: "",
  exitStatus: "",
  finalSettlementStatus: "",
  documents: "{}",
};

type EmployeeRecord = EmployeeData;

const inputClass =
  "mt-1 h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-800 outline-none transition focus:border-[#145487] focus:ring-1 focus:ring-[#145487]/20 disabled:bg-slate-100";
const textareaClass =
  "mt-1 min-h-16 w-full resize-y rounded border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-[#145487] focus:ring-1 focus:ring-[#145487]/20";
const sectionTones: Record<string, string> = {
  blue: "border-blue-100 bg-blue-50/80 text-[#145487]",
  green: "border-emerald-100 bg-emerald-50/80 text-emerald-800",
  purple: "border-purple-100 bg-purple-50/80 text-purple-800",
  orange: "border-orange-100 bg-orange-50/80 text-orange-800",
  teal: "border-teal-100 bg-teal-50/80 text-teal-800",
  indigo: "border-indigo-100 bg-indigo-50/80 text-indigo-800",
  slate: "border-slate-200 bg-slate-100/80 text-slate-700",
  rose: "border-rose-100 bg-rose-50/80 text-rose-800",
};

const optionSets = {
  company: [],
  employeeType: ["Monthly Employee", "Daily Wager", "Intern", "Contractor"],
  employmentStatus: ["Active", "Probation", "On Leave", "Inactive"],
  gender: ["Male", "Female", "Other"],
  maritalStatus: ["Single", "Married", "Divorced", "Widowed"],
  bloodGroup: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  religion: ["Islam", "Christianity", "Hinduism", "Other"],
  department: [
    "Information Technology (IT)",
    "Projects & Deployment",
    "Human Resources",
    "Finance",
    "Sales & Commercial",
    "Procurement",
    "Operations",
    "Administration",
    "Marketing",
    "Customer Support",
    "Legal & Compliance",
    "Quality Assurance (QA)",
    "Supply Chain & Logistics",
    "Research & Development (R&D)",
    "Security",
    "Maintenance",
    "Maintenance"
  ],
  employeeCategory: [
    "Technical",
    "Non-Technical",
    "Management",
    "Support Staff",
  ],
  designation: [
    "Manager",
    "Team Lead",
    "Senior Manager",
    "Assistant Manager",
    "Senior Executive",
    "Supervisor",
    "Officer"
  ],
  grade: ["G-1", "G-2", "G-3", "G-4", "G-5", "G-6"],
  reportingTo: [
    "Project Manager",
    "Department Head",
    "HR Manager",
    "Chief Executive Officer",
    "Team Lead",
    "Manager",
    "Senior Manager",
    "Assistant Manager",
    "Senior Executive",
    "Supervisor",
    "Officer"
  ],
  costCenter: [
    "Project Deployment",
    "Corporate HR",
    "Finance & Accounts",
    "Sales Operations",
  ],
  jobLocation: ["Lahore", "Islamabad", "Karachi", "Remote", "Site"],
  employmentType: ["Permanent", "Contract", "Part-time", "Internship"],
  workingShift: [
    "General (9 AM - 6 PM)",
    "Morning (8 AM - 5 PM)",
    "Evening (2 PM - 11 PM)",
    "Night (10 PM - 7 AM)",
  ],
  probationExtension: ["No", "Yes"],
  city: ["Lahore", "Islamabad", "Karachi", "Rawalpindi", "Peshawar", "Quetta"],
  state: [
    "Punjab",
    "Sindh",
    "Khyber Pakhtunkhwa",
    "Balochistan",
    "Islamabad Capital Territory",
  ],
  country: [
    "Pakistan",
    "United Arab Emirates",
    "Saudi Arabia",
    "United Kingdom",
  ],
  emergencyRelationship: [
    "Father",
    "Mother",
    "Brother",
    "Sister",
    "Spouse",
    "Friend",
    "Other",
  ],
  bankName: [
    "Meezan Bank",
    "HBL",
    "MCB Bank",
    "UBL",
    "Bank Alfalah",
    "Askari Bank",
    "Other",
  ],
  vehicle: ["No", "Yes"],
  exitStatus: ["Resigned", "Terminated", "Retired", "Contract Completed"],
  finalSettlementStatus: ["Pending", "In Process", "Completed"],
};

const EMPLOYEE_PHOTOS_BUCKET = "company-logos";
const EMPLOYEE_PHOTOS_FOLDER = "employee-photos";
const EMPLOYEE_DOCUMENTS_FOLDER = "employee-documents";
const MAX_PROFILE_PHOTO_SIZE = 2 * 1024 * 1024;

type EmployeeDocument = {
  name: string;
  path?: string;
  url?: string;
  type?: string;
  size?: number;
  uploadedAt?: string;
  file?: File;
};

function parseDocuments(value?: string): Record<string, EmployeeDocument> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, EmployeeDocument>)
      : {};
  } catch {
    return {};
  }
}

const documentNames = [
  "CNIC (Front)",
  "CNIC (Back)",
  "Passport Size Photo",
  "Education Certificates",
  "Experience Certificates",
  "Resume / CV",
  "Appointment Letter",
  "Contract Letter",
  "Reference Letter",
  "Other Documents",
];

const employeeViewSections: Array<{
  title: string;
  tone: string;
  fields: Array<[string, string]>;
}> = [
  {
    title: "Personal Information",
    tone: "blue",
    fields: [
      ["employeeId", "Employee ID"],
      ["fullName", "Full Name"],
      ["fatherName", "Father / Husband Name"],
      ["cnic", "CNIC"],
      ["dateOfBirth", "Date of Birth"],
      ["gender", "Gender"],
      ["maritalStatus", "Marital Status"],
      ["bloodGroup", "Blood Group"],
      ["nationality", "Nationality"],
      ["religion", "Religion"],
    ],
  },
  {
    title: "Employment Information",
    tone: "green",
    fields: [
      ["company", "Company"],
      ["employeeType", "Employee Type"],
      ["employmentStatus", "Employment Status"],
      ["dateOfJoining", "Date of Joining"],
      ["probationPeriod", "Probation Period"],
      ["confirmationDate", "Confirmation Date"],
      ["department", "Department"],
      ["employeeCategory", "Employee Category"],
      ["designation", "Designation"],
      ["grade", "Grade / Level"],
      ["reportingTo", "Reporting To"],
      ["costCenter", "Cost Center"],
      ["jobLocation", "Job Location"],
      ["employmentType", "Employment Type"],
      ["noticePeriod", "Notice Period"],
      ["workingShift", "Working Shift"],
      ["probationExtension", "Probation Extension"],
    ],
  },
  {
    title: "Contact Information",
    tone: "purple",
    fields: [
      ["mobileNumber", "Mobile Number"],
      ["whatsappNumber", "WhatsApp Number"],
      ["personalEmail", "Personal Email"],
      ["officialEmail", "Official Email"],
      ["landline", "Landline"],
      ["currentAddress", "Current Address"],
      ["permanentAddress", "Permanent Address"],
      ["city", "City"],
      ["state", "State"],
      ["country", "Country"],
      ["postalCode", "Postal Code"],
    ],
  },
  {
    title: "Emergency Contact Information",
    tone: "orange",
    fields: [
      ["emergencyName", "Emergency Contact Name"],
      ["emergencyRelationship", "Relationship"],
      ["emergencyNumber1", "Contact Number 1"],
      ["emergencyNumber2", "Contact Number 2"],
      ["emergencyAddress", "Address"],
    ],
  },
  {
    title: "Bank & Salary Information",
    tone: "teal",
    fields: [
      ["bankName", "Bank Name"],
      ["accountTitle", "Account Title"],
      ["accountNumber", "Account Number"],
      ["iban", "IBAN"],
      ["basicSalary", "Basic Salary"],
      ["allowances", "Allowances"],
      ["deductions", "Deductions"],
    ],
  },
  {
    title: "Additional Information",
    tone: "indigo",
    fields: [
      ["passportNumber", "Passport No."],
      ["drivingLicense", "Driving License No."],
      ["vehicle", "Vehicle"],
      ["hobbies", "Hobbies"],
      ["languages", "Languages Known"],
      ["linkedin", "LinkedIn Profile"],
      ["remarks", "Remarks"],
    ],
  },
  {
    title: "System Information",
    tone: "slate",
    fields: [
      ["createdBy", "Created By"],
      ["createdOn", "Created On"],
      ["lastUpdatedBy", "Last Updated By"],
      ["lastUpdatedOn", "Last Updated On"],
    ],
  },
];

const requiredEmployeeFields: Array<[keyof EmployeeForm, string]> = [
  ["company", "Company"],
  ["employeeType", "Employee Type"],
  ["employmentStatus", "Employment Status"],
  ["fullName", "Full Name"],
  ["cnic", "CNIC"],
  ["department", "Department"],
  ["designation", "Designation"],
  ["dateOfJoining", "Date of Joining"],
  ["mobileNumber", "Mobile Number"],
  ["emergencyName", "Emergency Contact Name"],
  ["emergencyNumber1", "Emergency Contact Number 1"],
];

function formatCnic(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  return [digits.slice(0, 5), digits.slice(5, 12), digits.slice(12, 13)]
    .filter(Boolean)
    .join("-");
}

function getConfirmationDate(dateValue: string, monthsValue: string) {
  if (!dateValue || !monthsValue) return "";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setMonth(date.getMonth() + Number(monthsValue));
  return date.toISOString().slice(0, 10);
}

function Field({
  label,
  required = false,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`block text-[10px] font-semibold text-slate-700 ${className}`}
    >
      <span>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  required = false,
  className = "",
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}) {
  return (
    <Field label={label} required={required} className={className}>
      <select
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      >
        {!value && <option value="">Select</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Section({
  number,
  title,
  tone,
  children,
  className = "",
}: {
  number?: number;
  title: string;
  tone: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <div
        className={`flex items-center gap-2 border-b px-2 py-1.5 ${sectionTones[tone] || sectionTones.blue}`}
      >
        {number !== undefined && (
          <span className="flex h-5 w-5 items-center justify-center rounded bg-current text-[10px] font-bold text-white shadow-sm">
            {number}
          </span>
        )}
        <h2 className="text-[11px] font-bold uppercase tracking-wide">
          {title}
        </h2>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function DocumentUpload({
  label,
  document,
  onChange,
  onPreview,
  onDownload,
}: {
  label: string;
  document?: EmployeeDocument;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPreview: (document: EmployeeDocument) => void;
  onDownload: (document: EmployeeDocument) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
      <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" />
      <span
        className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-700"
        title={document?.name}
      >
        {label}
        {document?.name && (
          <span className="ml-1 font-normal text-slate-400">
            · {document.name}
          </span>
        )}
      </span>
      {document?.url && (
        <>
          <button
            type="button"
            onClick={() => onPreview(document)}
            className="rounded p-1 text-slate-500 hover:bg-white hover:text-[#145487]"
            title="Preview in a new tab"
            aria-label={`Preview ${label}`}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDownload(document)}
            className="rounded p-1 text-slate-500 hover:bg-white hover:text-[#145487]"
            title="Download document"
            aria-label={`Download ${label}`}
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      <label className="flex shrink-0 cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:border-[#145487] hover:text-[#145487]">
        <Upload className="h-3 w-3" />
        {document?.name ? "Replace" : "Choose file"}
        <input type="file" className="sr-only" onChange={onChange} />
      </label>
      {document?.name && (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
      )}
    </div>
  );
}

function displayEmployeeValue(value: unknown) {
  if (value === null || value === undefined || value === "")
    return "Not provided";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function EmployeeViewDialog({
  employee,
  onClose,
}: {
  employee: EmployeeRecord | null;
  onClose: () => void;
}) {
  const printEmployeeView = () => {
    const view = document.getElementById("employee-view-print");
    const printWindow = window.open("", "_blank");

    if (!view || !printWindow) {
      toast.error("Please allow pop-ups to print the employee details.");
      return;
    }

    const styles = Array.from(
      document.head.querySelectorAll('style, link[rel="stylesheet"]'),
    )
      .map((style) => style.outerHTML)
      .join("\\n");

    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>${employee.fullName || "Employee Details"}</title>
          ${styles}
          <style>
            @page { margin: 12mm; }
            body { margin: 0; background: white; }
            #employee-view-print { width: 100%; }
          </style>
        </head>
        <body>${view.outerHTML}</body>
      </html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  if (!employee) return null;
  const documents = parseDocuments(employee.documents);
  const documentRows = Object.entries(documents).map(([label, document]) => [
    label,
    document.name || "Uploaded document",
  ]);

  return (
    <Dialog
      open={Boolean(employee)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto bg-[#f4f8fc] p-0">
        <div id="employee-view-print" className="overflow-hidden rounded-lg">
          <div className="bg-gradient-to-r from-[#061f42] via-[#0d477f] to-[#061f42] px-5 py-5 text-white sm:px-7">
            <div className="flex items-start justify-between gap-4">
              <DialogHeader>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-100">
                  Employee Management / Read-only view
                </p>
                <DialogTitle className="mt-1 text-2xl font-bold text-white">
                  {employee.fullName || "Employee Details"}
                </DialogTitle>
                <DialogDescription className="text-blue-100">
                  {employee.employeeId || "Employee record"} · Inspect employee
                  information without editing.
                </DialogDescription>
              </DialogHeader>
              <Button
                type="button"
                variant="outline"
                onClick={printEmployeeView}
                className="shrink-0 border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
          <div className="space-y-4 p-4 sm:p-6">
            {employee.profilePhotoUrl && (
              <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <img
                  src={employee.profilePhotoUrl}
                  alt={`${employee.fullName || "Employee"} profile`}
                  className="h-16 w-14 rounded object-cover ring-1 ring-blue-200"
                />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-800">
                    Profile photo
                  </p>
                  <p className="mt-1 text-xs text-blue-700">
                    Read-only employee record
                  </p>
                </div>
              </div>
            )}
            {employeeViewSections.map((section) => (
              <section
                key={section.title}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
              >
                <div
                  className={`border-b px-3 py-2 text-xs font-bold uppercase tracking-wide ${sectionTones[section.tone] || sectionTones.blue}`}
                >
                  {section.title}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="w-1/4 border border-slate-200 px-3 py-2 font-semibold">
                          Field
                        </th>
                        <th className="w-1/4 border border-slate-200 px-3 py-2 font-semibold">
                          Details
                        </th>
                        <th className="w-1/4 border border-slate-200 px-3 py-2 font-semibold">
                          Field
                        </th>
                        <th className="w-1/4 border border-slate-200 px-3 py-2 font-semibold">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(
                        { length: Math.ceil(section.fields.length / 2) },
                        (_, index) => {
                          const first = section.fields[index * 2];
                          const second = section.fields[index * 2 + 1];
                          return (
                            <tr
                              key={`${section.title}-${first[0]}`}
                              className="even:bg-slate-50/70"
                            >
                              <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-600">
                                {first[1]}
                              </td>
                              <td className="max-w-[220px] whitespace-pre-wrap break-words border border-slate-200 px-3 py-2 text-slate-800">
                                {displayEmployeeValue(employee[first[0]])}
                              </td>
                              <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-600">
                                {second?.[1] || ""}
                              </td>
                              <td className="max-w-[220px] whitespace-pre-wrap break-words border border-slate-200 px-3 py-2 text-slate-800">
                                {second
                                  ? displayEmployeeValue(employee[second[0]])
                                  : ""}
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700">
                Documents
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="border border-slate-200 px-3 py-2 font-semibold">
                      Document
                    </th>
                    <th className="border border-slate-200 px-3 py-2 font-semibold">
                      File
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {documentRows.length ? (
                    documentRows.map(([label, name]) => (
                      <tr key={label} className="even:bg-slate-50/70">
                        <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-600">
                          {label}
                        </td>
                        <td className="border border-slate-200 px-3 py-2 text-slate-800">
                          {name}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={2}
                        className="border border-slate-200 px-3 py-3 text-center text-slate-500"
                      >
                        No documents uploaded
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
            <div className="flex justify-end border-t border-slate-200 pt-3">
              <Button
                type="button"
                onClick={onClose}
                className="bg-slate-700 hover:bg-slate-800"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function employeeStatusClass(status: string) {
  return status === "Active"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "Probation"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : status === "On Leave"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-slate-100 text-slate-600";
}

function formatEmployeeDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

function EmployeeDirectory({
  employees,
  loading,
  onAdd,
  onView,
  onEdit,
  onDelete,
  onDownload,
}: {
  employees: EmployeeRecord[];
  loading: boolean;
  onAdd: () => void;
  onView: (employee: EmployeeRecord) => void;
  onEdit: (employee: EmployeeRecord) => void;
  onDelete: (employee: EmployeeRecord) => void;
  onDownload: (employee: EmployeeRecord) => void;
}) {
  const birthdayEmployees = employees.filter((employee) =>
    isBirthdayReminder(employee.dateOfBirth),
  );
  const [search, setSearch] = useState("");
  const filteredEmployees = employees.filter((employee) =>
    [
      employee.employeeId,
      employee.fullName,
      employee.department,
      employee.designation,
      employee.city,
      employee.officialEmail,
    ].some((value) =>
      (value || "").toLowerCase().includes(search.toLowerCase()),
    ),
  );
  const activeEmployees = employees.filter(
    (employee) => employee.employmentStatus === "Active",
  ).length;
  const probationEmployees = employees.filter(
    (employee) => employee.employmentStatus === "Probation",
  ).length;
  const leaveEmployees = employees.filter(
    (employee) => employee.employmentStatus === "On Leave",
  ).length;

  return (
    <main className="min-h-full bg-[#f4f8fc] p-3 text-slate-800 sm:p-5 lg:p-7">
      <div className="mx-auto max-w-[1800px] space-y-4">
        {loading && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Loading employees from Firebase...
          </div>
        )}
        <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#041d3b] via-[#075a70] to-[#063b63] px-5 py-6 text-white shadow-lg ring-1 ring-white/10 sm:px-7">
          <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100">
                Workforce &amp; HR
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                Employee Management
              </h1>
              <p className="mt-1 text-sm text-cyan-50">
                Manage employee records, contact details, and employment
                information.
              </p>
              {birthdayEmployees.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber-100">
                  <Cake className="h-4 w-4" />
                  Birthday reminder:{" "}
                  {birthdayEmployees
                    .map((employee) => employee.fullName)
                    .join(", ")}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-3 shadow-inner">
              <Users className="h-8 w-8 text-cyan-100" />
            </div>
          </div>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white p-4 shadow-sm">
            <Users className="h-10 w-10 rounded-lg bg-blue-50 p-2 text-blue-700" />
            <div>
              <p className="text-xs text-slate-500">Total Employees</p>
              <p className="text-xl font-bold text-slate-900">
                {employees.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white p-4 shadow-sm">
            <ShieldCheck className="h-10 w-10 rounded-lg bg-emerald-50 p-2 text-emerald-700" />
            <div>
              <p className="text-xs text-slate-500">Active</p>
              <p className="text-xl font-bold text-slate-900">
                {activeEmployees}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white p-4 shadow-sm">
            <CalendarDays className="h-10 w-10 rounded-lg bg-amber-50 p-2 text-amber-700" />
            <div>
              <p className="text-xs text-slate-500">On Probation</p>
              <p className="text-xl font-bold text-slate-900">
                {probationEmployees}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white p-4 shadow-sm">
            <UserRound className="h-10 w-10 rounded-lg bg-violet-50 p-2 text-violet-700" />
            <div>
              <p className="text-xs text-slate-500">On Leave</p>
              <p className="text-xl font-bold text-slate-900">
                {leaveEmployees}
              </p>
            </div>
          </div>
        </div>
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-lg font-bold text-[#145487]">
                Employee List
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Showing {filteredEmployees.length} of {employees.length}{" "}
                employee records.
              </p>
            </div>
            <Button
              onClick={onAdd}
              className="w-full bg-[#13834d] hover:bg-[#0d6c3e] sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </div>
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search employees..."
                className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#145487] focus:ring-1 focus:ring-[#145487]/20"
              />
            </div>
            <p className="text-xs text-slate-500">
              Departments: All <span className="mx-2">·</span> Status: All
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Employee</th>
                  <th className="px-3 py-3 font-semibold">Department</th>
                  <th className="px-3 py-3 font-semibold">Designation</th>
                  <th className="px-3 py-3 font-semibold">Contact</th>
                  <th className="px-3 py-3 font-semibold">Joining Date</th>
                  <th className="px-3 py-3 font-semibold">Type</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((employee) => (
                  <tr
                    key={employee.employeeId}
                    className="transition-colors hover:bg-blue-50/40"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-xs font-bold text-[#145487]">
                          {employee.profilePhotoUrl ? (
                            <img src={employee.profilePhotoUrl} alt={`${employee.fullName} profile`} className="h-full w-full object-cover" />
                          ) : (
                            employee.fullName.split(" ").map((part) => part[0]).join("").slice(0, 2)
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">
                            {employee.fullName}
                          </p>
                          {isBirthdayReminder(employee.dateOfBirth) && (
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                              <Cake className="h-3.5 w-3.5" />
                              Birthday reminder
                            </div>
                          )}
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {employee.employeeId} · {employee.grade}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-700">
                        {employee.department}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {employee.employeeCategory}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-700">
                        {employee.designation}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Reports to {employee.reportingTo}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-700">
                        {employee.mobileNumber}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {employee.officialEmail}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-700">
                        {formatEmployeeDate(employee.dateOfJoining)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {employee.city}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {employee.employmentType}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${employeeStatusClass(employee.employmentStatus)}`}
                      >
                        {employee.employmentStatus}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="grid grid-cols-2 justify-items-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          title={`View ${employee.fullName}`}
                          onClick={() => onView(employee)}
                          className="h-8 w-8"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          title={`Download ${employee.fullName} PDF`}
                          onClick={() => onDownload(employee)}
                          className="h-8 w-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          title={`Edit ${employee.fullName}`}
                          onClick={() => onEdit(employee)}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          title={`Delete ${employee.fullName}`}
                          onClick={() => onDelete(employee)}
                          className="h-8 w-8 border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredEmployees.length === 0 && (
              <p className="p-10 text-center text-sm text-slate-500">
                No employees match your search.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Employees() {
  const { appUser } = useAuth();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [companyProfiles, setCompanyProfiles] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<EmployeeForm>(initialForm);
  const [profilePreview, setProfilePreview] = useState("");
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [savedProfilePhotoPath, setSavedProfilePhotoPath] = useState("");
  const [documentFiles, setDocumentFiles] = useState<
    Record<string, EmployeeDocument>
  >({});
  const [viewingEmployee, setViewingEmployee] = useState<EmployeeRecord | null>(
    null,
  );
  const [downloadTarget, setDownloadTarget] = useState<EmployeeRecord | null>(
    null,
  );
  const [profileSelectorOpen, setProfileSelectorOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    companyProfileAPI.getAll().then(setCompanyProfiles).catch(() => toast.error("Unable to load company profiles."));
    const unsubscribe = employeesAPI.subscribeAll(
      (data) => {
        setEmployees(data);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        toast.error(error.message || "Unable to load employee records.");
      },
    );
    return unsubscribe;
  }, []);

  const updateField = (field: keyof EmployeeForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  useEffect(() => {
    if (companyProfiles.length && !form.company) {
      updateField("company", companyProfiles[0].company_name);
    }
  }, [companyProfiles, form.company]);

  const handleChange =
    (field: keyof EmployeeForm) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      updateField(field, event.target.value);
    };

  const handleDateChange =
    (field: "dateOfJoining" | "probationPeriod") =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setForm((current) => ({
        ...current,
        [field]: value,
        confirmationDate: getConfirmationDate(
          field === "dateOfJoining" ? value : current.dateOfJoining,
          field === "probationPeriod" ? value : current.probationPeriod,
        ),
      }));
    };

  const netSalary = useMemo(
    () =>
      Math.max(
        0,
        Number(form.basicSalary || 0) +
          Number(form.allowances || 0) -
          Number(form.deductions || 0),
      ),
    [form.allowances, form.basicSalary, form.deductions],
  );
  const formattedNetSalary = netSalary.toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handleProfileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please choose a JPG, PNG, or WEBP image.");
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO_SIZE) {
      toast.error("Profile photo must be 2MB or smaller.");
      return;
    }

    setProfilePhotoFile(file);
    setProfilePreview(URL.createObjectURL(file));
  };

  const removeProfilePhoto = () => {
    setProfilePhotoFile(null);
    setProfilePreview("");
    setForm((current) => ({
      ...current,
      profilePhotoPath: "",
      profilePhotoUrl: "",
    }));
  };

  const handleDocumentUpload =
    (label: string) => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file)
        setDocumentFiles((current) => ({
          ...current,
          [label]: {
            ...current[label],
            name: file.name,
            type: file.type,
            size: file.size,
            file,
          },
        }));
    };

  const previewDocument = (file: EmployeeDocument) => {
    if (!file.url) return;
    const preview = window.open(file.url, "_blank", "noopener,noreferrer");
    if (!preview) toast.error("Please allow pop-ups to preview this document.");
  };

  const downloadDocument = async (file: EmployeeDocument) => {
    if (!file.url) return;
    try {
      let blob: Blob;
      if (file.path) {
        const { data, error } = await supabase.storage
          .from(EMPLOYEE_PHOTOS_BUCKET)
          .download(file.path);
        if (error) throw error;
        blob = data;
      } else {
        const response = await fetch(file.url);
        if (!response.ok) throw new Error("Unable to download document.");
        blob = await response.blob();
      }
      const objectUrl = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = objectUrl;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to download document.",
      );
    }
  };

  const nextEmployeeId = () => {
    const highestId = employees.reduce(
      (highest, employee) =>
        Math.max(
          highest,
          Number.parseInt(employee.employeeId.replace("EMP-", ""), 10) || 0,
        ),
      0,
    );
    return `EMP-${String(highestId + 1).padStart(6, "0")}`;
  };

  const resetForm = () => {
    setForm({ ...initialForm, company: companyProfiles[0]?.company_name || "", employeeId: nextEmployeeId() });
    setProfilePreview("");
    setProfilePhotoFile(null);
    setSavedProfilePhotoPath("");
    setDocumentFiles({});
    toast.info("Employee form reset.");
  };

  const openForm = () => {
    setEditingId(null);
    setForm({ ...initialForm, company: companyProfiles[0]?.company_name || "", employeeId: nextEmployeeId() });
    setProfilePreview("");
    setProfilePhotoFile(null);
    setSavedProfilePhotoPath("");
    setDocumentFiles({});
    setIsFormOpen(true);
  };

  const openEditForm = (employee: EmployeeRecord) => {
    const {
      id: _id,
      created_at: _createdAt,
      updated_at: _updatedAt,
      created_by: _createdBy,
      updated_by: _updatedBy,
      ...editableEmployee
    } = employee;
    setEditingId(employee.id || null);
    setForm({ ...initialForm, ...editableEmployee, accountEmail: editableEmployee.accountEmail || editableEmployee.officialEmail || "", accountPassword: "" });
    setProfilePreview("");
    setProfilePhotoFile(null);
    setSavedProfilePhotoPath(employee.profilePhotoPath || "");
    setDocumentFiles(parseDocuments(employee.documents));
    setIsFormOpen(true);
  };

  const openView = (employee: EmployeeRecord) => {
    setViewingEmployee(employee);
  };

  const startEmployeeDownload = (employee: EmployeeRecord) => {
    setDownloadTarget(employee);
    setProfileSelectorOpen(true);
  };

  const confirmEmployeeDownload = async (profileId: string) => {
    if (!downloadTarget) return;
    setIsDownloading(true);
    try {
      const profile = await companyProfileAPI.getById(profileId);
      if (!profile) throw new Error("Selected company profile was not found.");
      await downloadEmployeePDF(downloadTarget, profile as CompanyProfile);
      toast.success("Employee PDF downloaded.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to create employee PDF.",
      );
    } finally {
      setIsDownloading(false);
      setDownloadTarget(null);
      setProfileSelectorOpen(false);
    }
  };

  const deleteEmployee = async (employee: EmployeeRecord) => {
    if (
      !employee.id ||
      !window.confirm(
        `Delete ${employee.fullName}? This action cannot be undone.`,
      )
    )
      return;
    setSaving(true);
    try {
      await employeesAPI.delete(employee.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete employee.",
      );
      setSaving(false);
      return;
    }

    const documentPaths = Object.values(parseDocuments(employee.documents))
      .map((file) => file.path)
      .filter((path): path is string => Boolean(path));
    const pathsToRemove = [employee.profilePhotoPath, ...documentPaths].filter(
      Boolean,
    );
    if (pathsToRemove.length) {
      try {
        const { error: removeError } = await supabase.storage
          .from(EMPLOYEE_PHOTOS_BUCKET)
          .remove(pathsToRemove);
        if (removeError)
          toast.warning(
            "Employee deleted, but some stored files could not be removed.",
          );
      } catch {
        toast.warning(
          "Employee deleted, but some stored files could not be removed.",
        );
      }
    }
    toast.success("Employee deleted.");
    setSaving(false);
  };

  const cancelForm = () => {
    resetForm();
    setEditingId(null);
    setIsFormOpen(false);
  };

  const saveForm = async (closeAfterSave = false) => {
    const missingFields = requiredEmployeeFields.filter(([field]) => !form[field].trim());
    if (missingFields.length) {
      toast.error(`Complete: ${missingFields.map(([, label]) => label).join(", ")}.`);
      return;
    }

    setSaving(true);
    let uploadedPhotoPath = "";
    const previousDocuments = parseDocuments(form.documents);
    const documentMetadata = { ...previousDocuments };
    const uploadedDocumentPaths: string[] = [];
    let employeeToSave = form;
    let createdUserId = "";

    try {
      const {
        accountPassword: _accountPassword,
        ...employeeDetails
      } = form;
      if (!editingId) {
        const hasAccountEmail = Boolean(form.accountEmail.trim());
        const hasAccountPassword = Boolean(form.accountPassword);
        if (hasAccountEmail !== hasAccountPassword)
          throw new Error(
            "Provide both login email and password, or leave both blank.",
          );

        if (hasAccountEmail && hasAccountPassword) {
          const createdUser = await usersAPI.createWithPassword(
            form.accountEmail.trim(),
            form.accountPassword,
            form.fullName.trim(),
            "user",
            ["profile", "attendance"],
            employeeDetails,
          );
          createdUserId = createdUser.employeeRecordId || "";
          employeeToSave = {
            ...employeeDetails,
            employeeId: createdUser.employeeId || employeeDetails.employeeId,
          };
        } else {
          const createdEmployee = await employeesAPI.create(
            employeeDetails,
            appUser?.id,
          );
          createdUserId = createdEmployee.id || "";
          employeeToSave = {
            ...employeeDetails,
            employeeId:
              createdEmployee.employeeId || employeeDetails.employeeId,
          };
        }
      } else {
        employeeToSave = employeeDetails;
      }
      if (profilePhotoFile) {
        const extension =
          profilePhotoFile.type === "image/png"
            ? "png"
            : profilePhotoFile.type === "image/webp"
              ? "webp"
              : "jpg";
        uploadedPhotoPath = `${EMPLOYEE_PHOTOS_FOLDER}/${form.employeeId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(EMPLOYEE_PHOTOS_BUCKET)
          .upload(uploadedPhotoPath, profilePhotoFile, {
            contentType: profilePhotoFile.type,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from(EMPLOYEE_PHOTOS_BUCKET)
          .getPublicUrl(uploadedPhotoPath);
        employeeToSave = {
          ...employeeToSave,
          profilePhotoPath: uploadedPhotoPath,
          profilePhotoUrl: urlData.publicUrl,
        };
      }

      for (const [label, document] of Object.entries(documentFiles)) {
        if (!document.file) continue;
        const safeEmployeeId = form.employeeId.replace(/[^a-zA-Z0-9_-]/g, "_");
        const safeFileName = document.file.name
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .slice(0, 120);
        const path = `${EMPLOYEE_DOCUMENTS_FOLDER}/${safeEmployeeId}/${crypto.randomUUID()}-${safeFileName}`;
        const { error: uploadError } = await supabase.storage
          .from(EMPLOYEE_PHOTOS_BUCKET)
          .upload(path, document.file, {
            contentType: document.file.type || "application/octet-stream",
          });
        if (uploadError) throw uploadError;
        uploadedDocumentPaths.push(path);
        const { data: urlData } = supabase.storage
          .from(EMPLOYEE_PHOTOS_BUCKET)
          .getPublicUrl(path);
        documentMetadata[label] = {
          name: document.file.name,
          path,
          url: urlData.publicUrl,
          type: document.file.type,
          size: document.file.size,
          uploadedAt: new Date().toISOString(),
        };
      }

      employeeToSave = {
        ...employeeToSave,
        documents: JSON.stringify(documentMetadata),
      };

      if (editingId) {
        await employeesAPI.update(editingId, employeeToSave, appUser?.id);
        if (employeeToSave.userId) {
          await usersAPI.update(employeeToSave.userId, {
            fullName: employeeToSave.fullName,
            ...(form.accountEmail.trim() ? { email: form.accountEmail.trim() } : {}),
          });
        }
      } else if (createdUserId) {
        await employeesAPI.update(createdUserId, employeeToSave, appUser?.id);
      } else {
        throw new Error("The linked employee record was not created.");
      }

      if (!editingId && createdUserId) {
        const earnings = createEmptyEarnings(
          Number(employeeToSave.basicSalary) || 0,
        );
        earnings.other = Number(employeeToSave.allowances) || 0;
        const deductions = createEmptyDeductions();
        deductions.other = Number(employeeToSave.deductions) || 0;
        await payrollsAPI.create(
          {
            employeeDocumentId: createdUserId,
            employeeId: employeeToSave.employeeId || "",
            employeeName: employeeToSave.fullName || "",
            employeeEmail: (
              employeeToSave.officialEmail ||
              employeeToSave.accountEmail ||
              ""
            ).toLowerCase(),
            employeePhotoUrl: employeeToSave.profilePhotoUrl || "",
            department: employeeToSave.department || "",
            designation: employeeToSave.designation || "",
            dateOfJoining: employeeToSave.dateOfJoining || "",
            reportingManager: employeeToSave.reportingTo || "",
            employmentType: employeeToSave.employmentType || "",
            bankAccount:
              employeeToSave.accountNumber || employeeToSave.iban || "",
            payrollMonth: new Date().getMonth() + 1,
            payrollYear: new Date().getFullYear(),
            paymentDate: "",
            status: "Draft",
            earnings,
            deductions,
          },
          appUser?.fullName || "Administrator",
        );
      }
    } catch (error) {
      const pathsToRemove = [
        uploadedPhotoPath,
        ...uploadedDocumentPaths,
      ].filter(Boolean);
      if (pathsToRemove.length) {
        try {
          await supabase.storage
            .from(EMPLOYEE_PHOTOS_BUCKET)
            .remove(pathsToRemove);
        } catch {
          // The upload failure is already reported below.
        }
      }
      toast.error(
        error instanceof Error ? error.message : "Unable to save employee.",
      );
      setSaving(false);
      return;
    }

    const replacedDocumentPaths = Object.keys(documentFiles)
      .filter(
        (label) =>
          documentFiles[label].file &&
          previousDocuments[label]?.path &&
          previousDocuments[label].path !== documentMetadata[label]?.path,
      )
      .map((label) => previousDocuments[label].path as string);
    const pathsToRemove = [
      savedProfilePhotoPath &&
      savedProfilePhotoPath !== employeeToSave.profilePhotoPath
        ? savedProfilePhotoPath
        : "",
      ...replacedDocumentPaths,
    ].filter(Boolean);
    if (pathsToRemove.length) {
      try {
        const { error: removeError } = await supabase.storage
          .from(EMPLOYEE_PHOTOS_BUCKET)
          .remove(pathsToRemove);
        if (removeError)
          toast.warning(
            "Employee saved, but an old file could not be removed.",
          );
      } catch {
        toast.warning("Employee saved, but an old file could not be removed.");
      }
    }

    toast.success(
      editingId
        ? "Employee updated successfully."
        : "Employee saved successfully.",
    );
    if (closeAfterSave) {
      setEditingId(null);
      setIsFormOpen(false);
    } else {
      setEditingId(editingId || createdUserId);
      setForm({ ...initialForm, ...employeeToSave, accountEmail: form.accountEmail, accountPassword: form.accountPassword });
      setProfilePreview(employeeToSave.profilePhotoUrl || "");
      setProfilePhotoFile(null);
      setSavedProfilePhotoPath(employeeToSave.profilePhotoPath || "");
      setDocumentFiles(parseDocuments(employeeToSave.documents));
    }
    setSaving(false);
  };

  const missingRequiredFields = requiredEmployeeFields
    .filter(([field]) => !form[field].trim())
    .map(([, label]) => label);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveForm();
  };

  if (!isFormOpen)
    return (
      <>
        <EmployeeDirectory
          employees={employees}
          loading={loading}
          onAdd={openForm}
          onView={openView}
          onEdit={openEditForm}
          onDelete={deleteEmployee}
          onDownload={startEmployeeDownload}
        />
        <EmployeeViewDialog
          employee={viewingEmployee}
          onClose={() => setViewingEmployee(null)}
        />
        <CompanyProfileSelector
          open={profileSelectorOpen}
          onOpenChange={(open) => {
            if (!isDownloading) {
              setProfileSelectorOpen(open);
              if (!open) setDownloadTarget(null);
            }
          }}
          onSelect={confirmEmployeeDownload}
        />
      </>
    );

  return (
    <main id="employee-registration-print" className="min-h-full bg-[#f4f8fc] p-2 text-slate-800 sm:p-4 lg:p-6">
      <style>{`@media print { body * { visibility: hidden; } #employee-registration-print, #employee-registration-print * { visibility: visible; } #employee-registration-print { position: absolute; inset: 0; width: 100%; } }`}</style>
      <div className="mx-auto max-w-[1800px] space-y-3">
        <header className="overflow-hidden rounded-md bg-gradient-to-r from-[#061f42] via-[#0d477f] to-[#061f42] px-4 py-3 text-white shadow-md sm:px-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-wide sm:text-2xl">
                  {editingId ? "EDIT EMPLOYEE" : "EMPLOYEE REGISTRATION FORM"}
                </h1>
                <p className="text-[10px] font-medium tracking-wide text-blue-100">
                  Human Resource Management System
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 self-end sm:self-auto">
              {isBirthdayReminder(form.dateOfBirth) && (
                <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-200">
                  <Cake className="h-4 w-4" />
                  Birthday reminder
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-blue-100">
                  Employee ID
                </span>
                <span className="rounded bg-white px-3 py-1.5 text-xs font-bold text-[#145487] shadow-sm">
                  {form.employeeId}
                </span>
              </div>
            </div>
          </div>
        </header>

        <form noValidate onSubmit={(event) => handleSubmit(event)} className="space-y-3">
      {missingRequiredFields.length > 0 && (
        <div role="alert" className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-bold">Please complete the required fields before saving.</p>
            <p className="mt-0.5">Missing: {missingRequiredFields.join(", ")}</p>
          </div>
        </div>
      )}
          <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Field label="Employee ID">
              <input
                value={form.employeeId}
                readOnly
                className={`${inputClass} bg-slate-100 font-semibold text-[#145487]`}
              />
            </Field>
            <SelectField
              label="Company"
              value={form.company}
              options={companyProfiles.map((profile) => profile.company_name)}
              onChange={(value) => updateField("company", value)}
              required
            />
            <SelectField
              label="Employee Type"
              value={form.employeeType}
              options={optionSets.employeeType}
              onChange={(value) => updateField("employeeType", value)}
              required
            />
            <SelectField
              label="Employment Status"
              value={form.employmentStatus}
              options={optionSets.employmentStatus}
              onChange={(value) => updateField("employmentStatus", value)}
              required
            />
            <Field label="Date of Joining (DOJ)" required>
              <input
                type="date"
                value={form.dateOfJoining}
                onChange={handleDateChange("dateOfJoining")}
                className={inputClass}
                required
              />
            </Field>
            <Field label="Probation Period (Months)">
              <input
                type="number"
                min="0"
                max="24"
                value={form.probationPeriod}
                onChange={handleDateChange("probationPeriod")}
                className={inputClass}
              />
            </Field>
            <Field label="Confirmation Date">
              <input
                type="date"
                value={form.confirmationDate}
                readOnly
                className={`${inputClass} bg-slate-100`}
              />
            </Field>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <Section number={1} title="Personal Information" tone="blue">
              <div className="grid gap-3 sm:grid-cols-[105px_1fr]">
                <div className="flex flex-col items-center gap-2">
                  <div className="relative flex h-24 w-20 items-center justify-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                    {profilePreview || form.profilePhotoUrl ? (
                      <img
                        src={profilePreview || form.profilePhotoUrl}
                        alt="Employee profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserRound className="h-16 w-16 text-slate-300" />
                    )}
                    <label className="absolute bottom-1 right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-[#145487] text-white shadow">
                      <ImagePlus className="h-3.5 w-3.5" />
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={handleProfileUpload}
                        disabled={saving}
                      />
                    </label>
                    {(profilePreview || form.profilePhotoUrl) && (
                      <button
                        type="button"
                        onClick={removeProfilePhoto}
                        disabled={saving}
                        aria-label="Remove profile photo"
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800/75 text-white hover:bg-red-600 disabled:cursor-not-allowed"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <span className="text-center text-[9px] text-slate-400">
                    JPG, PNG, WEBP · Max 2MB
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Full Name" required>
                    <input
                      value={form.fullName}
                      onChange={handleChange("fullName")}
                      className={inputClass}
                      required
                    />
                  </Field>
                  <Field label="Father / Husband Name">
                    <input
                      value={form.fatherName}
                      onChange={handleChange("fatherName")}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="CNIC" required>
                    <input
                      value={form.cnic}
                      onChange={(event) =>
                        updateField("cnic", formatCnic(event.target.value))
                      }
                      placeholder="XXXXX-XXXXXXX-X"
                      maxLength={15}
                      className={inputClass}
                      required
                    />
                  </Field>
                  <Field label="Date of Birth">
                    <input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={handleChange("dateOfBirth")}
                      className={inputClass}
                    />
                  </Field>
                  <SelectField
                    label="Gender"
                    value={form.gender}
                    options={optionSets.gender}
                    onChange={(value) => updateField("gender", value)}
                  />
                  <SelectField
                    label="Marital Status"
                    value={form.maritalStatus}
                    options={optionSets.maritalStatus}
                    onChange={(value) => updateField("maritalStatus", value)}
                  />
                  <SelectField
                    label="Blood Group"
                    value={form.bloodGroup}
                    options={optionSets.bloodGroup}
                    onChange={(value) => updateField("bloodGroup", value)}
                  />
                  <SelectField
                    label="Nationality"
                    value={form.nationality}
                    options={["Pakistani", "Afghan", "Indian", "Other"]}
                    onChange={(value) => updateField("nationality", value)}
                  />
                  <SelectField
                    label="Religion"
                    value={form.religion}
                    options={optionSets.religion}
                    onChange={(value) => updateField("religion", value)}
                    className="sm:col-span-2"
                  />
                </div>
              </div>
            </Section>

            <Section number={2} title="Employment Information" tone="green">
              <div className="grid gap-2 sm:grid-cols-2">
                <SelectField
                  label="Department"
                  value={form.department}
                  options={optionSets.department}
                  onChange={(value) => updateField("department", value)}
                  required
                />
                <SelectField
                  label="Employee Category"
                  value={form.employeeCategory}
                  options={optionSets.employeeCategory}
                  onChange={(value) => updateField("employeeCategory", value)}
                />
                <SelectField
                  label="Designation"
                  value={form.designation}
                  options={optionSets.designation}
                  onChange={(value) => updateField("designation", value)}
                  required
                />
                <SelectField
                  label="Grade / Level"
                  value={form.grade}
                  options={optionSets.grade}
                  onChange={(value) => updateField("grade", value)}
                />
                <SelectField
                  label="Reporting To"
                  value={form.reportingTo}
                  options={optionSets.reportingTo}
                  onChange={(value) => updateField("reportingTo", value)}
                />
                <SelectField
                  label="Cost Center"
                  value={form.costCenter}
                  options={optionSets.costCenter}
                  onChange={(value) => updateField("costCenter", value)}
                />
                <SelectField
                  label="Job Location"
                  value={form.jobLocation}
                  options={optionSets.jobLocation}
                  onChange={(value) => updateField("jobLocation", value)}
                />
                <Field label="Notice Period (Days)">
                  <input
                    type="number"
                    min="0"
                    value={form.noticePeriod}
                    onChange={handleChange("noticePeriod")}
                    className={inputClass}
                  />
                </Field>
                <SelectField
                  label="Employment Type"
                  value={form.employmentType}
                  options={optionSets.employmentType}
                  onChange={(value) => updateField("employmentType", value)}
                />
                <SelectField
                  label="Working Shift"
                  value={form.workingShift}
                  options={optionSets.workingShift}
                  onChange={(value) => updateField("workingShift", value)}
                />
                <SelectField
                  label="Probation Extension"
                  value={form.probationExtension}
                  options={optionSets.probationExtension}
                  onChange={(value) => updateField("probationExtension", value)}
                />
              </div>
            </Section>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <Section number={3} title="Contact Information" tone="purple">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Mobile Number" required>
                  <div className="relative">
                    <Phone className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="tel"
                      value={form.mobileNumber}
                      onChange={handleChange("mobileNumber")}
                      className={`${inputClass} pl-7`}
                      required
                    />
                  </div>
                </Field>
                <Field label="WhatsApp Number">
                  <div className="relative">
                    <Phone className="absolute left-2 top-2 h-3.5 w-3.5 text-emerald-500" />
                    <input
                      type="tel"
                      value={form.whatsappNumber}
                      onChange={handleChange("whatsappNumber")}
                      className={`${inputClass} pl-7`}
                    />
                  </div>
                </Field>
                <Field label="Personal Email">
                  <div className="relative">
                    <Mail className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="email"
                      value={form.personalEmail}
                      onChange={handleChange("personalEmail")}
                      className={`${inputClass} pl-7`}
                    />
                  </div>
                </Field>
                <Field label="Official Email">
                  <div className="relative">
                    <Mail className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="email"
                      value={form.officialEmail}
                      onChange={handleChange("officialEmail")}
                      className={`${inputClass} pl-7`}
                    />
                  </div>
                </Field>
                <>
                    <Field label="Login Email">
                      <div className="relative">
                        <Mail className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="email"
                          value={form.accountEmail}
                          onChange={handleChange("accountEmail")}
                          className={`${inputClass} pl-7`}
                        />
                      </div>
                    </Field>
                    <Field label="Login Password">
                      <input
                        type="password"
                        value={form.accountPassword}
                        onChange={handleChange("accountPassword")}
                        className={inputClass}
                        minLength={6}
                      />
                    </Field>
                </>
                <Field label="Landline (Residence)">
                  <input
                    type="tel"
                    value={form.landline}
                    onChange={handleChange("landline")}
                    className={inputClass}
                  />
                </Field>
                <Field label="City">
                  <select
                    value={form.city}
                    onChange={handleChange("city")}
                    className={inputClass}
                  >
                    {optionSets.city.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Current Address" className="sm:col-span-2">
                  <textarea
                    value={form.currentAddress}
                    onChange={handleChange("currentAddress")}
                    className={textareaClass}
                  />
                </Field>
                <Field label="Permanent Address" className="sm:col-span-2">
                  <textarea
                    value={form.permanentAddress}
                    onChange={handleChange("permanentAddress")}
                    className={textareaClass}
                  />
                </Field>
                <SelectField
                  label="State / Province"
                  value={form.state}
                  options={optionSets.state}
                  onChange={(value) => updateField("state", value)}
                />
                <SelectField
                  label="Country"
                  value={form.country}
                  options={optionSets.country}
                  onChange={(value) => updateField("country", value)}
                />
                <Field label="Postal Code">
                  <input
                    value={form.postalCode}
                    onChange={handleChange("postalCode")}
                    className={inputClass}
                  />
                </Field>
              </div>
            </Section>

            <Section
              number={4}
              title="Emergency Contact Information"
              tone="orange"
            >
              <div className="grid gap-3 lg:grid-cols-[1fr_120px]">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Emergency Contact Name" required>
                    <input
                      value={form.emergencyName}
                      onChange={handleChange("emergencyName")}
                      className={inputClass}
                      required
                    />
                  </Field>
                  <SelectField
                    label="Relationship"
                    value={form.emergencyRelationship}
                    options={optionSets.emergencyRelationship}
                    onChange={(value) =>
                      updateField("emergencyRelationship", value)
                    }
                  />
                  <Field label="Contact Number 1" required>
                    <div className="relative">
                      <Phone className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="tel"
                        value={form.emergencyNumber1}
                        onChange={handleChange("emergencyNumber1")}
                        className={`${inputClass} pl-7`}
                        required
                      />
                    </div>
                  </Field>
                  <Field label="Contact Number 2">
                    <div className="relative">
                      <Phone className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="tel"
                        value={form.emergencyNumber2}
                        onChange={handleChange("emergencyNumber2")}
                        className={`${inputClass} pl-7`}
                      />
                    </div>
                  </Field>
                  <Field label="Address" className="sm:col-span-2">
                    <textarea
                      value={form.emergencyAddress}
                      onChange={handleChange("emergencyAddress")}
                      className={`${textareaClass} min-h-24`}
                    />
                  </Field>
                </div>
                <div className="flex min-h-24 flex-col items-center justify-center rounded border border-orange-200 bg-orange-50 p-2 text-center">
                  <Phone className="h-5 w-5 text-orange-600" />
                  <span className="mt-1 text-[10px] font-bold uppercase text-orange-700">
                    Emergency
                  </span>
                  <span className="text-[10px] font-bold uppercase text-orange-700">
                    Contact
                  </span>
                  <span className="mt-1 text-[10px] font-semibold text-orange-600">
                    Required
                  </span>
                </div>
              </div>
            </Section>
          </div>

          <Section number={5} title="Bank & Salary Information" tone="teal">
            <div className="grid gap-2 lg:grid-cols-4">
              <SelectField
                label="Bank Name"
                value={form.bankName}
                options={optionSets.bankName}
                onChange={(value) => updateField("bankName", value)}
              />
              <Field label="Account Title">
                <input
                  value={form.accountTitle}
                  onChange={handleChange("accountTitle")}
                  className={inputClass}
                />
              </Field>
              <Field label="Account Number">
                <input
                  value={form.accountNumber}
                  onChange={handleChange("accountNumber")}
                  className={inputClass}
                />
              </Field>
              <Field label="IBAN">
                <input
                  value={form.iban}
                  onChange={handleChange("iban")}
                  className={inputClass}
                />
              </Field>
              <Field label="Basic Salary">
                <input
                  type="number"
                  min="0"
                  value={form.basicSalary}
                  onChange={handleChange("basicSalary")}
                  className={inputClass}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Allowances">
                <input
                  type="number"
                  min="0"
                  value={form.allowances}
                  onChange={handleChange("allowances")}
                  className={inputClass}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Deductions">
                <input
                  type="number"
                  min="0"
                  value={form.deductions}
                  onChange={handleChange("deductions")}
                  className={inputClass}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Net Salary">
                <div className="relative">
                  <Landmark className="absolute left-2 top-2 h-3.5 w-3.5 text-emerald-600" />
                  <input
                    value={formattedNetSalary}
                    readOnly
                    className={`${inputClass} bg-emerald-50 pl-7 font-bold text-emerald-700`}
                  />
                </div>
              </Field>
            </div>
          </Section>

          <Section
            number={6}
            title="Documents (Upload Scanned Copies)"
            tone="slate"
          >
            <div className="grid gap-2 md:grid-cols-2">
              {documentNames.map((documentName) => (
                <DocumentUpload
                  key={documentName}
                  label={documentName}
                  document={documentFiles[documentName]}
                  onChange={handleDocumentUpload(documentName)}
                  onPreview={previewDocument}
                  onDownload={downloadDocument}
                />
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1 text-[9px] text-slate-400">
              <ShieldCheck className="h-3 w-3" />
              Upload any document type. Files are securely linked to this
              employee after saving.
            </p>
          </Section>

          <div className="grid gap-3 xl:grid-cols-2">
            <Section number={7} title="Additional Information" tone="indigo">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Passport No.">
                  <input
                    value={form.passportNumber}
                    onChange={handleChange("passportNumber")}
                    className={inputClass}
                  />
                </Field>
                <Field label="Driving License No.">
                  <input
                    value={form.drivingLicense}
                    onChange={handleChange("drivingLicense")}
                    className={inputClass}
                  />
                </Field>
                <SelectField
                  label="Vehicle (Yes/No)"
                  value={form.vehicle}
                  options={optionSets.vehicle}
                  onChange={(value) => updateField("vehicle", value)}
                />
                <Field label="Hobbies">
                  <input
                    value={form.hobbies}
                    onChange={handleChange("hobbies")}
                    className={inputClass}
                  />
                </Field>
                <Field label="Languages Known">
                  <input
                    value={form.languages}
                    onChange={handleChange("languages")}
                    className={inputClass}
                  />
                </Field>
                <Field label="LinkedIn Profile">
                  <input
                    type="url"
                    value={form.linkedin}
                    onChange={handleChange("linkedin")}
                    className={inputClass}
                  />
                </Field>
                <Field label="Remarks" className="sm:col-span-2">
                  <textarea
                    value={form.remarks}
                    onChange={handleChange("remarks")}
                    className={textareaClass}
                  />
                </Field>
              </div>
            </Section>
          </div>

          <Section
            number={9}
            title="Exit Information (To be filled at time of exit)"
            tone="rose"
          >
            <div className="grid gap-2 lg:grid-cols-4">
              <Field label="Last Working Date">
                <input
                  type="date"
                  value={form.lastWorkingDate}
                  onChange={handleChange("lastWorkingDate")}
                  className={inputClass}
                />
              </Field>
              <Field label="Reason for Leaving" className="lg:col-span-2">
                <textarea
                  value={form.reasonForLeaving}
                  onChange={handleChange("reasonForLeaving")}
                  className={textareaClass}
                />
              </Field>
              <SelectField
                label="Exit Status"
                value={form.exitStatus}
                options={optionSets.exitStatus}
                onChange={(value) => updateField("exitStatus", value)}
              />
              <div className="flex items-end gap-2 lg:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 flex-1 border-[#145487] text-xs text-[#145487] hover:bg-blue-50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Generate Experience Letter
                </Button>
                <label className="flex h-8 cursor-pointer items-center gap-1 rounded border border-slate-300 px-2 text-[10px] font-medium text-slate-600 hover:border-[#145487] hover:text-[#145487]">
                  <Upload className="h-3 w-3" />
                  Upload
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="sr-only"
                  />
                </label>
              </div>
              <SelectField
                label="Final Settlement Status"
                value={form.finalSettlementStatus}
                options={optionSets.finalSettlementStatus}
                onChange={(value) =>
                  updateField("finalSettlementStatus", value)
                }
              />
            </div>
          </Section>

          <div data-employee-form-actions className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-2 print:hidden">
        <Button type="button" onClick={() => window.print()} className="h-8 bg-slate-700 px-4 text-xs hover:bg-slate-800">
          <Printer className="h-3.5 w-3.5" />
          Print Form
        </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => saveForm(true)}
              className="h-8 bg-[#145487] px-4 text-xs hover:bg-[#0f416a]"
            >
              <Check className="h-3.5 w-3.5" />
              Save &amp; Close
            </Button>
            <Button
              type="button"
              onClick={cancelForm}
              className="h-8 bg-slate-600 px-4 text-xs hover:bg-slate-700"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={resetForm}
              className="h-8 bg-amber-500 px-4 text-xs text-white hover:bg-amber-600"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
