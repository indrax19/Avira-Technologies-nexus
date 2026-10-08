import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "./config";
import { handleFirestoreError, removeUndefined } from "./utils";

export interface ExpenseRow {
  id: string;
  expenseType: string;
  description: string;
  amount: number;
  tax: number;
  receipt: string;
}

export interface ExpenseStatusChange {
  id: string;
  previousStatus: string;
  newStatus: string;
  changedBy: string;
  changedByEmail?: string;
  changedAt: string;
}

export interface ExpenseData {
  id?: string;
  claimId: string;
  employeeName: string;
  department: string;
  designation: string;
  company: string;
  contactNo: string;
  purpose: string;
  projectSite: string;
  expenseDate: string;
  claimDate: string;
  paymentMode: string;
  advanceReceived: number;
  expenses: ExpenseRow[];
  attachments: string[];
  remarks: string;
  status: string;
  statusHistory?: ExpenseStatusChange[];
  status_updated_by_admin?: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export type ExpenseInput = Omit<ExpenseData, "id" | "created_at" | "updated_at">;
const COLLECTION = "expense_reimbursements";

export const expenseDataAPI = {
  async create(expense: ExpenseInput) {
    const now = new Date().toISOString();
    const data = removeUndefined({ ...expense, created_at: now, updated_at: now });
    const reference = await addDoc(collection(db, COLLECTION), data);
    return { id: reference.id, ...data } as ExpenseData;
  },
  async update(id: string, expense: Partial<ExpenseData>) {
    await updateDoc(doc(db, COLLECTION, id), removeUndefined({ ...expense, updated_at: new Date().toISOString() }));
  },
  async delete(id: string) {
    await deleteDoc(doc(db, COLLECTION, id));
  },
  subscribeAll(callback: (expenses: ExpenseData[]) => void, onError?: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, COLLECTION), orderBy("created_at", "desc")),
      (snapshot) => callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })) as ExpenseData[]),
      (error) => {
        if (handleFirestoreError(error)) return;
        onError?.(error as Error);
      },
    );
  },
};
