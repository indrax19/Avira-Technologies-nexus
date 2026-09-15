import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompanyProfile } from "@/integrations/firebase/firestore";
import { addLogoToPDF } from "@/lib/pdfLogoHelper";

interface ExportRecord {
  id?: string;
  [key: string]: unknown;
}

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
};

const profileLines = (profile: CompanyProfile) => [
  profile.phone && `Phone: ${profile.phone}`,
  profile.email && `Email: ${profile.email}`,
  profile.website && `Website: ${profile.website}`,
].filter(Boolean) as string[];

async function addBrandedHeader(pdf: jsPDF, profile: CompanyProfile, title: string) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;
  let logoHeight = 0;

  if (profile.logo_url) {
    logoHeight = await addLogoToPDF(pdf, profile.logo_url, margin, 10, { maxWidth: 46, maxHeight: 24 });
  }

  pdf.setTextColor(15, 23, 42);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(profile.company_name || "Company Profile", pageWidth - margin, 14, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  profileLines(profile).forEach((line, index) => pdf.text(line, pageWidth - margin, 20 + index * 4.5, { align: "right" }));

  const headerBottom = Math.max(39, 12 + logoHeight + 8);
  pdf.setDrawColor(15, 23, 42);
  pdf.setLineWidth(0.45);
  pdf.line(margin, headerBottom, pageWidth - margin, headerBottom);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(title, pageWidth / 2, headerBottom + 11, { align: "center" });
  return headerBottom + 18;
}

function addFooter(pdf: jsPDF, profile: CompanyProfile) {
  const pageCount = pdf.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(148, 163, 184);
    pdf.setLineWidth(0.3);
    pdf.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);
    pdf.setTextColor(71, 85, 105);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(profile.company_name || "Company Profile", 14, pageHeight - 9);
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - 14, pageHeight - 9, { align: "right" });
  }
}

const compactLabels = new Set(["Registration Date", "Expiry Date", "Next Billing Date", "Next Renewal Date", "Status", "Billing Cycle", "Auto Renewal", "WHOIS Privacy"]);

function addCardTable(pdf: jsPDF, sections: [string, string][][], startY: number, columns: 2 | 3) {
  const rows: string[][] = [];
  for (let index = 0; index < sections.length; index += columns) {
    const row = sections.slice(index, index + columns);
    const cells = row.flatMap(([label, value]) => [label, value]);
    while (cells.length < columns * 2) cells.push("");
    rows.push(cells);
  }

  const labelWidth = columns === 2 ? 29 : 21;
  const valueWidth = columns === 2 ? 62 : 39.666;
  autoTable(pdf, {
    startY,
    body: rows,
    theme: "grid",
    tableWidth: 182,
    styles: { font: "helvetica", fontSize: columns === 3 ? 7.8 : 8.5, cellPadding: columns === 3 ? 2.8 : 3.2, lineColor: [203, 213, 225], lineWidth: 0.3, textColor: [30, 41, 59], valign: "middle" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: Object.fromEntries(Array.from({ length: columns * 2 }, (_, index) => [index, { cellWidth: index % 2 === 0 ? labelWidth : valueWidth, fontStyle: index % 2 === 0 ? "bold" : "normal" }])),
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index % 2 === 0) {
        data.cell.styles.fillColor = [239, 246, 255];
        data.cell.styles.textColor = [30, 64, 175];
      }
    },
    margin: { left: 14, right: 14, bottom: 22 },
  });
}

function addRecordTables(pdf: jsPDF, sections: [string, string][][], startY: number) {
  const compact = sections.filter(([label]) => compactLabels.has(label));
  const regular = sections.filter(([label]) => !compactLabels.has(label));
  addCardTable(pdf, regular, startY, 2);
  const regularEnd = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || startY;
  if (compact.length) addCardTable(pdf, compact, regularEnd + 7, 3);
}

export async function downloadDomainPDF(record: ExportRecord, profile: CompanyProfile) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const startY = await addBrandedHeader(pdf, profile, "DOMAIN ACCOUNT DETAILS");
  const sections: [string, string][][] = [
    ["Domain ID", displayValue(record.domainId)],
    ["Domain Name", displayValue(record.domain)],
    ["Company", displayValue(record.company)],
    ["Status", displayValue(record.status)],
    ["Username", displayValue(record.username)],
    ["Password", displayValue(record.password)],
    ["Domain Type", displayValue(record.type)],
    ["Registration Date", displayValue(record.registrationDate)],
    ["Expiry Date", displayValue(record.expiryDate)],
    ["Auto Renewal", displayValue(record.autoRenewal)],
    ["Registrar", displayValue(record.registrar)],
    ["WHOIS Privacy", displayValue(record.whoisPrivacy)],
    ["Nameservers", displayValue(record.nameservers)],
    ["Purchase Price (PKR)", displayValue(record.purchasePrice)],
    ["Renewal Price (PKR)", displayValue(record.renewalPrice)],
    ["GST Rate", `${displayValue(record.gstRate)}%`],
    ["GST Amount (PKR)", displayValue(record.gstAmount)],
    ["Total Amount (PKR)", displayValue(record.totalAmount)],
    ["Billing Cycle", displayValue(record.billingCycle)],
    ["Next Renewal Date", displayValue(record.nextRenewal)],
    ["Registrant Name", displayValue(record.registrant)],
    ["Contact Person", displayValue(record.contactPerson)],
    ["Email", displayValue(record.email)],
    ["Phone", displayValue(record.phone)],
  ];
  addRecordTables(pdf, sections, startY);
  addFooter(pdf, profile);
  pdf.save(`${displayValue(record.domain)}-domain-details.pdf`);
}

export async function downloadHostingPDF(record: ExportRecord, profile: CompanyProfile) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const startY = await addBrandedHeader(pdf, profile, "HOSTING ACCOUNT DETAILS");
  const sections: [string, string][][] = [
    ["Hosting ID", displayValue(record.hostingId)],
    ["Domain Name", displayValue(record.domain)],
    ["Company", displayValue(record.company)],
    ["Status", displayValue(record.status)],
    ["Hosting Type", displayValue(record.hostingType)],
    ["Hosting Plan", displayValue(record.hostingPlan)],
    ["Registration Date", displayValue(record.registrationDate)],
    ["Server / Location", displayValue(record.serverLocation)],
    ["Control Panel", displayValue(record.controlPanel)],
    ["Bandwidth", displayValue(record.bandwidth)],
    ["Disk Space", displayValue(record.diskSpace)],
    ["No. of Websites", displayValue(record.websites)],
    ["No. of Email Accounts", displayValue(record.emailAccounts)],
    ["Setup Charges (PKR)", displayValue(record.setupCharges)],
    ["Monthly Charges (PKR)", displayValue(record.monthlyCharges)],
    ["Billing Cycle", displayValue(record.billingCycle)],
    ["GST Rate", `${displayValue(record.gstRate)}%`],
    ["GST Amount (PKR)", displayValue(record.gstAmount)],
    ["Next Billing Date", displayValue(record.nextBillingDate)],
    ["Hosting Provider", displayValue(record.provider)],
    ["Account / Username", displayValue(record.username)],
    ["Password", displayValue(record.password)],
    ["Name Servers", displayValue(record.nameServers)],
    ["Auto Renewal", displayValue(record.autoRenewal)],
    ["Next Renewal Date", displayValue(record.nextRenewalDate)],
  ];
  addRecordTables(pdf, sections, startY);
  addFooter(pdf, profile);
  pdf.save(`${displayValue(record.domain)}-hosting-details.pdf`);
}
