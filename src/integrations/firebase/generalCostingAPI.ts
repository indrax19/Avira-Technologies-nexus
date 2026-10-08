import { collection, addDoc, deleteDoc, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "./config";
import { removeUndefined } from "./utils";

export type AssetRow = { id: string; assetType: string; description: string };
export type PriceRow = { id: string; fieldName: string; qty: number; unitCost: number; actualUnitPrice: number; whtPct: number; taxPct: number };
export type Company = { name: string; address: string; phone: string; email: string };
export type CalculatedRow = PriceRow & { totalCost: number; totalAmount: number; margin: number; marginPct: number; unitPriceWithWht: number; whtTotal: number; taxAmount: number };
export type Totals = { cost: number; sale: number; tax: number; profit: number; wht: number };
export type GeneralCostingRecord = { id: string; company: Company; assets: AssetRow[]; rows: CalculatedRow[]; totals: Totals; created_at?: string; updated_at?: string };

type GeneralCostingInput = Omit<GeneralCostingRecord, "id" | "created_at" | "updated_at">;

const collectionName = "general_costings";

export const generalCostingAPI = {
  async getAll(): Promise<GeneralCostingRecord[]> {
    const snapshot = await getDocs(query(collection(db, collectionName), orderBy("created_at", "desc")));
    return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })) as GeneralCostingRecord[];
  },

  async create(record: GeneralCostingInput): Promise<GeneralCostingRecord> {
    const now = new Date().toISOString();
    const data = removeUndefined({ ...record, created_at: now, updated_at: now });
    const reference = await addDoc(collection(db, collectionName), data);
    return { id: reference.id, ...data } as GeneralCostingRecord;
  },

  async update(id: string, record: GeneralCostingInput): Promise<void> {
    await updateDoc(doc(db, collectionName, id), removeUndefined({ ...record, updated_at: new Date().toISOString() }));
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, collectionName, id));
  },
};
