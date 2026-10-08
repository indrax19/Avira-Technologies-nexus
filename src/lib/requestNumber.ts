import { doc, runTransaction } from "firebase/firestore";
import { db } from "@/integrations/firebase/config";

export async function createRequestNumber(prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const counterRef = doc(db, "sequences", `request_${prefix}_${year}`);
  const number = await runTransaction(db, async (transaction) => {
    const counter = await transaction.get(counterRef);
    const nextNumber = (counter.exists() ? counter.data().nextNumber || 0 : 0) + 1;
    transaction.set(counterRef, { nextNumber, updated_at: new Date().toISOString() });
    return nextNumber;
  });
  return `${prefix}-${year}-${String(number).padStart(4, "0")}`;
}
