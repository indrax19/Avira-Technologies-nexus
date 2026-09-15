import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  DocumentData,
  QueryConstraint,
  onSnapshot,
  Unsubscribe,
  writeBatch,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, getAuth } from "firebase/auth";
import { getApps, initializeApp } from "firebase/app";
import { db, auth, firebaseConfig } from "./config";

const accountApp = getApps().find((app) => app.name === "account-creation") || initializeApp(firebaseConfig, "account-creation");
const accountAuth = getAuth(accountApp);
import { handleFirestoreError } from "./utils";

/**
 * Available permissions/pages for the RBAC system
 *
 * To add a new page:
 * 1. Add a new permission object here with { id: "page-id", label: "Display Name" }
 * 2. Add the route in App.tsx with requiredPermission="page-id"
 * 3. Add the page to AppSidebar.tsx navItems with permission: "page-id"
 *
 * The permission will automatically appear in the admin panel!
 */
export interface PagePermission {
  id: string;
  label: string;
  description: string;
  group: string;
}

export const AVAILABLE_PERMISSIONS: PagePermission[] = [
  { id: "dashboard", label: "Dashboard", description: "View the project dashboard", group: "Dashboard" },

  { id: "partner", label: "Partners", description: "Manage business partners", group: "Business Relations" },
  { id: "customer-data", label: "Customers", description: "Manage customer contacts and email campaigns", group: "Business Relations" },
  { id: "vendor-database", label: "Vendors", description: "Manage vendor contacts and details", group: "Business Relations" },
  { id: "contacts", label: "Contacts", description: "Manage business contacts", group: "Business Relations" },
  { id: "outreach-mill", label: "Outreach & Activities", description: "Manage outreach and activities", group: "Business Relations" },

  { id: "leads", label: "Leads", description: "Manage sales leads", group: "Sales & Commercial" },
  { id: "opportunities", label: "Opportunities", description: "Manage sales opportunities", group: "Sales & Commercial" },
  { id: "quotations", label: "Quotations", description: "Create and manage quotations", group: "Sales & Commercial" },
  { id: "sales-orders", label: "Sales Orders", description: "Manage sales orders", group: "Sales & Commercial" },
  { id: "contracts", label: "Contracts", description: "Manage commercial contracts", group: "Sales & Commercial" },

  { id: "purchase-requests", label: "Purchase Requests", description: "Manage purchase requests", group: "Procurement" },
  { id: "rfqs", label: "RFQs", description: "Manage requests for quotation", group: "Procurement" },
  { id: "vendor-quotations", label: "Vendor Quotations", description: "Manage vendor quotations", group: "Procurement" },
  { id: "purchase-comparison", label: "Purchase Comparison", description: "Compare procurement quotations", group: "Procurement" },
  { id: "purchase-orders", label: "Purchase Orders", description: "Manage purchase orders", group: "Procurement" },
  { id: "grn", label: "GRN", description: "Manage goods received notes", group: "Procurement" },

  { id: "project-tracking", label: "Projects", description: "Manage projects and project tracking", group: "Projects & Operations" },
  { id: "sites", label: "Sites", description: "Manage project sites", group: "Projects & Operations" },
  { id: "assignments", label: "Assignments", description: "Manage project assignments", group: "Projects & Operations" },
  { id: "tasks", label: "Tasks", description: "Organize operational tasks", group: "Projects & Operations" },
  { id: "site-visit", label: "Site Visits", description: "Plan and track site visits", group: "Projects & Operations" },
  { id: "deployment", label: "Deployment", description: "Coordinate deployment activities", group: "Projects & Operations" },

  { id: "general-costing", label: "General Costing", description: "Manage general cost structures", group: "Costing & Profitability" },
  { id: "tax-gst", label: "Tax & GST", description: "Manage tax and GST settings", group: "Costing & Profitability" },
  { id: "project-costing", label: "Project Costing", description: "Manage project cost estimates", group: "Costing & Profitability" },
  { id: "labour-costing", label: "Labour Costing", description: "Manage labour costs", group: "Costing & Profitability" },
  { id: "expense-costing", label: "Expense Costing", description: "Manage expense costs", group: "Workforce & HR" },
  { id: "profitability", label: "Profitability", description: "Review profitability", group: "Costing & Profitability" },

  { id: "domains", label: "Domains", description: "Manage domain subscriptions", group: "Subscriptions & Renewals" },
  { id: "hosting", label: "Hosting", description: "Manage hosting subscriptions", group: "Subscriptions & Renewals" },
  { id: "ssl", label: "SSL", description: "Manage SSL certificates", group: "Subscriptions & Renewals" },
  { id: "software-licenses", label: "Software Licenses", description: "Manage software licenses", group: "Subscriptions & Renewals" },
  { id: "sla", label: "SLA", description: "Manage service-level agreements", group: "Subscriptions & Renewals" },
  { id: "amc", label: "AMC", description: "Manage annual maintenance contracts", group: "Subscriptions & Renewals" },
  { id: "oem-renewals", label: "OEM Renewals", description: "Manage OEM renewals", group: "Subscriptions & Renewals" },
  { id: "renewal-calendar", label: "Renewal Calendar", description: "View upcoming renewals", group: "Subscriptions & Renewals" },

  { id: "invoices", label: "Invoices", description: "Create and manage invoices", group: "Billing & Invoicing" },
  { id: "payments", label: "Payments", description: "Manage invoice payments", group: "Billing & Invoicing" },

  { id: "employees", label: "Employees", description: "Manage employee records", group: "Workforce & HR" },
  { id: "attendance", label: "Attendance", description: "Manage attendance records", group: "Workforce & HR" },
  { id: "field-attendance", label: "Field Attendance", description: "Manage field attendance", group: "Workforce & HR" },
  { id: "monthly-payroll", label: "Monthly Payroll", description: "Manage monthly payroll", group: "Workforce & HR" },
  { id: "tada-expenses", label: "TADA & Expenses", description: "Manage travel and daily allowance expenses", group: "Workforce & HR" },

  { id: "profile", label: "Profile", description: "View and manage your profile", group: "Workforce & HR" },
  { id: "settings", label: "Settings", description: "Configure company profile settings", group: "Admin" },
];

export function getAllPermissions(): string[] {
  return AVAILABLE_PERMISSIONS.map((permission) => permission.id);
}

export function getPermissionLabel(permissionId: string): string {
  const permission = AVAILABLE_PERMISSIONS.find((permission) => permission.id === permissionId);
  if (permission) return permission.label;
  if (permissionId === "project-tracking") return "Projects (legacy group)";
  return permissionId;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "user";
  isDisabled: boolean;
  permissions: string[]; // Array of page permissions (e.g., ['dashboard', 'inventory', 'delivery-challans'])
  employeeId?: string;
  employeeRecordId?: string;
  createdAt: string;
  updatedAt: string;
}

const USERS_COLLECTION = "users";
const EMPLOYEES_COLLECTION = "employees";

async function nextEmployeeId() {
  const [usersSnapshot, employeesSnapshot] = await Promise.all([
    getDocs(collection(db, USERS_COLLECTION)),
    getDocs(collection(db, EMPLOYEES_COLLECTION)),
  ]);
  const ids = [
    ...usersSnapshot.docs.map((entry) => entry.data().employeeId),
    ...employeesSnapshot.docs.map((entry) => entry.data().employeeId),
  ];
  const highest = ids.reduce((value, id) => {
    const match = typeof id === "string" ? id.match(/^EMP-(\d+)$/) : null;
    return Math.max(value, match ? Number(match[1]) : 0);
  }, 0);
  return `EMP-${String(highest + 1).padStart(6, "0")}`;
}

export const usersAPI = {
  async getAll(): Promise<User[]> {
    try {
      const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as User[];
    } catch (error: any) {
      // Silently ignore AbortError - it's expected when queries are cancelled
      if (error.name === "AbortError" || error.code === "aborted") {
        return [];
      }
      console.error("Error fetching users:", error);
      throw error;
    }
  },

  async getByEmail(email: string): Promise<User | null> {
    try {
      const q = query(
        collection(db, USERS_COLLECTION),
        where("email", "==", email.toLowerCase())
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      } as User;
    } catch (error: any) {
      // Silently ignore AbortError - it's expected when queries are cancelled (e.g., component unmounts)
      if (error.name === "AbortError" || error.code === "aborted") {
        return null;
      }
      console.error("Error fetching user by email:", error);
      throw error;
    }
  },

  async getById(id: string): Promise<User | null> {
    try {
      const docRef = doc(db, USERS_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as User;
    } catch (error: any) {
      // Silently ignore AbortError - it's expected when queries are cancelled
      if (error.name === "AbortError" || error.code === "aborted") {
        return null;
      }
      console.error("Error fetching user by id:", error);
      throw error;
    }
  },

  async create(user: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    try {
      const docRef = doc(collection(db, USERS_COLLECTION));
      const userData = {
        ...user,
        email: user.email.toLowerCase(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(docRef, userData);
      return {
        id: docRef.id,
        ...userData,
      } as User;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  },

  async update(id: string, updates: Partial<Omit<User, "id" | "createdAt">>): Promise<void> {
    try {
      const docRef = doc(db, USERS_COLLECTION, id);
      const updatedAt = new Date().toISOString();
      await updateDoc(docRef, { ...updates, updatedAt });
      const currentUser = await this.getById(id);
      if (currentUser?.employeeRecordId) {
        await updateDoc(doc(db, EMPLOYEES_COLLECTION, currentUser.employeeRecordId), {
          ...(updates.fullName !== undefined ? { fullName: updates.fullName } : {}),
          ...(updates.email !== undefined ? { officialEmail: updates.email.toLowerCase() } : {}),
          updated_at: updatedAt,
        });
      }
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const user = await this.getById(id);
      const batch = writeBatch(db);
      batch.delete(doc(db, USERS_COLLECTION, id));
      if (user?.employeeRecordId) batch.delete(doc(db, EMPLOYEES_COLLECTION, user.employeeRecordId));
      await batch.commit();
    } catch (error) {
      console.error("Error deleting user:", error);
      throw error;
    }
  },

  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      // Send password reset email to user
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      if (error.code === "auth/user-not-found") {
        throw new Error("User not found in the system.");
      }
      throw new Error(error.message || "Failed to send password reset email");
    }
  },

  async setTemporaryPassword(userId: string, email: string, newPassword: string): Promise<void> {
    try {
      // Validate password
      if (!newPassword || newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
      }

      // NOTE: Firebase Client SDK doesn't provide a direct way for one user to change another's password
      // This function serves as a placeholder for a backend implementation using Firebase Admin SDK
      // For now, we recommend using sendPasswordResetEmail instead

      console.warn(
        "Direct password setting requires Firebase Admin SDK on backend. " +
        "For client-side implementation, use sendPasswordResetEmail instead."
      );

      throw new Error(
        "For security reasons, use 'Send Password Reset Email' option instead. " +
        "User will receive an email to set their own password. " +
        "For direct password setting, implement this on your backend using Firebase Admin SDK."
      );
    } catch (error: any) {
      console.error("Error setting temporary password:", error);
      throw error;
    }
  },

  async createWithPassword(
    email: string,
    password: string,
    fullName: string,
    role: "admin" | "user" = "user",
    permissions: string[] = [],
    employeeDetails: Record<string, string> = {},
  ): Promise<User> {
    try {
      // Validate inputs
      if (!email || !password || !fullName) {
        throw new Error("Email, password, and full name are required.");
      }

      // Validate password
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
      }

      // Check if email already exists in Firestore
      try {
        const existingUser = await this.getByEmail(email);
        if (existingUser) {
          throw new Error("This email is already registered. Please use a different email.");
        }
      } catch (error: any) {
        // Silently ignore AbortError during email check
        if (error.name === "AbortError" || error.code === "aborted") {
          // Continue with creation - if email exists, auth creation will fail
        } else {
          throw error;
        }
      }

      // Create Firebase Auth user
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(
          accountAuth,
          email,
          password
        );
      } catch (authError: any) {
        if (authError.code === "auth/email-already-in-use") {
          throw new Error(
            "This email is already registered in the system. Please use a different email or contact the administrator."
          );
        } else if (authError.code === "auth/invalid-email") {
          throw new Error("Please enter a valid email address.");
        } else if (authError.code === "auth/weak-password") {
          throw new Error("Password is too weak. Please use a stronger password.");
        }
        throw authError;
      }

      const employeeId = await nextEmployeeId();
      const now = new Date().toISOString();
      const docRef = doc(collection(db, USERS_COLLECTION));
      const employeeRef = doc(collection(db, EMPLOYEES_COLLECTION));
      const userData = {
        email: email.toLowerCase(),
        fullName,
        role,
        isDisabled: false,
        permissions: role === "admin" ? getAllPermissions() : permissions,
        employeeId,
        employeeRecordId: employeeRef.id,
        createdAt: now,
        updatedAt: now,
      };
      const employeeData = {
        ...employeeDetails,
        userId: docRef.id,
        employeeId,
        fullName,
        officialEmail: employeeDetails.officialEmail || email.toLowerCase(),
        accountEmail: email.toLowerCase(),
        employmentStatus: employeeDetails.employmentStatus || "Active",
        created_by: docRef.id,
        created_at: now,
        updated_at: now,
      };

      try {
        const batch = writeBatch(db);
        batch.set(docRef, userData);
        batch.set(employeeRef, employeeData);
        await batch.commit();
      } catch (firestoreError: any) {
        // If Firestore fails, try to clean up the Auth user
        try {
          // Get the current user and delete them
          const user = auth.currentUser;
          if (user && user.email === email) {
            await user.delete();
          }
        } catch (deleteError) {
          console.error("Failed to clean up auth user:", deleteError);
        }
        throw new Error("Failed to create user record. Please try again.");
      }

      return {
        id: docRef.id,
        ...userData,
      } as User;
    } catch (error: any) {
      console.error("Error creating user with password:", error);
      throw new Error(
        error.message || "Failed to create user. Please try again."
      );
    }
  },

  // Real-time listener for all users
  subscribeAll(
    callback: (users: User[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, USERS_COLLECTION));
    return onSnapshot(
      q,
      (snapshot) => {
        const users = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as User[];
        callback(users);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in users subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  // Real-time listener for a single user
  subscribeById(
    id: string,
    callback: (user: User | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const docRef = doc(db, USERS_COLLECTION, id);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback({ id: snapshot.id, ...snapshot.data() } as User);
        } else {
          callback(null);
        }
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in user subscription:", error);
        onError?.(error as Error);
      }
    );
  },
};
