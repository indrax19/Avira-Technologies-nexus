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

export type RentalVehicleRequest = {
  id: string;
  request_no: string;
  request_type: "rental-car";
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

type NewRentalVehicleRequest = Omit<RentalVehicleRequest, "id">;
const COLLECTION = "rental_vehicle_requests";

export const rentalVehicleRequestsAPI = {
  async create(record: NewRentalVehicleRequest, id: string = crypto.randomUUID()): Promise<RentalVehicleRequest> {
    const saved = { ...record, id };
    await setDoc(doc(db, COLLECTION, id), removeUndefined(saved));
    return saved;
  },

  async update(record: RentalVehicleRequest): Promise<void> {
    await setDoc(doc(db, COLLECTION, record.id), removeUndefined(record));
  },

  async approve(id: string, approvedBy: string, approvedByEmail: string | undefined, approvedAt: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), removeUndefined({
      status: "Approved" as const,
      approved_by: approvedBy,
      approved_by_email: approvedByEmail,
      approved_at: approvedAt,
      updated_at: approvedAt,
    }));
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  subscribeAll(callback: (records: RentalVehicleRequest[], fromCache: boolean) => void, onError?: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, COLLECTION), orderBy("created_at", "desc")),
      { includeMetadataChanges: true },
      (snapshot) => callback(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }) as RentalVehicleRequest), snapshot.metadata.fromCache),
      onError,
    );
  },

  subscribeByOwner(ownerUid: string, callback: (records: RentalVehicleRequest[], fromCache: boolean) => void, onError?: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, COLLECTION), or(where("owner_uid", "==", ownerUid), where("created_by", "==", ownerUid))),
      { includeMetadataChanges: true },
      (snapshot) => callback(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }) as RentalVehicleRequest).sort((a, b) => b.created_at.localeCompare(a.created_at)), snapshot.metadata.fromCache),
      onError,
    );
  },
};
