import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const timeZone = "Asia/Karachi";

interface AttendanceSession {
  checkInAt: string;
  checkOutAt?: string;
}

function getPakistanDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function minutesBetween(start: string, end: string) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

export const autoClockOutAttendance = functions.pubsub
  .schedule("every day 18:00")
  .timeZone(timeZone)
  .onRun(async () => {
    const dateKey = getPakistanDateKey(new Date());
    const cutoffAt = new Date(`${dateKey}T18:00:00+05:00`);
    const cutoffTimestamp = cutoffAt.toISOString();
    const [attendanceSnapshot, settingsSnapshot] = await Promise.all([
      db.collection("attendance").where("dateKey", "==", dateKey).get(),
      db.doc("attendance_settings/office").get(),
    ]);
    const requiredWorkingMinutes = Number(settingsSnapshot.data()?.requiredWorkingHours || 8) * 60;

    for (let index = 0; index < attendanceSnapshot.docs.length; index += 50) {
      await Promise.all(attendanceSnapshot.docs.slice(index, index + 50).map((document) => db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(document.ref);
        if (!snapshot.exists) return;
        const record = snapshot.data();
        const sessions: AttendanceSession[] = Array.isArray(record.sessions) && record.sessions.length
          ? record.sessions
          : record.checkInAt
            ? [{ checkInAt: record.checkInAt, ...(record.checkOutAt ? { checkOutAt: record.checkOutAt } : {}) }]
            : [];
        let changed = false;
        const closedSessions = sessions.map((session) => {
          if (session.checkOutAt || new Date(session.checkInAt).getTime() > cutoffAt.getTime()) return session;
          changed = true;
          return { ...session, checkOutAt: cutoffTimestamp };
        });
        if (!changed) return;

        const latestSession = closedSessions[closedSessions.length - 1];
        const workingMinutes = closedSessions.reduce((total, session) => total + (session.checkOutAt ? minutesBetween(session.checkInAt, session.checkOutAt) : 0), 0);
        transaction.update(document.ref, {
          sessions: closedSessions,
          checkOutAt: latestSession?.checkOutAt || admin.firestore.FieldValue.delete(),
          workingMinutes,
          overtimeMinutes: Math.max(0, workingMinutes - requiredWorkingMinutes),
          updatedAt: cutoffTimestamp,
        });
      })));
    }

    functions.logger.info("Attendance auto-checkout completed", { dateKey, records: attendanceSnapshot.size });
  });
