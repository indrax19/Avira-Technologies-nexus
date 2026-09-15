import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  doc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./config";
import { attendanceAPI, type AttendanceEmployee } from "./attendanceAPI";
import { handleFirestoreError } from "./utils";

export type LeaveRequestStatus = "Pending" | "Approved" | "Rejected";

export interface LeaveRequest {
  id: string;
  userId: string;
  employeeId: string;
  employeeName: string;
  email: string;
  startDate: string;
  endDate: string;
  dates: string[];
  reason: string;
  status: LeaveRequestStatus;
  createdAt: string;
  updatedAt: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
}

const COLLECTION = "leave_requests";

function mapRequest(id: string, data: Record<string, unknown>) {
  return { id, ...data } as LeaveRequest;
}

export function getLeaveDateRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  const current = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export const leaveRequestsAPI = {
  async create(employee: AttendanceEmployee, startDate: string, endDate: string, reason: string) {
    const dates = getLeaveDateRange(startDate, endDate);
    if (!dates.length || !reason.trim()) throw new Error("Leave dates and a reason are required.");
    const now = new Date().toISOString();
    const request = {
      userId: employee.userId,
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      email: employee.email,
      startDate,
      endDate,
      dates,
      reason,
      status: "Pending" as const,
      createdAt: now,
      updatedAt: now,
    };
    const reference = await addDoc(collection(db, COLLECTION), request);
    return { id: reference.id, ...request } as LeaveRequest;
  },

  async updatePending(request: LeaveRequest, userId: string, startDate: string, endDate: string, reason: string) {
    const dates = getLeaveDateRange(startDate, endDate);
    if (!dates.length || !reason.trim() || endDate < startDate) throw new Error("Leave dates and a reason are required.");
    const now = new Date().toISOString();
    await runTransaction(db, async (transaction) => {
      const reference = doc(db, COLLECTION, request.id);
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists()) throw new Error("This leave request is no longer available.");
      const current = mapRequest(snapshot.id, snapshot.data());
      if (current.userId !== userId || current.status !== "Pending") throw new Error("Only your pending leave requests can be edited.");
      transaction.update(reference, { startDate, endDate, dates, reason: reason.trim(), updatedAt: now });
    });
  },

  async deletePending(request: LeaveRequest, userId: string) {
    await runTransaction(db, async (transaction) => {
      const reference = doc(db, COLLECTION, request.id);
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists()) return;
      const current = mapRequest(snapshot.id, snapshot.data());
      if (current.userId !== userId || current.status !== "Pending") throw new Error("Only your pending leave requests can be deleted.");
      transaction.delete(reference);
    });
  },

  async updateStatus(request: LeaveRequest, status: LeaveRequestStatus, reviewerId: string, reviewerName: string, reviewRemarks = "") {
    const now = new Date().toISOString();
    await updateDoc(doc(db, COLLECTION, request.id), {
      status,
      reviewedBy: reviewerId,
      reviewedByName: reviewerName,
      reviewedAt: now,
      reviewRemarks,
      updatedAt: now,
    });

    if (status === "Approved") {
      const employee: AttendanceEmployee = {
        userId: request.userId,
        employeeId: request.employeeId,
        employeeName: request.employeeName,
        email: request.email,
      };
      await Promise.all(getLeaveDateRange(request.startDate, request.endDate).map((dateKey) => attendanceAPI.markLeave(employee, dateKey, now)));
    }
  },

  subscribeAll(callback: (requests: LeaveRequest[]) => void, onError?: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, COLLECTION), orderBy("createdAt", "desc")),
      (snapshot) => callback(snapshot.docs.map((entry) => mapRequest(entry.id, entry.data()))),
      (error) => {
        if (!handleFirestoreError(error)) onError?.(error);
      },
    );
  },

  subscribeForUser(userId: string, callback: (requests: LeaveRequest[]) => void, onError?: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, COLLECTION), where("userId", "==", userId)),
      (snapshot) => callback(snapshot.docs
        .map((entry) => mapRequest(entry.id, entry.data()))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
      (error) => {
        if (!handleFirestoreError(error)) onError?.(error);
      },
    );
  },
};
