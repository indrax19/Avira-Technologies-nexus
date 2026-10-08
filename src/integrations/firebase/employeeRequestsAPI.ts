import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  or,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./config";
import { removeUndefined } from "./utils";

export type EmployeeRequestType = "loan" | "advance-salary" | "room-rent";
export type EmployeeRequest = {
  id: string;
  request_no: string;
  request_type: EmployeeRequestType;
  status: "Draft" | "Pending Approval" | "Approved";
  requested_by: string;
  submitted_by?: string;
  submitted_by_email?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  owner_uid?: string;
  owner_email?: string;
  approved_by?: string;
  approved_by_email?: string;
  approved_at?: string;
  fields: Record<string, string>;
};

type NewEmployeeRequest = Omit<EmployeeRequest, "id">;
const COLLECTIONS: Record<EmployeeRequestType, string> = {
  loan: "loan_requests",
  "advance-salary": "advance_salary_requests",
  "room-rent": "room_rent_requests",
};

export const employeeRequestsAPI = {
  async create(type: EmployeeRequestType, record: NewEmployeeRequest, id: string = crypto.randomUUID()): Promise<EmployeeRequest> {
    const saved = { ...record, id };
    await setDoc(doc(db, COLLECTIONS[type], id), removeUndefined(saved));
    return saved;
  },

  async update(type: EmployeeRequestType, record: EmployeeRequest): Promise<void> {
    await setDoc(doc(db, COLLECTIONS[type], record.id), removeUndefined(record));
  },

  async approve(type: EmployeeRequestType, id: string, approvedBy: string, approvedByEmail: string | undefined, approvedAt: string): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS[type], id), removeUndefined({
      status: "Approved" as const,
      approved_by: approvedBy,
      approved_by_email: approvedByEmail,
      approved_at: approvedAt,
      updated_at: approvedAt,
    }));
  },

  async delete(type: EmployeeRequestType, id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS[type], id));
  },

  subscribeAll(
    type: EmployeeRequestType,
    callback: (records: EmployeeRequest[], fromCache: boolean) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(collection(db, COLLECTIONS[type]), orderBy("created_at", "desc")),
      { includeMetadataChanges: true },
      (snapshot) => callback(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }) as EmployeeRequest), snapshot.metadata.fromCache),
      onError,
    );
  },

  subscribeByOwner(
    type: EmployeeRequestType,
    ownerUid: string,
    callback: (records: EmployeeRequest[], fromCache: boolean) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(collection(db, COLLECTIONS[type]), or(where("owner_uid", "==", ownerUid), where("created_by", "==", ownerUid))),
      { includeMetadataChanges: true },
      (snapshot) => callback(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }) as EmployeeRequest).sort((a, b) => b.created_at.localeCompare(a.created_at)), snapshot.metadata.fromCache),
      onError,
    );
  },
};
