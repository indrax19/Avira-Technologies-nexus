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

export interface EmployeeData {
  id?: string;
  employeeId: string;
  fullName: string;
  department: string;
  designation: string;
  employeeCategory: string;
  grade: string;
  city: string;
  mobileNumber: string;
  officialEmail: string;
  dateOfJoining: string;
  employmentType: string;
  employmentStatus: string;
  reportingTo: string;
  [key: string]: string | undefined;
}

const EMPLOYEES_COLLECTION = "employees";

export const employeesAPI = {
  async create<T extends object>(employee: T, createdBy?: string) {
    const now = new Date().toISOString();
    const data = removeUndefined({ ...employee, created_by: createdBy, created_at: now, updated_at: now });
    const reference = await addDoc(collection(db, EMPLOYEES_COLLECTION), data);
    return { id: reference.id, ...data } as EmployeeData;
  },

  async update<T extends object>(id: string, employee: T, updatedBy?: string) {
    await updateDoc(doc(db, EMPLOYEES_COLLECTION, id), removeUndefined({ ...employee, updated_by: updatedBy, updated_at: new Date().toISOString() }));
  },

  async delete(id: string) {
    await deleteDoc(doc(db, EMPLOYEES_COLLECTION, id));
  },

  subscribeAll(callback: (employees: EmployeeData[]) => void, onError?: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, EMPLOYEES_COLLECTION), orderBy("created_at", "desc")),
      (snapshot) => callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })) as EmployeeData[]),
      (error) => {
        if (handleFirestoreError(error)) return;
        onError?.(error as Error);
      },
    );
  },
};
