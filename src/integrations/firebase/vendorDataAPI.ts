import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "./config";
import { handleFirestoreError, removeUndefined } from "./utils";

export const dealWithOptions = ["Hikvision", "Dahua", "Pollo", "Cisco", "Huawei", "Fortinet", "Sophos", "Dell", "HP", "Manual Enter"] as const;
export const vendorTypeOptions = ["Dealer", "Reseller", "Manufacture", "Distributer"] as const;

export interface PointOfContact {
  id: string;
  name: string;
  designation: string;
  email: string;
  mobile: string;
}

export interface VendorData {
  id?: string;
  vendorName: string;
  companyName?: string;
  designation?: string;
  contactNumber?: string;
  contactNumber2?: string;
  email?: string;
  address?: string;
  visitingCardUrl?: string;
  dealWith: string[];
  manualDealWith?: string;
  vendorTypes: string[];
  pocs: PointOfContact[];
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export const vendorDataAPI = {
  async create(vendor: Omit<VendorData, "id" | "created_at" | "updated_at">) {
    const now = new Date().toISOString();
    const data = removeUndefined({ ...vendor, created_at: now, updated_at: now });
    const reference = await addDoc(collection(db, "vendor_data"), data);
    return { id: reference.id, ...data };
  },
  async update(id: string, vendor: Partial<VendorData>) {
    await updateDoc(doc(db, "vendor_data", id), removeUndefined({ ...vendor, updated_at: new Date().toISOString() }));
  },
  async delete(id: string) {
    await deleteDoc(doc(db, "vendor_data", id));
  },
  subscribeAll(callback: (vendors: VendorData[]) => void, onError?: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, "vendor_data"), orderBy("created_at", "desc")),
      (snapshot) => callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })) as VendorData[]),
      (error) => {
        if (handleFirestoreError(error)) return;
        onError?.(error as Error);
      },
    );
  },
};
