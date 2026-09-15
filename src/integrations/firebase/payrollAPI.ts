import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./config";
import { handleFirestoreError, removeUndefined } from "./utils";

export type PayrollStatus =
  "Draft" | "Processing" | "Approved" | "Paid" | "Cancelled";

export const PAYROLL_STATUSES: PayrollStatus[] = [
  "Draft",
  "Processing",
  "Approved",
  "Paid",
  "Cancelled",
];

export const EARNING_FIELDS = [
  { key: "basic", label: "Basic Salary" },
  { key: "houseRent", label: "House Rent Allowance" },
  { key: "transport", label: "Transport Allowance" },
  { key: "utility", label: "Utility Allowance" },
  { key: "medical", label: "Medical Allowance" },
  { key: "mobileInternet", label: "Mobile / Internet Allowance" },
  { key: "fuel", label: "Fuel Allowance" },
  { key: "project", label: "Project Allowance" },
  { key: "overtime", label: "Overtime" },
  { key: "bonus", label: "Bonus" },
  { key: "performanceIncentive", label: "Performance Incentive" },
  { key: "commission", label: "Commission" },
  { key: "other", label: "Other Allowances" },
] as const;

export const DEDUCTION_FIELDS = [
  { key: "providentFund", label: "Provident Fund" },
  { key: "incomeTax", label: "Income Tax" },
  { key: "eobi", label: "EOBI" },
  { key: "professionalTax", label: "Professional Tax" },
  { key: "loanInstallment", label: "Loan Installment" },
  { key: "salaryAdvance", label: "Salary Advance" },
  { key: "unpaidLeave", label: "Unpaid Leave Deduction" },
  { key: "lateAbsent", label: "Late / Absent Deduction" },
  { key: "other", label: "Other Deductions" },
] as const;

export type Earnings = Record<(typeof EARNING_FIELDS)[number]["key"], number>;
export type Deductions = Record<
  (typeof DEDUCTION_FIELDS)[number]["key"],
  number
>;

export interface PayrollTotals {
  totalEarnings: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
}

export interface PayrollRecord extends PayrollTotals {
  id: string;
  payrollKey: string;
  payslipId: string;
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
  payrollPeriod: string;
  paymentDate: string;
  status: PayrollStatus;
  earnings: Earnings;
  deductions: Deductions;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export type PayrollInput = Omit<
  PayrollRecord,
  | "id"
  | "payrollKey"
  | "payslipId"
  | "payrollPeriod"
  | "totalEarnings"
  | "grossSalary"
  | "totalDeductions"
  | "netSalary"
  | "createdAt"
  | "updatedAt"
  | "createdBy"
  | "updatedBy"
>;

export interface SalarySlipRecord extends PayrollTotals {
  id: string;
  payrollId: string;
  payslipId: string;
  employeeId: string;
  employeeEmail: string;
  payrollMonth: number;
  payrollYear: number;
  paymentDate: string;
  status: PayrollStatus;
  earnings: Earnings;
  deductions: Deductions;
  updatedAt: string;
}

const PAYROLLS_COLLECTION = "payrolls";
const EARNINGS_COLLECTION = "payroll_earnings";
const DEDUCTIONS_COLLECTION = "payroll_deductions";
const SALARY_SLIPS_COLLECTION = "salary_slips";

function safeNumber(value: unknown) {
  const number =
    typeof value === "number"
      ? value
      : Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function normalizeEarnings(earnings?: Partial<Earnings>): Earnings {
  return EARNING_FIELDS.reduce(
    (result, field) => ({
      ...result,
      [field.key]: safeNumber(earnings?.[field.key]),
    }),
    {} as Earnings,
  );
}

function normalizeDeductions(deductions?: Partial<Deductions>): Deductions {
  return DEDUCTION_FIELDS.reduce(
    (result, field) => ({
      ...result,
      [field.key]: safeNumber(deductions?.[field.key]),
    }),
    {} as Deductions,
  );
}

export function createEmptyEarnings(basicSalary = 0): Earnings {
  return normalizeEarnings({ basic: basicSalary });
}

export function createEmptyDeductions(): Deductions {
  return normalizeDeductions();
}

export function calculatePayrollTotals(
  earnings: Partial<Earnings>,
  deductions: Partial<Deductions>,
): PayrollTotals {
  const normalizedEarnings = normalizeEarnings(earnings);
  const normalizedDeductions = normalizeDeductions(deductions);
  const totalEarnings = EARNING_FIELDS.reduce(
    (sum, field) => sum + normalizedEarnings[field.key],
    0,
  );
  const totalDeductions = DEDUCTION_FIELDS.reduce(
    (sum, field) => sum + normalizedDeductions[field.key],
    0,
  );
  return {
    totalEarnings,
    grossSalary: totalEarnings,
    totalDeductions,
    netSalary: totalEarnings - totalDeductions,
  };
}

export function formatPayrollMonth(month: number, year: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

export function formatPayrollCurrency(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function payrollDocumentId(
  employeeId: string,
  payrollMonth: number,
  payrollYear: number,
) {
  const safeEmployeeId =
    employeeId.trim().replace(/[^a-zA-Z0-9_-]/g, "-") || "employee";
  return `${safeEmployeeId}-${payrollYear}-${String(payrollMonth).padStart(2, "0")}`;
}

function buildPayrollRecord(
  input: PayrollInput,
  existing?: PayrollRecord,
): PayrollRecord {
  if (!input.employeeId.trim()) throw new Error("Employee ID is required.");
  if (!input.employeeName.trim()) throw new Error("Employee name is required.");
  if (
    input.payrollMonth < 1 ||
    input.payrollMonth > 12 ||
    !Number.isInteger(input.payrollMonth)
  )
    throw new Error("Select a valid payroll month.");
  if (input.payrollYear < 2000 || input.payrollYear > 2100)
    throw new Error("Select a valid payroll year.");

  const earnings = normalizeEarnings(input.earnings);
  const deductions = normalizeDeductions(input.deductions);
  const totals = calculatePayrollTotals(earnings, deductions);
  const id =
    existing?.id ||
    payrollDocumentId(input.employeeId, input.payrollMonth, input.payrollYear);
  const payrollPeriod = `${input.payrollYear}-${String(input.payrollMonth).padStart(2, "0")}`;
  const now = new Date().toISOString();

  return {
    id,
    payrollKey: id,
    payslipId: `PS-${input.payrollYear}${String(input.payrollMonth).padStart(2, "0")}-${input.employeeId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}`,
    ...input,
    employeeEmail: input.employeeEmail.trim().toLowerCase(),
    employeePhotoUrl: input.employeePhotoUrl || "",
    paymentDate: input.paymentDate || "",
    payrollPeriod,
    earnings,
    deductions,
    ...totals,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    createdBy: existing?.createdBy || input.employeeName,
    updatedBy: input.employeeName,
  };
}

function toSalarySlip(record: PayrollRecord): SalarySlipRecord {
  return {
    id: record.id,
    payrollId: record.id,
    payslipId: record.payslipId,
    employeeId: record.employeeId,
    employeeEmail: record.employeeEmail,
    payrollMonth: record.payrollMonth,
    payrollYear: record.payrollYear,
    paymentDate: record.paymentDate,
    status: record.status,
    earnings: record.earnings,
    deductions: record.deductions,
    totalEarnings: record.totalEarnings,
    grossSalary: record.grossSalary,
    totalDeductions: record.totalDeductions,
    netSalary: record.netSalary,
    updatedAt: record.updatedAt,
  };
}

function writePayrollDependencies(
  transaction: Parameters<typeof runTransaction>[1] extends (
    transaction: infer Transaction,
  ) => unknown
    ? Transaction
    : never,
  record: PayrollRecord,
) {
  transaction.set(
    doc(db, EARNINGS_COLLECTION, record.id),
    removeUndefined({
      payrollId: record.id,
      employeeId: record.employeeId,
      payrollPeriod: record.payrollPeriod,
      ...record.earnings,
      updatedAt: record.updatedAt,
    }),
  );
  transaction.set(
    doc(db, DEDUCTIONS_COLLECTION, record.id),
    removeUndefined({
      payrollId: record.id,
      employeeId: record.employeeId,
      payrollPeriod: record.payrollPeriod,
      ...record.deductions,
      updatedAt: record.updatedAt,
    }),
  );
  transaction.set(
    doc(db, SALARY_SLIPS_COLLECTION, record.id),
    toSalarySlip(record),
  );
}

export const payrollsAPI = {
  async create(input: PayrollInput, actorName: string): Promise<PayrollRecord> {
    const id = payrollDocumentId(
      input.employeeId,
      input.payrollMonth,
      input.payrollYear,
    );
    const payrollRef = doc(db, PAYROLLS_COLLECTION, id);
    let created: PayrollRecord | null = null;

    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(payrollRef);
      if (existing.exists())
        throw new Error(
          "A payroll already exists for this employee and payroll period.",
        );
      const record = buildPayrollRecord(input);
      record.createdBy = actorName;
      record.updatedBy = actorName;
      transaction.set(payrollRef, record);
      writePayrollDependencies(transaction, record);
      created = record;
    });

    if (!created) throw new Error("Payroll could not be created.");
    return created;
  },

  async update(
    id: string,
    input: PayrollInput,
    actorName: string,
  ): Promise<PayrollRecord> {
    const payrollRef = doc(db, PAYROLLS_COLLECTION, id);
    let updated: PayrollRecord | null = null;

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(payrollRef);
      if (!snapshot.exists()) throw new Error("Payroll record was not found.");
      const existing = { id: snapshot.id, ...snapshot.data() } as PayrollRecord;
      const record = buildPayrollRecord(input, existing);
      if (record.id !== id)
        throw new Error(
          "Employee and payroll period cannot be changed after creation.",
        );
      record.createdBy = existing.createdBy;
      record.updatedBy = actorName;
      transaction.set(payrollRef, record);
      writePayrollDependencies(transaction, record);
      updated = record;
    });

    if (!updated) throw new Error("Payroll could not be updated.");
    return updated;
  },

  async updateStatuses(
    records: PayrollRecord[],
    status: PayrollStatus,
    actorName: string,
    paymentDate = "",
  ) {
    if (!records.length) return;
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    records.forEach((record) => {
      const nextPaymentDate =
        status === "Paid"
          ? paymentDate ||
            record.paymentDate ||
            new Date().toISOString().slice(0, 10)
          : record.paymentDate;
      const changes = {
        status,
        paymentDate: nextPaymentDate,
        updatedAt: now,
        updatedBy: actorName,
      };
      batch.update(doc(db, PAYROLLS_COLLECTION, record.id), changes);
      batch.update(doc(db, SALARY_SLIPS_COLLECTION, record.id), {
        status,
        paymentDate: nextPaymentDate,
        updatedAt: now,
      });
    });
    await batch.commit();
  },

  subscribeAll(
    callback: (records: PayrollRecord[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      collection(db, PAYROLLS_COLLECTION),
      (snapshot) =>
        callback(
          snapshot.docs.map((entry) => ({
            id: entry.id,
            ...entry.data(),
          })) as PayrollRecord[],
        ),
      (error) => {
        if (handleFirestoreError(error)) return;
        onError?.(error as Error);
      },
    );
  },

  subscribeForEmployee(
    email: string,
    callback: (records: PayrollRecord[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    const normalizedEmail = email.trim().toLowerCase();
    return onSnapshot(
      query(
        collection(db, PAYROLLS_COLLECTION),
        where("employeeEmail", "==", normalizedEmail),
        where("status", "in", ["Processing", "Approved", "Paid"]),
      ),
      (snapshot) =>
        callback(
          snapshot.docs.map((entry) => ({
            id: entry.id,
            ...entry.data(),
          })) as PayrollRecord[],
        ),
      (error) => {
        if (handleFirestoreError(error)) return;
        onError?.(error as Error);
      },
    );
  },

  subscribeForEmployeeAll(
    email: string,
    callback: (records: PayrollRecord[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    const normalizedEmail = email.trim().toLowerCase();
    return onSnapshot(
      query(
        collection(db, PAYROLLS_COLLECTION),
        where("employeeEmail", "==", normalizedEmail),
      ),
      (snapshot) =>
        callback(
          snapshot.docs.map((entry) => ({
            id: entry.id,
            ...entry.data(),
          })) as PayrollRecord[],
        ),
      (error) => {
        if (handleFirestoreError(error)) return;
        onError?.(error as Error);
      },
    );
  },

  async getById(id: string): Promise<PayrollRecord | null> {
    const snapshot = await getDoc(doc(db, PAYROLLS_COLLECTION, id));
    return snapshot.exists()
      ? ({ id: snapshot.id, ...snapshot.data() } as PayrollRecord)
      : null;
  },

  async updatePaymentDate(id: string, paymentDate: string, actorName: string) {
    const now = new Date().toISOString();
    const batch = writeBatch(db);
    batch.update(doc(db, PAYROLLS_COLLECTION, id), {
      paymentDate,
      updatedAt: now,
      updatedBy: actorName,
    });
    batch.update(doc(db, SALARY_SLIPS_COLLECTION, id), {
      paymentDate,
      updatedAt: now,
    });
    await batch.commit();
  },
};
