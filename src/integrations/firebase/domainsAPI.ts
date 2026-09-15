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

export type DomainStatus = "Active" | "Expiring Soon" | "Expired";

export function isDomainExpired(expiryDate?: string, now = new Date()) {
  if (!expiryDate) return false;
  const date = new Date(`${expiryDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return date < today;
}

export function isDomainExpiringSoon(expiryDate?: string, now = new Date()) {
  if (!expiryDate) return false;
  const date = new Date(`${expiryDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneWeekFromToday = new Date(today);
  oneWeekFromToday.setDate(oneWeekFromToday.getDate() + 7);
  return date >= today && date <= oneWeekFromToday;
}

export interface DomainData {
  id?: string;
  domainId: string;
  registrationDate: string;
  company: string;
  status: DomainStatus;
  domain: string;
  type: string;
  expiryDate: string;
  autoRenewal: string;
  registrar: string;
  whoisPrivacy: string;
  nameservers: string;
  purchasePrice: number;
  renewalPrice: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  billingCycle: string;
  nextRenewal: string;
  registrant: string;
  contactPerson: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  domainEmail?: string;
  domainPassword?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export const domainsAPI = {
  async create(domain: Omit<DomainData, "id" | "created_at" | "updated_at">) {
    const now = new Date().toISOString();
    const data = removeUndefined({ ...domain, created_at: now, updated_at: now });
    const reference = await addDoc(collection(db, "domains"), data);
    return { id: reference.id, ...data } as DomainData;
  },

  async update(id: string, domain: Partial<DomainData>) {
    await updateDoc(doc(db, "domains", id), removeUndefined({ ...domain, updated_at: new Date().toISOString() }));
  },

  async delete(id: string) {
    await deleteDoc(doc(db, "domains", id));
  },

  subscribeAll(callback: (domains: DomainData[]) => void, onError?: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, "domains"), orderBy("created_at", "desc")),
      (snapshot) => callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })) as DomainData[]),
      (error) => {
        if (handleFirestoreError(error)) return;
        onError?.(error as Error);
      },
    );
  },
};
