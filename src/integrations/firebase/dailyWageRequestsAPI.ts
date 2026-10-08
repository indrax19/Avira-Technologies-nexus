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

const COLLECTION = "daily_wage_requests";

type DailyWageRequestRecord = { id: string };

export const dailyWageRequestsAPI = {
  async create<T extends DailyWageRequestRecord>(record: T): Promise<void> {
    await setDoc(doc(db, COLLECTION, record.id), { ...record });
  },

  async update<T extends DailyWageRequestRecord>(record: T): Promise<void> {
    await updateDoc(doc(db, COLLECTION, record.id), { ...record });
  },

  async setStatus(id: string, status: "Pending" | "Cleared", updatedAt: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), { status, updated_at: updatedAt });
  },

  async approve(id: string, approvedBy: string, approvedByEmail: string, approvedAt: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), { approval_status: "Approved", approved_by: approvedBy, approved_by_email: approvedByEmail, approved_at: approvedAt, updated_at: approvedAt });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  subscribeAll<T extends DailyWageRequestRecord>(
    callback: (records: T[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(collection(db, COLLECTION), orderBy("created_at", "desc")),
      (snapshot) => callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })) as T[]),
      onError,
    );
  },

  subscribeByOwner<T extends DailyWageRequestRecord>(
    ownerUid: string,
    callback: (records: T[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(collection(db, COLLECTION), or(where("owner_uid", "==", ownerUid), where("created_by", "==", ownerUid))),
      (snapshot) => callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })) as T[]),
      onError,
    );
  },
};
