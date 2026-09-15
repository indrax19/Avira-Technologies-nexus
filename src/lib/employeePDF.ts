import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompanyProfile } from "@/integrations/firebase/firestore";
import type { EmployeeData } from "@/integrations/firebase/employeesAPI";
import { addLogoToPDF } from "@/lib/pdfLogoHelper";

const NAVY = [13, 71, 127] as [number, number, number];
const INK = [30, 41, 59] as [number, number, number];
const MUTED = [71, 85, 105] as [number, number, number];
const LIGHT = [248, 250, 252] as [number, number, number];
const BORDER = [203, 213, 225] as [number, number, number];
const MARGIN = 14;
const EXCLUDED_FIELDS = new Set(["id", "profilePhotoPath", "profilePhotoUrl", "documents", "created_by", "created_at", "updated_by", "updated_at"]);

const sections: Array<{ title: string; fields: string[] }> = [
  {
    title: "Personal Information",
    fields: ["employeeId", "fullName", "fatherName", "cnic", "dateOfBirth", "gender", "maritalStatus", "bloodGroup", "nationality", "religion"],
  },
  {
    title: "Employment Information",
    fields: ["company", "employeeType", "employmentStatus", "dateOfJoining", "probationPeriod", "confirmationDate", "department", "employeeCategory", "designation", "grade", "reportingTo", "costCenter", "jobLocation", "employmentType", "noticePeriod", "workingShift", "probationExtension"],
  },
  {
    title: "Contact Information",
    fields: ["mobileNumber", "whatsappNumber", "personalEmail", "officialEmail", "landline", "currentAddress", "permanentAddress", "city", "state", "country", "postalCode"],
  },
  {
    title: "Emergency Contact Information",
    fields: ["emergencyName", "emergencyRelationship", "emergencyNumber1", "emergencyNumber2", "emergencyAddress"],
  },
  {
    title: "Bank & Salary Information",
    fields: ["bankName", "accountTitle", "accountNumber", "iban", "basicSalary", "allowances", "deductions"],
  },
  {
    title: "Additional Information",
    fields: ["passportNumber", "drivingLicense", "vehicle", "hobbies", "languages", "linkedin", "remarks"],
  },
  {
    title: "System Information",
    fields: ["createdBy", "createdOn", "lastUpdatedBy", "lastUpdatedOn"],
  },
];

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Not provided";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function fieldLabel(field: string) {
  return field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function parseDocuments(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return {} as Record<string, { name?: string; type?: string; size?: number }>;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, { name?: string; type?: string; size?: number }>
      : {};
  } catch {
    return {};
  }
}

function pairRows(rows: string[][]) {
  const pairedRows: string[][] = [];
  for (let index = 0; index < rows.length; index += 2) {
    const first = rows[index];
    const second = rows[index + 1] || ["", ""];
    pairedRows.push([first[0], first[1], second[0], second[1]]);
  }
  return pairedRows;
}

function addSection(pdf: jsPDF, title: string, rows: string[][], startY: number) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (startY > pageHeight - 35) {
    pdf.addPage();
    startY = 18;
  }

  pdf.setFillColor(...NAVY);
  pdf.rect(MARGIN, startY, pageWidth - MARGIN * 2, 8, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10.5);
  pdf.text(title, MARGIN + 4, startY + 5.3);

  autoTable(pdf, {
    startY: startY + 8,
    margin: { left: MARGIN, right: MARGIN, bottom: 22 },
    theme: "grid",
    head: [["Field", "Details", "Field", "Details"]],
    body: pairRows(rows),
    headStyles: { fillColor: [30, 64, 110], textColor: 255, fontStyle: "bold", fontSize: 8.2, cellPadding: 2.6, lineColor: BORDER, lineWidth: 0.3 },
    bodyStyles: { font: "helvetica", fontSize: 8.2, textColor: INK, cellPadding: 2.6, lineColor: BORDER, lineWidth: 0.25, valign: "top" },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 29, fontStyle: "bold", textColor: MUTED },
      1: { cellWidth: 62 },
      2: { cellWidth: 29, fontStyle: "bold", textColor: MUTED },
      3: { cellWidth: pageWidth - MARGIN * 2 - 120 },
    },
  });

  return (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || startY + 16;
}

function addFooter(pdf: jsPDF, profile: CompanyProfile) {
  const pageCount = pdf.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const profileDetails = [profile.phone && `Phone: ${profile.phone}`, profile.email && `Email: ${profile.email}`, profile.website && `Web: ${profile.website}`].filter(Boolean).join("  |  ");

  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...BORDER);
    pdf.setLineWidth(0.3);
    pdf.line(MARGIN, pageHeight - 16, pageWidth - MARGIN, pageHeight - 16);
    pdf.setTextColor(...MUTED);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text([profile.company_name || "Company Profile", profileDetails].filter(Boolean).join("  ·  "), MARGIN, pageHeight - 9);
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - MARGIN, pageHeight - 9, { align: "right" });
  }
}

export async function downloadEmployeePDF(employee: EmployeeData, profile: CompanyProfile) {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  let logoHeight = 0;

  if (profile.logo_url) {
    logoHeight = await addLogoToPDF(pdf, profile.logo_url, MARGIN, 8, { maxWidth: 45, maxHeight: 23 });
  }

  pdf.setTextColor(...INK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(profile.company_name || "Company Profile", pageWidth - MARGIN, 13, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  [profile.phone && `Phone: ${profile.phone}`, profile.email && `Email: ${profile.email}`, profile.website && `Website: ${profile.website}`].filter(Boolean).forEach((line, index) => {
    pdf.text(line as string, pageWidth - MARGIN, 19 + index * 4.5, { align: "right" });
  });

  const headerBottom = Math.max(37, 10 + logoHeight + 8);
  pdf.setDrawColor(...NAVY);
  pdf.setLineWidth(0.45);
  pdf.line(MARGIN, headerBottom, pageWidth - MARGIN, headerBottom);
  pdf.setTextColor(...INK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("EMPLOYEE PROFILE", pageWidth / 2, headerBottom + 11, { align: "center" });
  pdf.setFontSize(11);
  pdf.text(displayValue(employee.fullName), pageWidth / 2, headerBottom + 18, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Employee ID: ${displayValue(employee.employeeId)}`, pageWidth / 2, headerBottom + 24, { align: "center" });

  let y = headerBottom + 32;
  const usedFields = new Set<string>(["id"]);

  for (const section of sections) {
    const rows = section.fields.map((field) => {
      usedFields.add(field);
      return [fieldLabel(field), displayValue(employee[field])];
    });
    y = addSection(pdf, section.title, rows, y) + 7;
  }

  const documents = parseDocuments(employee.documents);
  const documentRows = Object.entries(documents).map(([label, document]) => {
    const file = document || {};
    const details = [file.name, file.type, file.size ? `${Math.round(file.size / 1024)} KB` : ""].filter(Boolean).join(" · ");
    return [label, details || "Uploaded document"];
  });
  y = addSection(pdf, "Documents", documentRows.length ? documentRows : [["Documents", "No documents uploaded"]], y) + 7;
  usedFields.add("documents");

  const extraRows = Object.keys(employee)
    .filter((field) => !usedFields.has(field) && !EXCLUDED_FIELDS.has(field))
    .sort()
    .map((field) => [fieldLabel(field), displayValue(employee[field])]);
  if (extraRows.length) addSection(pdf, "Other Employee Data", extraRows, y);

  addFooter(pdf, profile);
  const safeName = (employee.fullName || employee.employeeId || "Employee").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "Employee";
  pdf.save(`${safeName}_Employee_Profile.pdf`);
}
