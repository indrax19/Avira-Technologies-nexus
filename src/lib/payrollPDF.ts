import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompanyProfile } from "@/integrations/firebase/firestore";
import {
  DEDUCTION_FIELDS,
  EARNING_FIELDS,
  formatPayrollCurrency,
  formatPayrollMonth,
  type PayrollRecord,
} from "@/integrations/firebase/payrollAPI";
import { addLogoToPDF } from "@/lib/pdfLogoHelper";
import { downloadHighQualityPDF } from "@/lib/pdfCompression";

const NAVY = [6, 38, 77] as [number, number, number];
const TEAL = [8, 113, 128] as [number, number, number];
const INK = [30, 41, 59] as [number, number, number];
const MUTED = [100, 116, 139] as [number, number, number];
const BORDER = [203, 213, 225] as [number, number, number];
const MARGIN = 14;

function formatDate(value: string) {
  if (!value) return "Not paid yet";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-PK", { day: "2-digit", month: "short", year: "numeric" }).format(date);
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

function drawLabelValue(pdf: jsPDF, label: string, value: string, x: number, y: number) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...MUTED);
  pdf.text(label.toUpperCase(), x, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...INK);
  pdf.text(value || "Not provided", x, y + 4.4);
}

export async function generateSalarySlipPDF(payroll: PayrollRecord, companyProfile?: CompanyProfile | null): Promise<Blob> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  let logoHeight = 0;

  if (companyProfile?.logo_url) logoHeight = await addLogoToPDF(pdf, companyProfile.logo_url, MARGIN, 11, { maxWidth: 28, maxHeight: 22 });

  pdf.setTextColor(...NAVY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(companyProfile?.company_name || "Avira Technologies", pageWidth - MARGIN, 15, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  const companyLines = [[companyProfile?.phone, companyProfile?.email].filter(Boolean).join("  ·  ")].filter(Boolean);
  companyLines.forEach((line, index) => pdf.text(line, pageWidth - MARGIN, 20 + index * 3.8, { align: "right" }));

  const headerBottom = Math.max(40, 15 + logoHeight + 11);
  pdf.setDrawColor(...TEAL);
  pdf.setLineWidth(0.65);
  pdf.line(MARGIN, headerBottom, pageWidth - MARGIN, headerBottom);
  pdf.setTextColor(...NAVY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.text("SALARY SLIP", pageWidth / 2, headerBottom + 10, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...MUTED);
  pdf.text(`${payroll.payslipId}  ·  ${formatPayrollMonth(payroll.payrollMonth, payroll.payrollYear)}`, pageWidth / 2, headerBottom + 15.5, { align: "center" });

  let y = headerBottom + 23;
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(...BORDER);
  pdf.roundedRect(MARGIN, y, contentWidth, 19, 2, 2, "FD");
  const paymentColumns = [
    ["Payroll month", formatPayrollMonth(payroll.payrollMonth, payroll.payrollYear)],
    ["Payment date", formatDate(payroll.paymentDate)],
    ["Payment status", payroll.status],
  ];
  paymentColumns.forEach(([label, value], index) => drawLabelValue(pdf, label, value, MARGIN + 5 + index * (contentWidth / 3), y + 6));
  y += 26;

  pdf.setFillColor(...NAVY);
  pdf.rect(MARGIN, y, contentWidth, 7, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.text("EMPLOYEE DETAILS", MARGIN + 4, y + 4.7);
  y += 12;
  const employeeDetails = [
    ["Employee name", payroll.employeeName], ["Employee ID", payroll.employeeId], ["Designation", payroll.designation], ["Department", payroll.department],
    ["Date of joining", payroll.dateOfJoining], ["Reporting manager", payroll.reportingManager], ["Employment type", payroll.employmentType], ["Bank account", payroll.bankAccount],
  ];
  employeeDetails.forEach(([label, value], index) => drawLabelValue(pdf, label, value, MARGIN + (index % 4) * (contentWidth / 4), y + Math.floor(index / 4) * 11));
  y += 27;

  const earningRows = EARNING_FIELDS.map((field) => [field.label, formatPayrollCurrency(payroll.earnings[field.key])]);
  const deductionRows = DEDUCTION_FIELDS.map((field) => [field.label, formatPayrollCurrency(payroll.deductions[field.key])]);
  const tableTop = y;
  const halfWidth = (contentWidth - 4) / 2;
  autoTable(pdf, {
    startY: tableTop,
    margin: { left: MARGIN },
    tableWidth: halfWidth,
    head: [["EARNINGS", "AMOUNT"]],
    body: earningRows,
    foot: [["Total earnings / gross", formatPayrollCurrency(payroll.grossSalary)]],
    theme: "grid",
    headStyles: { fillColor: [5, 112, 93], textColor: 255, fontSize: 8, fontStyle: "bold", cellPadding: 2.2 },
    bodyStyles: { textColor: INK, fontSize: 7.5, cellPadding: 1.8, lineColor: BORDER, lineWidth: 0.2 },
    footStyles: { fillColor: [236, 253, 245], textColor: [6, 95, 70], fontSize: 8, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: halfWidth - 28 }, 1: { cellWidth: 28, halign: "right" } },
  });
  autoTable(pdf, {
    startY: tableTop,
    margin: { left: MARGIN + halfWidth + 4 },
    tableWidth: halfWidth,
    head: [["DEDUCTIONS", "AMOUNT"]],
    body: deductionRows,
    foot: [["Total deductions", formatPayrollCurrency(payroll.totalDeductions)]],
    theme: "grid",
    headStyles: { fillColor: [190, 24, 93], textColor: 255, fontSize: 8, fontStyle: "bold", cellPadding: 2.2 },
    bodyStyles: { textColor: INK, fontSize: 7.5, cellPadding: 1.8, lineColor: BORDER, lineWidth: 0.2 },
    footStyles: { fillColor: [255, 241, 242], textColor: [159, 18, 57], fontSize: 8, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: halfWidth - 28 }, 1: { cellWidth: 28, halign: "right" } },
  });
  const leftFinalY = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || tableTop + 60;
  y = Math.max(leftFinalY, tableTop + 65) + 8;

  pdf.setFillColor(...NAVY);
  pdf.roundedRect(MARGIN, y, contentWidth, 24, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(207, 250, 254);
  pdf.text("NET PAY IN WORDS", MARGIN + 5, y + 7);
  pdf.setFontSize(9);
  pdf.setTextColor(255, 255, 255);
  const words = pdf.splitTextToSize(netPayInWords(payroll.netSalary), contentWidth - 70);
  pdf.text(words, MARGIN + 5, y + 12);
  pdf.setFontSize(7.5);
  pdf.setTextColor(207, 250, 254);
  pdf.text("NET PAY", pageWidth - MARGIN - 5, y + 7, { align: "right" });
  pdf.setFontSize(16);
  pdf.setTextColor(255, 255, 255);
  pdf.text(formatPayrollCurrency(payroll.netSalary), pageWidth - MARGIN - 5, y + 15, { align: "right" });

  pdf.setDrawColor(...BORDER);
  pdf.line(MARGIN, pageHeight - 18, pageWidth - MARGIN, pageHeight - 18);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...MUTED);
  pdf.text("This is a system-generated payslip and does not require a signature.", pageWidth / 2, pageHeight - 12, { align: "center" });
  return pdf.output("blob");
}

export async function downloadSalarySlipPDF(payroll: PayrollRecord, companyProfile?: CompanyProfile | null) {
  const blob = await generateSalarySlipPDF(payroll, companyProfile);
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(payroll.payrollYear, payroll.payrollMonth - 1, 1));
  await downloadHighQualityPDF(blob, `SalarySlip_${payroll.employeeId}_${month}_${payroll.payrollYear}.pdf`);
}
