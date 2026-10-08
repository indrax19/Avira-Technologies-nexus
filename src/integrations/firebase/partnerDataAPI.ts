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

export interface PartnershipContact {
  name: string;
  city: string;
  state: string;
  country: string;
  accountManager: string;
  salesOwner: string;
  email: string;
  phone: string;
}

export interface PartnerData {
  id?: string;
  partnerId: string;
  partnerName: string;
  brand: string;
  partnerTier: string;
  partnerStatus: string;
  associatedCompany: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  partnershipSince: string;
  validTill: string;
  authorizationNo: string;
  accountManager: string;
  accountManagerName?: string;
  accountManagerEmail?: string;
  accountManagerPhone?: string;
  salesOwner: string;
  salesOwnerName?: string;
  salesOwnerEmail?: string;
  salesOwnerPhone?: string;
  username: string;
  password: string;
  portalUrl?: string;
  partnershipType?: string;
  partnershipTypeOther?: string;
  partnershipContacts?: PartnershipContact[];
  partnerTierLevel?: string;
  partnerTierOther?: string;
  partnerTierLevelOther?: string;
  notes?: string;
  partnerDocumentUrl?: string;
  businessCardUrl?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export type PartnerInput = Omit<
  PartnerData,
  "id" | "created_at" | "updated_at"
>;

export function isPartnerExpiringSoon(validTill?: string, now = new Date()) {
  if (!validTill) return false;
  const expiryDate = new Date(`${validTill}T00:00:00`);
  if (Number.isNaN(expiryDate.getTime())) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneWeekFromToday = new Date(today);
  oneWeekFromToday.setDate(oneWeekFromToday.getDate() + 7);
  return expiryDate >= today && expiryDate <= oneWeekFromToday;
}

const PARTNERS_COLLECTION = "partner_data";

export const partnerDataAPI = {
  async create(partner: PartnerInput) {
    const now = new Date().toISOString();
    const data = removeUndefined({
      ...partner,
      created_at: now,
      updated_at: now,
    });
    const reference = await addDoc(collection(db, PARTNERS_COLLECTION), data);
    return { id: reference.id, ...data } as PartnerData;
  },
  async update(id: string, partner: Partial<PartnerData>) {
    await updateDoc(
      doc(db, PARTNERS_COLLECTION, id),
      removeUndefined({ ...partner, updated_at: new Date().toISOString() }),
    );
  },
  async delete(id: string) {
    await deleteDoc(doc(db, PARTNERS_COLLECTION, id));
  },
  subscribeAll(
    callback: (partners: PartnerData[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(collection(db, PARTNERS_COLLECTION), orderBy("created_at", "desc")),
      (snapshot) =>
        callback(
          snapshot.docs.map((entry) => ({
            id: entry.id,
            ...entry.data(),
          })) as PartnerData[],
        ),
      (error) => {
        if (handleFirestoreError(error)) return;
        onError?.(error as Error);
      },
    );
  },
};
