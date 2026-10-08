import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./config";
import { handleFirestoreError, removeUndefined } from "./utils";

export type HostingStatus = "Active" | "Expiring Soon" | "Expired";

export function isHostingExpiringSoon(nextRenewalDate?: string, now = new Date()) {
  if (!nextRenewalDate) return false;
  const date = new Date(`${nextRenewalDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneWeekFromToday = new Date(today);
  oneWeekFromToday.setDate(oneWeekFromToday.getDate() + 7);
  return date >= today && date <= oneWeekFromToday;
}

export interface HostingData {
  id?: string;
  hostingId: string;
  registrationDate: string;
  company: string;
  status: HostingStatus;
  hostingType: string;
  hostingPlan: string;
  domain: string;
  serverLocation: string;
  controlPanel: string;
  bandwidth: string;
  diskSpace: string;
  websites: number;
  emailAccounts: number;
  setupCharges: number;
  monthlyCharges: number;
  billingCycle: string;
  gstRate: number;
  gstAmount: number;
  nextBillingDate: string;
  provider: string;
  username: string;
  password: string;
  nameServers: string;
  autoRenewal: string;
  nextRenewalDate: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export const hostingAPI = {
  async create(hosting: Omit<HostingData, "id" | "created_at" | "updated_at">) {
    const now = new Date().toISOString();
    const data = removeUndefined({ ...hosting, created_at: now, updated_at: now });
    const reference = await addDoc(collection(db, "hosting"), data);
    return { id: reference.id, ...data } as HostingData;
  },

  async update(id: string, hosting: Partial<HostingData>) {
    await updateDoc(doc(db, "hosting", id), removeUndefined({ ...hosting, updated_at: new Date().toISOString() }));
  },

  async delete(id: string) {
    await deleteDoc(doc(db, "hosting", id));
  },

  subscribeAll(callback: (hosting: HostingData[]) => void, onError?: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, "hosting"), orderBy("created_at", "desc")),
      (snapshot) => callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })) as HostingData[]),
      (error) => {
        if (handleFirestoreError(error)) return;
        onError?.(error as Error);
      },
    );
  },
};
