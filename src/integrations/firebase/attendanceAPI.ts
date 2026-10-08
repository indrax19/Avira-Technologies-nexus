import {
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./config";
import { handleFirestoreError } from "./utils";

export type AttendanceStatus = "Present" | "Late" | "Early Checkout" | "Late & Early Checkout" | "Missing Check-in" | "Missing Check-out" | "On Leave" | "Absent" | "Weekly Off";

export interface AttendanceSession {
  checkInAt: string;
  checkOutAt?: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  employeeId: string;
  employeeName: string;
  email: string;
  department: string;
  shift: string;
  dateKey: string;
  checkInAt?: string;
  checkOutAt?: string;
  sessions?: AttendanceSession[];
  status: AttendanceStatus;
  late: boolean;
  workingMinutes: number;
  overtimeMinutes: number;
  createdAt: string;
  updatedAt: string;
  adminEntry?: boolean;
  note?: string;
  selfieUrl?: string;
  selfieStoragePath?: string;
  latitude?: number;
  longitude?: number;
}

export interface AttendanceEmployee {
  userId: string;
  employeeId: string;
  employeeName: string;
  email: string;
  department?: string;
  shift?: string;
}

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type Weekday = typeof WEEKDAYS[number];

export interface OfficeDaySchedule {
  enabled: boolean;
  checkInTime: string;
  checkOutTime: string;
}

export interface AttendanceSettings {
  requiredWorkingHours: number;
  gracePeriodMinutes: number;
  absentCutoffTime: string;
  weeklySchedule: Record<Weekday, OfficeDaySchedule>;
  checkInTime?: string;
  checkOutTime?: string;
  updatedAt?: string;
}

const DEFAULT_DAY_SCHEDULE: OfficeDaySchedule = {
  enabled: true,
  checkInTime: "09:15",
  checkOutTime: "17:00",
};

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  requiredWorkingHours: 8,
  gracePeriodMinutes: 15,
  absentCutoffTime: "11:00",
  checkInTime: "09:15",
  checkOutTime: "17:00",
  weeklySchedule: WEEKDAYS.reduce((schedule, weekday) => {
    schedule[weekday] = { ...DEFAULT_DAY_SCHEDULE, enabled: weekday !== "Sunday" };
    return schedule;
  }, {} as Record<Weekday, OfficeDaySchedule>),
};

export function normalizeAttendanceSettings(data?: Partial<AttendanceSettings>): AttendanceSettings {
  return {
    requiredWorkingHours: data?.requiredWorkingHours || DEFAULT_ATTENDANCE_SETTINGS.requiredWorkingHours,
    gracePeriodMinutes: data?.gracePeriodMinutes ?? DEFAULT_ATTENDANCE_SETTINGS.gracePeriodMinutes,
    absentCutoffTime: data?.absentCutoffTime || DEFAULT_ATTENDANCE_SETTINGS.absentCutoffTime,
    weeklySchedule: WEEKDAYS.reduce((schedule, weekday) => {
      schedule[weekday] = {
        ...DEFAULT_ATTENDANCE_SETTINGS.weeklySchedule[weekday],
        ...(data?.weeklySchedule?.[weekday] || {}),
      };
      return schedule;
    }, {} as Record<Weekday, OfficeDaySchedule>),
    checkInTime: data?.checkInTime || DEFAULT_ATTENDANCE_SETTINGS.checkInTime,
    checkOutTime: data?.checkOutTime || DEFAULT_ATTENDANCE_SETTINGS.checkOutTime,
    updatedAt: data?.updatedAt,
  };
}

const COLLECTION = "attendance";
const SETTINGS_REFERENCE = doc(db, "attendance_settings", "office");
export const AUTOMATIC_ABSENT_NOTE = "Automatic absent after office cutoff";

function recordId(userId: string, dateKey: string) {
  return `${userId}_${dateKey}`;
}

function mapRecord(id: string, data: Record<string, unknown>): AttendanceRecord {
  return { id, ...data } as AttendanceRecord;
}

export function getAttendanceSessions(record?: AttendanceRecord): AttendanceSession[] {
  if (!record) return [];
  if (record.sessions?.length) return record.sessions;
  return record.checkInAt ? [{ checkInAt: record.checkInAt, ...(record.checkOutAt ? { checkOutAt: record.checkOutAt } : {}) }] : [];
}

export function getLatestAttendanceSession(record?: AttendanceRecord): AttendanceSession | undefined {
  const sessions = getAttendanceSessions(record);
  return sessions[sessions.length - 1];
}

export function hasOpenAttendanceSession(record?: AttendanceRecord): boolean {
  const latestSession = getLatestAttendanceSession(record);
  return Boolean(latestSession && !latestSession.checkOutAt);
}

function getWorkingMinutes(sessions: AttendanceSession[]) {
  return sessions.reduce((total, session) => total + (session.checkOutAt ? Math.max(0, Math.round((new Date(session.checkOutAt).getTime() - new Date(session.checkInAt).getTime()) / 60000)) : 0), 0);
}

function toError(error: unknown, action: string) {
  const firestoreError = error as { code?: string; message?: string };
  if (firestoreError.code === "permission-denied") {
    return new Error("You do not have permission to update attendance.");
  }
  return new Error(firestoreError.message || `Unable to ${action}.`);
}

export const attendanceAPI = {
  async checkIn(employee: AttendanceEmployee, dateKey: string, timestamp: string, isLate: boolean, options?: { adminEntry?: boolean; note?: string; selfieUrl?: string; selfieStoragePath?: string; latitude?: number; longitude?: number; requiredWorkingMinutes?: number }) {
    const reference = doc(db, COLLECTION, recordId(employee.userId, dateKey));

    try {
      return await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(reference);
        const existing = snapshot.exists() ? mapRecord(snapshot.id, snapshot.data()) : undefined;
        const sessions = getAttendanceSessions(existing);
        const latestSession = sessions[sessions.length - 1];
        const cutoffTimestamp = new Date(`${dateKey}T18:00:00+05:00`).toISOString();
        const canApplyCutoff = Boolean(latestSession && !latestSession.checkOutAt && new Date(timestamp) >= new Date(cutoffTimestamp) && new Date(latestSession.checkInAt) <= new Date(cutoffTimestamp));
        if (latestSession && !latestSession.checkOutAt && !canApplyCutoff) return existing!;
        if (existing?.status === "On Leave" || existing?.status === "Weekly Off") return existing;

        const closedSessions = canApplyCutoff ? sessions.map((session, index) => index === sessions.length - 1 ? { ...session, checkOutAt: cutoffTimestamp } : session) : sessions;
        const isFirstClockIn = sessions.length === 0;
        const nextSessions = [...closedSessions, { checkInAt: timestamp }];
        const status = isFirstClockIn || existing?.status === "Absent" ? isLate ? "Late" : "Present" : existing!.status;
        const late = isFirstClockIn || existing?.status === "Absent" ? isLate : existing!.late;
        const workingMinutes = getWorkingMinutes(closedSessions);
        const overtimeMinutes = Math.max(0, workingMinutes - (options?.requiredWorkingMinutes ?? 480));
        const record: AttendanceRecord = existing ? {
          ...existing,
          checkInAt: existing.checkInAt || timestamp,
          sessions: nextSessions,
          status,
          late,
          workingMinutes,
          overtimeMinutes,
          updatedAt: timestamp,
          ...(options?.adminEntry ? { adminEntry: true } : {}),
          ...(options?.selfieUrl ? { selfieUrl: options.selfieUrl } : {}),
          ...(options?.selfieStoragePath ? { selfieStoragePath: options.selfieStoragePath } : {}),
          ...(options?.latitude !== undefined ? { latitude: options.latitude } : {}),
          ...(options?.longitude !== undefined ? { longitude: options.longitude } : {}),
        } : {
          id: reference.id,
          userId: employee.userId,
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          email: employee.email,
          department: employee.department || "Unassigned",
          shift: employee.shift || "Office Shift",
          dateKey,
          checkInAt: timestamp,
          sessions: nextSessions,
          workingMinutes,
          overtimeMinutes,
          status,
          late,
          createdAt: timestamp,
          updatedAt: timestamp,
          ...(options?.adminEntry ? { adminEntry: true } : {}),
          ...(options?.note ? { note: options.note } : {}),
          ...(options?.selfieUrl ? { selfieUrl: options.selfieUrl } : {}),
          ...(options?.selfieStoragePath ? { selfieStoragePath: options.selfieStoragePath } : {}),
          ...(options?.latitude !== undefined ? { latitude: options.latitude } : {}),
          ...(options?.longitude !== undefined ? { longitude: options.longitude } : {}),
        };
        delete record.checkOutAt;
        delete record.note;

        if (existing) transaction.update(reference, { ...record, checkOutAt: deleteField(), note: deleteField() });
        else transaction.set(reference, record);
        return record;
      });
    } catch (error) {
      throw toError(error, "check in");
    }
  },

  async markAbsent(employee: AttendanceEmployee, dateKey: string, timestamp: string, note?: string) {
    const reference = doc(db, COLLECTION, recordId(employee.userId, dateKey));

    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (snapshot.exists()) return;

        transaction.set(reference, {
          id: reference.id,
          userId: employee.userId,
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          email: employee.email,
          department: employee.department || "Unassigned",
          shift: employee.shift || "Office Shift",
          dateKey,
          status: "Absent",
          late: false,
          workingMinutes: 0,
          overtimeMinutes: 0,
          ...(note ? { note } : {}),
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      });
    } catch (error) {
      throw toError(error, "mark absent");
    }
  },

  async restoreAutomaticAbsentClockIn(recordId: string, isLate: boolean) {
    const reference = doc(db, COLLECTION, recordId);
    const timestamp = new Date().toISOString();

    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists()) return;

        const record = mapRecord(snapshot.id, snapshot.data());
        if (record.status !== "Absent" || !record.checkInAt || record.note !== AUTOMATIC_ABSENT_NOTE) return;

        transaction.update(reference, {
          status: isLate ? "Late" : "Present",
          late: isLate,
          note: deleteField(),
          updatedAt: timestamp,
        });
      });
    } catch (error) {
      throw toError(error, "restore clock-in status");
    }
  },

  async markLeave(employee: AttendanceEmployee, dateKey: string, timestamp: string) {
    const reference = doc(db, COLLECTION, recordId(employee.userId, dateKey));
    await setDoc(reference, {
      id: reference.id,
      userId: employee.userId,
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      email: employee.email,
      department: employee.department || "Unassigned",
      shift: employee.shift || "Office Shift",
      dateKey,
      status: "On Leave",
      late: false,
      workingMinutes: 0,
      overtimeMinutes: 0,
      checkInAt: deleteField(),
      checkOutAt: deleteField(),
      sessions: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }, { merge: true });
  },

  async getSettings(): Promise<AttendanceSettings> {
    const snapshot = await getDoc(SETTINGS_REFERENCE);
    return normalizeAttendanceSettings(snapshot.exists() ? snapshot.data() : undefined);
  },

  async updateSettings(settings: AttendanceSettings) {
    await setDoc(SETTINGS_REFERENCE, { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
  },

  subscribeSettings(callback: (settings: AttendanceSettings) => void, onError?: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      SETTINGS_REFERENCE,
      (snapshot) => callback(normalizeAttendanceSettings(snapshot.exists() ? snapshot.data() : undefined)),
      (error) => {
        if (!handleFirestoreError(error)) onError?.(error);
      },
    );
  },

  async updateRecord(recordId: string, updates: Partial<AttendanceRecord>) {
    await setDoc(doc(db, COLLECTION, recordId), { ...updates, updatedAt: new Date().toISOString() }, { merge: true });
  },

  async saveManualEntry(employee: AttendanceEmployee, dateKey: string, entry: { checkInAt?: string; checkOutAt?: string; status: AttendanceStatus; note?: string }) {
    const timestamp = new Date().toISOString();
    const workingMinutes = entry.checkInAt && entry.checkOutAt
      ? Math.max(0, Math.round((new Date(entry.checkOutAt).getTime() - new Date(entry.checkInAt).getTime()) / 60000))
      : 0;
    const reference = doc(db, COLLECTION, recordId(employee.userId, dateKey));
    const record: AttendanceRecord = {
      id: reference.id,
      userId: employee.userId,
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      email: employee.email,
      department: employee.department || "Unassigned",
      shift: employee.shift || "Office Shift",
      dateKey,
      ...(entry.checkInAt ? { checkInAt: entry.checkInAt } : {}),
      ...(entry.checkOutAt ? { checkOutAt: entry.checkOutAt } : {}),
      sessions: entry.checkInAt ? [{ checkInAt: entry.checkInAt, ...(entry.checkOutAt ? { checkOutAt: entry.checkOutAt } : {}) }] : [],
      status: entry.status,
      late: entry.status === "Late" || entry.status === "Late & Early Checkout",
      workingMinutes,
      overtimeMinutes: Math.max(0, workingMinutes - 480),
      ...(entry.note ? { note: entry.note } : {}),
      adminEntry: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await setDoc(reference, record);
    return record;
  },

  async checkOut(userIds: string | string[], dateKey: string, timestamp: string, requiredWorkingMinutes = 480) {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    const references = ids.map((userId) => doc(db, COLLECTION, recordId(userId, dateKey)));

    try {
      return await runTransaction(db, async (transaction) => {
        const snapshots = await Promise.all(references.map((reference) => transaction.get(reference)));
        const referenceIndex = snapshots.findIndex((snapshot) => snapshot.exists());
        if (referenceIndex === -1) throw new Error("Please check in before checking out.");

        const reference = references[referenceIndex];
        const snapshot = snapshots[referenceIndex];
        const record = mapRecord(snapshot.id, snapshot.data());
        const sessions = getAttendanceSessions(record);
        const latestSession = sessions[sessions.length - 1];
        if (!latestSession || latestSession.checkOutAt) return record;

        const nextSessions = sessions.map((session, index) => index === sessions.length - 1 ? { ...session, checkOutAt: timestamp } : session);
        const workingMinutes = getWorkingMinutes(nextSessions);
        const overtimeMinutes = Math.max(0, workingMinutes - requiredWorkingMinutes);
        const updates = { sessions: nextSessions, checkOutAt: timestamp, workingMinutes, overtimeMinutes, updatedAt: timestamp };

        transaction.update(reference, updates);
        return { ...record, ...updates };
      });
    } catch (error) {
      throw toError(error, "check out");
    }
  },

  subscribeAll(callback: (records: AttendanceRecord[]) => void, onError?: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, COLLECTION)),
      (snapshot) => callback(snapshot.docs
        .map((entry) => mapRecord(entry.id, entry.data()))
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey))),
      (error) => {
        if (!handleFirestoreError(error)) onError?.(error);
      },
    );
  },

  subscribeForDate(dateKey: string, callback: (records: AttendanceRecord[]) => void, onError?: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, COLLECTION), where("dateKey", "==", dateKey)),
      (snapshot) => callback(snapshot.docs.map((entry) => mapRecord(entry.id, entry.data()))),
      (error) => {
        if (!handleFirestoreError(error)) onError?.(error);
      },
    );
  },

  subscribeForEmployee(userIds: string | string[], callback: (records: AttendanceRecord[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    return onSnapshot(
      query(collection(db, COLLECTION), where("userId", ids.length === 1 ? "==" : "in", ids.length === 1 ? ids[0] : ids)),
      (snapshot) => callback(snapshot.docs
        .map((entry) => mapRecord(entry.id, entry.data()))
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey))),
      (error) => {
        if (!handleFirestoreError(error)) onError?.(error);
      },
    );
  },
};
