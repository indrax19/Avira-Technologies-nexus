import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  CalendarDays,
  ClipboardList,
  Edit3,
  Eye,
  Download,
  FileText,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PermissionDeniedDialog from "@/components/PermissionDeniedDialog";
import { useAuth } from "@/context/AuthContext";
import {
  expenseDataAPI,
  type ExpenseData,
  type ExpenseInput,
  type ExpenseRow,
} from "@/integrations/firebase/expenseDataAPI";
import { supabase } from "@/integrations/supabase/config";

const emptyRow = (): ExpenseRow => ({
  id: crypto.randomUUID(),
  expenseType: "",
  description: "",
  amount: 0,
  tax: 0,
  receipt: "",
});
const expenseStatuses = ["Submitted", "Reviewed", "Approved", "Paid"] as const;
const emptyExpense = (): ExpenseInput => ({
  claimId: "",
  employeeName: "",
  department: "",
  designation: "",
  company: "",
  contactNo: "",
  purpose: "",
  projectSite: "",
  expenseDate: "",
  claimDate: "",
  paymentMode: "",
  advanceReceived: 0,
  expenses: [emptyRow()],
  attachments: [],
  remarks: "",
  status: "Submitted",
});
const totalFor = (expense: Pick<ExpenseData, "expenses">) =>
  expense.expenses.reduce((total, row) => total + Number(row.amount || 0), 0);

export default function ExpenseCosting() {
  const { appUser, isAdmin } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ExpenseInput>(emptyExpense());
  const [editingExpense, setEditingExpense] = useState<ExpenseData | null>(
    null,
  );
  const [viewingExpense, setViewingExpense] = useState<ExpenseData | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<ExpenseData | null>(null);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [pageSize, setPageSize] = useState<number | "all">(15);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(
    () =>
      expenseDataAPI.subscribeAll(setExpenses, () =>
        toast.error("Unable to load expenses."),
      ),
    [],
  );

  const visibleExpenses = useMemo(
    () =>
      isAdmin
        ? expenses
        : expenses.filter((expense) => expense.created_by === appUser?.id),
    [appUser?.id, expenses, isAdmin],
  );
  const filteredExpenses = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      const belongsToUser = isAdmin || expense.created_by === appUser?.id;
      const pendingOnly = statusFilter === "Pending";
      return (
        belongsToUser &&
        (!pendingOnly || expense.status !== "Paid") &&
        (!needle ||
          [
            expense.claimId,
            expense.employeeName,
            expense.department,
            expense.projectSite,
          ].some((value) => value?.toLowerCase().includes(needle))) &&
        (statusFilter === "All" ||
          statusFilter === "Pending" ||
          expense.status === statusFilter)
      );
    });
  }, [appUser?.id, expenses, isAdmin, search, statusFilter]);
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(filteredExpenses.length / pageSize));
  const paginatedExpenses = useMemo(() => {
    if (pageSize === "all") return filteredExpenses;
    const start = (currentPage - 1) * pageSize;
    return filteredExpenses.slice(start, start + pageSize);
  }, [currentPage, filteredExpenses, pageSize]);
  const pageStart = filteredExpenses.length === 0 ? 0 : pageSize === "all" ? 1 : (currentPage - 1) * pageSize + 1;
  const pageEnd = pageSize === "all" ? filteredExpenses.length : Math.min(currentPage * pageSize, filteredExpenses.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const saveExpense = useMutation({
    mutationFn: async () => {
      if (!isAdmin && (editingExpense?.status_updated_by_admin || editingExpense?.status === "Paid"))
        throw new Error("Paid expenses and expenses reviewed by an admin cannot be edited");
      if (!form.employeeName.trim())
        throw new Error("Employee name is required");
      if (!form.purpose.trim())
        throw new Error("Purpose of expense is required");
      const data = {
        ...form,
        employeeName: form.employeeName.trim(),
        purpose: form.purpose.trim(),
        expenses: form.expenses.filter(
          (row) => row.expenseType || row.description || row.amount || row.tax,
        ),
        created_by: appUser?.id,
      };
      if (!data.expenses.length)
        throw new Error("Add at least one expense row");
      if (editingExpense?.id)
        await expenseDataAPI.update(editingExpense.id, data);
      else await expenseDataAPI.create(data);
    },
    onSuccess: () => {
      toast.success(editingExpense ? "Expense updated" : "Expense submitted");
      closeForm();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteExpense = useMutation({
    mutationFn: (id: string) => expenseDataAPI.delete(id),
    onSuccess: () => {
      toast.success("Expense deleted");
      setPendingDelete(null);
    },
    onError: () => toast.error("Unable to delete expense"),
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => {
      const expense = expenses.find((entry) => entry.id === id);
      if (!expense) throw new Error("Expense not found");
      const history = [...(expense.statusHistory || []), {
        id: crypto.randomUUID(),
        previousStatus: expense.status,
        newStatus: status,
        changedBy: appUser?.fullName || appUser?.email || "Administrator",
        changedByEmail: appUser?.email,
        changedAt: new Date().toISOString(),
      }];
      return expenseDataAPI.update(id, { status, statusHistory: history, status_updated_by_admin: true });
    },
    onSuccess: () => toast.success("Expense status updated"),
    onError: () => toast.error("Unable to update expense status"),
  });

  function updateField(field: keyof ExpenseInput, value: string | number) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  async function uploadAttachments(files: FileList | null) {
    if (!files?.length) return;
    const uploadedUrls: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        toast.error(`${file.name} is not an image or PDF`);
        continue;
      }
      const path = `expense-receipts/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("company-logos")
        .upload(path, file, { upsert: false });
      if (error) {
        toast.error(`Unable to upload ${file.name}`);
        continue;
      }
      uploadedUrls.push(
        supabase.storage.from("company-logos").getPublicUrl(path).data
          .publicUrl,
      );
    }
    setForm((current) => ({
      ...current,
      attachments: [...current.attachments, ...uploadedUrls],
    }));
  }
  function nextClaimId() {
    const highest = expenses.reduce((max, expense) => {
      const match = expense.claimId?.match(/^EX-(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `EX-${String(highest + 1).padStart(5, "0")}`;
  }
  function updateRow(
    id: string,
    field: keyof Omit<ExpenseRow, "id">,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      expenses: current.expenses.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]:
                field === "amount" || field === "tax" ? Number(value) : value,
            }
          : row,
      ),
    }));
  }
  function openCreate() {
    const profile = expenses.find(
      (expense) =>
        expense.created_by === appUser?.id && expense.employeeName.trim(),
    );
    setEditingExpense(null);
    setForm({
      ...emptyExpense(),
      claimId: nextClaimId(),
      ...(profile
        ? {
            employeeName: profile.employeeName,
            department: profile.department,
            company: profile.company,
            designation: profile.designation,
            contactNo: profile.contactNo,
          }
        : {}),
    });
    setFormOpen(true);
  }
  function openEdit(expense: ExpenseData) {
    if (!isAdmin && (expense.status_updated_by_admin || expense.status === "Paid")) {
      toast.error(expense.status === "Paid" ? "Paid expenses cannot be edited" : "This expense cannot be edited after an admin status update");
      return;
    }
    setEditingExpense(expense);
    setForm({
      ...emptyExpense(),
      claimId: expense.claimId,
      employeeName: expense.employeeName,
      department: expense.department,
      designation: expense.designation,
      company: expense.company,
      contactNo: expense.contactNo,
      purpose: expense.purpose,
      projectSite: expense.projectSite,
      expenseDate: expense.expenseDate,
      claimDate: expense.claimDate,
      paymentMode: expense.paymentMode,
      advanceReceived: expense.advanceReceived || 0,
      expenses: expense.expenses?.length ? expense.expenses : [emptyRow()],
      attachments: expense.attachments || [],
      remarks: expense.remarks || "",
      status: expense.status,
    });
    setFormOpen(true);
  }
  function closeForm() {
    setFormOpen(false);
    setEditingExpense(null);
    setForm(emptyExpense());
  }
  function requestDelete(expense: ExpenseData) {
    if (!isAdmin) {
      setPermissionOpen(true);
      return;
    }
    setPendingDelete(expense);
  }
  function downloadAllExpenses() {
    if (!visibleExpenses.length) {
      toast.info("There are no expenses to download.");
      return;
    }
    const headers = ["Expense ID", "Employee", "Department", "Project / Site", "Expense Date", "Total Amount (PKR)", "Advance (PKR)", "Pending (PKR)", "Status"];
    const rows = visibleExpenses.map((expense) => [
      expense.claimId,
      expense.employeeName,
      expense.department,
      expense.projectSite,
      expense.claimDate,
      totalFor(expense),
      Number(expense.advanceReceived || 0),
      expense.status === "Paid" ? 0 : Math.max(0, totalFor(expense) - Number(expense.advanceReceived || 0)),
      expense.status,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${visibleExpenses.length} expense${visibleExpenses.length === 1 ? "" : "s"} downloaded`);
  }

  return (
    <div className="min-h-full bg-[#f4f8fc] text-slate-800">
      <header className="bg-gradient-to-r from-[#092f5b] via-[#0d477f] to-[#092f5b] px-4 py-3 text-white shadow-md sm:px-6">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-white/15 p-2">
              <ReceiptText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wide sm:text-lg">
                EXPENSE CLAIM
              </h1>
              <p className="text-[10px] font-medium text-blue-100 sm:text-xs">
                Expenses &amp; Reimbursement Management
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              size="sm"
              variant="outline"
              className="w-full border-blue-200/40 bg-white/10 text-xs text-white hover:bg-white/20 hover:text-white sm:w-auto"
              onClick={downloadAllExpenses}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              Download
            </Button>
            <Button
              size="sm"
              className="w-full bg-emerald-500 text-xs hover:bg-emerald-600 sm:w-auto"
              onClick={openCreate}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Expense
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto min-w-0 max-w-[1800px] space-y-4 overflow-x-hidden p-3 sm:p-5 lg:p-7">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#1d588e]">
          <ClipboardList className="h-4 w-4" />
          Expense Reimbursement Overview
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Total expenses"
            value={visibleExpenses.length}
            icon={<FileText />}
          />
          <Stat
            label="Submitted for review"
            value={
              visibleExpenses.filter(
                (expense) => expense.status === "Submitted",
              ).length
            }
            icon={<CalendarDays />}
          />
          <Stat
            label="Approved"
            value={visibleExpenses.filter((expense) => expense.status === "Approved").length}
            icon={<ClipboardList />}
          />
          <Stat
            label="Paid"
            value={visibleExpenses.filter((expense) => expense.status === "Paid").length}
            icon={<ReceiptText />}
          />
        </div>
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="flex flex-col gap-3 border-b bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-[#145487]">Expenses</h2>
              <p className="mt-1 text-xs text-slate-500">
                Review expenses, reimbursement amounts, and approval status.
              </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search expenses or employees"
                  className="h-9 w-full pl-8 text-xs"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs sm:w-auto"
              >
                <option value="All">All statuses</option>
                <option value="Pending">Pending expenses</option>
                {expenseStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
          {filteredExpenses.length ? (
            <div className="max-w-full overflow-x-auto overscroll-x-contain [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
              <table className="w-full min-w-[960px] table-fixed text-sm [&_td]:break-words [&_th]:break-words">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-24" />
                  <col className="w-32" />
                  <col className="w-24" />
                  <col className="w-28" />
                  <col className="w-24" />
                  <col className="w-24" />
                  <col className="w-20" />
                  <col className="w-20" />
                  <col className="w-24" />
                  <col className="w-24" />
                </colgroup>
                <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    {[
                      "Sr.",
                      "Expense ID",
                      "Employee",
                      "Department",
                      "Project / Site",
                      "Expense Date",
                      "Total Amount",
                      "Advance",
                      "Pending",
                      "Status",
                      "Actions",
                    ].map((heading) => (
                      <th key={heading} className="whitespace-nowrap px-2 py-2.5">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedExpenses.map((expense, index) => (
                    <tr key={expense.id} className="hover:bg-blue-50/50">
                      <td className="px-2 py-2.5 text-xs">{pageSize === "all" ? index + 1 : (currentPage - 1) * pageSize + index + 1}</td>
                      <td className="px-2 py-2.5 text-xs font-semibold text-blue-700">
                        {expense.claimId || "—"}
                      </td>
                      <td className="px-2 py-2.5 text-xs font-medium">
                        {expense.employeeName}
                      </td>
                      <td className="px-2 py-2.5 text-xs">
                        {expense.department || "—"}
                      </td>
                      <td className="px-2 py-2.5 text-xs">
                        {expense.projectSite || "—"}
                      </td>
                      <td className="px-2 py-2.5 text-xs">
                        {formatDate(expense.claimDate)}
                      </td>
                      <td className="break-words px-2 py-2.5 text-xs font-bold">
                        {totalFor(expense).toLocaleString()}
                      </td>
                      <td className="break-words px-3 py-3 text-xs">
                        {Number(expense.advanceReceived || 0).toLocaleString()}
                      </td>
                      <td className="break-words px-2 py-2.5 text-xs font-semibold text-amber-700">
                        {expense.status === "Paid" ? "0" : Math.max(0, totalFor(expense) - Number(expense.advanceReceived || 0)).toLocaleString()}
                      </td>
                      <td className="px-2 py-2.5">
                        {isAdmin ? (
                          <select
                            value={expense.status}
                            onChange={(event) =>
                              expense.id &&
                              updateStatus.mutate({
                                id: expense.id,
                                status: event.target.value,
                              })
                            }
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          >
                            {expenseStatuses.map((status) => (
                              <option key={status}>{status}</option>
                            ))}
                          </select>
                        ) : (
                          <StatusBadge status={expense.status} />
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setViewingExpense(expense)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={!isAdmin && (expense.status_updated_by_admin || expense.status === "Paid")}
                            title={!isAdmin && expense.status === "Paid" ? "Paid expense cannot be edited" : !isAdmin && expense.status_updated_by_admin ? "Locked after admin status update" : "Edit expense"}
                            onClick={() => openEdit(expense)}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-600"
                              onClick={() => requestDelete(expense)}
                              title="Delete expense"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              onCreate={openCreate}
              hasSearch={Boolean(search || statusFilter !== "All")}
            />
          )}
          <div className="flex flex-col gap-3 border-t bg-white px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>Showing {pageStart}-{pageEnd} of {filteredExpenses.length} expenses</p>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="expense-page-size">Rows per page</label>
              <select
                id="expense-page-size"
                value={pageSize}
                onChange={(event) => {
                  const value = event.target.value;
                  setPageSize(value === "all" ? "all" : Number(value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="15">15</option>
                <option value="30">30</option>
                <option value="100">100</option>
                <option value="all">All</option>
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage === 1 || pageSize === "all"}
                onClick={() => setCurrentPage((page) => page - 1)}
              >
                Previous
              </Button>
              <span className="min-w-16 text-center">Page {currentPage} of {totalPages}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage === totalPages || pageSize === "all"}
                onClick={() => setCurrentPage((page) => page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </main>

      <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-5xl">
          <div className="border-b bg-gradient-to-r from-[#092f5b] to-[#0d477f] px-5 py-5 text-white sm:px-7">
            <DialogHeader>
              <DialogTitle className="text-xl text-white">
                {editingExpense ? "Edit Expense" : "Expense Reimbursement Form"}
              </DialogTitle>
              <DialogDescription className="text-blue-100">
                Enter employee information, expense details, receipts, and
                reimbursement notes.
              </DialogDescription>
            </DialogHeader>
          </div>
          <form
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              saveExpense.mutate();
            }}
            className="space-y-6 p-5 sm:p-7"
          >
            <FormSection title="Employee Information">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field
                  label="Expense ID"
                  value={form.claimId}
                  onChange={() => undefined}
                  readOnly
                />
                <Field
                  label="Employee Name *"
                  value={form.employeeName}
                  onChange={(value) => updateField("employeeName", value)}
                />
                <Field
                  label="Department"
                  value={form.department}
                  onChange={(value) => updateField("department", value)}
                />
                <Field
                  label="Designation"
                  value={form.designation}
                  onChange={(value) => updateField("designation", value)}
                />
                <Field
                  label="Company"
                  value={form.company}
                  onChange={(value) => updateField("company", value)}
                />
                <Field
                  label="Contact No."
                  value={form.contactNo}
                  onChange={(value) => updateField("contactNo", value)}
                />
              </div>
            </FormSection>
            <FormSection title="Expense Details">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field
                  label="Purpose of Expense *"
                  value={form.purpose}
                  onChange={(value) => updateField("purpose", value)}
                />
                <Field
                  label="Project / Site"
                  value={form.projectSite}
                  onChange={(value) => updateField("projectSite", value)}
                />
                <Field
                  label="Expense Date"
                  value={form.expenseDate}
                  onChange={(value) => updateField("expenseDate", value)}
                  type="date"
                />
                <Field
                  label="Advance Received"
                  value={String(form.advanceReceived || "")}
                  onChange={(value) =>
                    updateField("advanceReceived", Number(value) || 0)
                  }
                  type="number"
                />
                <SelectField
                  label="Payment Mode"
                  value={form.paymentMode}
                  options={[
                    "Personal Payment",
                    "Company Card",
                    "Cash Advance",
                    "Bank Transfer",
                  ]}
                  onChange={(value) => updateField("paymentMode", value)}
                />
              </div>
            </FormSection>
            <FormSection title="Expense Breakdown">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-xs">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="p-2">Expense Type</th>
                      <th className="p-2">Description</th>
                      <th className="p-2">Amount</th>
                      <th className="p-2">Total</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.expenses.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="p-2">
                          <Input
                            value={row.expenseType}
                            onChange={(event) =>
                              updateRow(
                                row.id,
                                "expenseType",
                                event.target.value,
                              )
                            }
                            placeholder="Travel, Meals..."
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={row.description}
                            onChange={(event) =>
                              updateRow(
                                row.id,
                                "description",
                                event.target.value,
                              )
                            }
                            placeholder="Description"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            value={row.amount || ""}
                            onChange={(event) =>
                              updateRow(row.id, "amount", event.target.value)
                            }
                          />
                        </td>
                        <td className="whitespace-nowrap p-2 font-semibold">
                          {Number(row.amount || 0).toLocaleString()}
                        </td>
                        <td className="p-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600"
                            disabled={form.expenses.length === 1}
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                expenses: current.expenses.filter(
                                  (item) => item.id !== row.id,
                                ),
                              }))
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col justify-between gap-3 pt-3 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      expenses: [...current.expenses, emptyRow()],
                    }))
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense Row
                </Button>
                <div className="grid w-full gap-2 text-right text-sm sm:max-w-xl sm:grid-cols-3">
                  <div className="rounded-lg bg-blue-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                      Advance Payment
                    </p>
                    <p className="mt-1 font-bold text-blue-950">
                      {Number(form.advanceReceived || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-100 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Total Expense
                    </p>
                    <p className="mt-1 font-bold text-slate-900">
                      {totalFor(form).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Pending amount
                    </p>
                    <p className="mt-1 font-bold text-amber-950">
                      {(
                        Number(form.advanceReceived || 0) - totalFor(form)
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </FormSection>
            <FormSection title="Attachments & Additional Information">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Upload Bills / Receipts</Label>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="mt-2"
                    onChange={(event) => uploadAttachments(event.target.files)}
                  />
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    {form.attachments.map((attachment) => (
                      <p key={attachment} className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <a
                          href={attachment}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-blue-700 underline hover:text-blue-900"
                        >
                          {attachment}
                        </a>
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Remarks</Label>
                  <textarea
                    value={form.remarks}
                    onChange={(event) =>
                      updateField("remarks", event.target.value)
                    }
                    className="mt-2 min-h-24 w-full rounded-md border border-input p-2 text-sm"
                    placeholder="Add any additional notes..."
                  />
                </div>
              </div>
            </FormSection>
            <DialogFooter className="border-t pt-5">
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#0d4d85] hover:bg-[#093b68]"
                disabled={saveExpense.isPending}
              >
                {saveExpense.isPending
                  ? "Saving..."
                  : editingExpense
                    ? "Update Claim"
                    : "Submit Claim"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewingExpense)}
        onOpenChange={(open) => !open && setViewingExpense(null)}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto bg-[#f8fbff] p-0 sm:max-w-5xl [&>button]:text-white">
          <div className="overflow-hidden rounded-lg">
            <div className="border-b bg-gradient-to-r from-[#092f5b] via-[#0d477f] to-[#1263a0] px-5 py-6 text-white sm:px-8">
              <DialogHeader className="pr-8">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
                  <ReceiptText className="h-4 w-4" />
                  Expense claim profile
                </div>
                <DialogTitle className="truncate text-xl text-white sm:text-2xl">
                  {viewingExpense?.claimId || "Expense details"}
                </DialogTitle>
                <DialogDescription className="text-blue-100">
                  Review employee, reimbursement, and expense line-item information.
                </DialogDescription>
              </DialogHeader>
            </div>
            {viewingExpense && (
              <div className="space-y-5 bg-[#f8fbff] p-4 sm:p-8">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700"><ClipboardList className="h-5 w-5" /></div>
                    <div><h3 className="font-semibold text-slate-900">Claim overview</h3><p className="mt-1 text-sm text-slate-500">Key reimbursement information for quick reference.</p></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3.5"><p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Employee</p><p className="mt-2 break-words text-sm font-semibold text-slate-900">{viewingExpense.employeeName || "Not provided"}</p></div>
                    <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3.5"><p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Department</p><p className="mt-2 break-words text-sm font-semibold text-slate-900">{viewingExpense.department || "Not provided"}</p></div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3.5"><p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Status</p><div className="mt-2"><StatusBadge status={viewingExpense.status} /></div></div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3.5"><p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Total Amount</p><p className="mt-2 text-sm font-bold text-slate-900">PKR {totalFor(viewingExpense).toLocaleString()}</p></div>
                  </div>
                </section>
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-indigo-100 p-2.5 text-indigo-700"><FileText className="h-5 w-5" /></div><div><h3 className="font-semibold text-slate-900">Expense details</h3><p className="mt-1 text-sm text-slate-500">Claim context and reimbursement information.</p></div></div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Project / Site" value={viewingExpense.projectSite} /><Detail label="Expense Date" value={formatDate(viewingExpense.expenseDate)} /><Detail label="Claim Date" value={formatDate(viewingExpense.claimDate)} /><Detail label="Payment Mode" value={viewingExpense.paymentMode} /><Detail label="Advance Received" value={`PKR ${Number(viewingExpense.advanceReceived || 0).toLocaleString()}`} /><Detail label="Purpose" value={viewingExpense.purpose} /></div>
                </section>
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700"><ReceiptText className="h-5 w-5" /></div><div><h3 className="font-semibold text-slate-900">Expense line items</h3><p className="mt-1 text-sm text-slate-500">Detailed amount and tax breakdown.</p></div></div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[620px] text-sm"><thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Type</th><th className="px-3 py-3">Description</th><th className="px-3 py-3">Amount (PKR)</th><th className="px-3 py-3">Tax (PKR)</th><th className="px-3 py-3">Total (PKR)</th></tr></thead><tbody className="divide-y divide-slate-100">{viewingExpense.expenses.map((row) => <tr key={row.id} className="hover:bg-blue-50/50"><td className="px-2 py-2.5">{row.expenseType || "—"}</td><td className="px-2 py-2.5">{row.description || "—"}</td><td className="px-2 py-2.5">{row.amount.toLocaleString()}</td><td className="px-2 py-2.5">{row.tax.toLocaleString()}</td><td className="px-3 py-3 font-bold text-[#145487]">{(row.amount + row.tax).toLocaleString()}</td></tr>)}</tbody><tfoot><tr className="border-t bg-slate-50 font-bold"><td colSpan={4} className="px-3 py-3 text-right">Grand Total</td><td className="px-3 py-3 text-[#145487]">PKR {totalFor(viewingExpense).toLocaleString()}</td></tr></tfoot></table></div>
                </section>
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h3 className="font-semibold text-slate-900">Remarks</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{viewingExpense.remarks || "No remarks provided."}</p></section>
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-amber-100 p-2.5 text-amber-700"><CalendarDays className="h-5 w-5" /></div><div><h3 className="font-semibold text-slate-900">Status history</h3><p className="mt-1 text-sm text-slate-500">Audit trail of every administrator status update.</p></div></div>{viewingExpense.statusHistory?.length ? <div className="space-y-3">{[...viewingExpense.statusHistory].reverse().map((change) => <div key={change.id} className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4"><div><p className="text-sm font-semibold text-slate-900"><span className="text-slate-500">{change.previousStatus}</span><span className="mx-2 text-amber-600">→</span>{change.newStatus}</p><p className="mt-1 text-xs text-slate-600">Changed by {change.changedBy}{change.changedByEmail ? ` (${change.changedByEmail})` : ""}</p></div><p className="mt-2 whitespace-nowrap text-xs font-medium text-amber-800 sm:mt-0">{new Date(change.changedAt).toLocaleString()}</p></div>)}</div> : <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">No status changes recorded yet.</p>}</section>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete expense claim?</DialogTitle>
            <DialogDescription>
              This permanently removes{" "}
              {pendingDelete?.claimId || pendingDelete?.employeeName}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                pendingDelete?.id && deleteExpense.mutate(pendingDelete.id)
              }
              disabled={deleteExpense.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PermissionDeniedDialog
        open={permissionOpen}
        onOpenChange={setPermissionOpen}
        message="Only administrators can delete expense claims."
      />
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-4 border-b pb-3 text-sm font-bold text-[#145487]">
        {title}
      </h3>
      {children}
    </section>
  );
}
function Field({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      <Input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className="mt-2"
      />
    </div>
  );
}
function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}
function Stat({
  label,
  value,
  icon,
  currency,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  currency?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-blue-50 p-2 text-blue-700">{icon}</div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900">
            {currency ? `${currency} ${value.toLocaleString()}` : value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${status === "Approved" || status === "Paid" ? "bg-emerald-50 text-emerald-700" : status === "Rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}
    >
      {status || "Draft"}
    </span>
  );
}
function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-slate-900">{value || "—"}</p>
    </div>
  );
}
function EmptyState({
  onCreate,
  hasSearch,
}: {
  onCreate: () => void;
  hasSearch: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="rounded-full bg-blue-50 p-4 text-blue-700">
        <ReceiptText className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">
        {hasSearch ? "No expenses match your filters" : "No expenses yet"}
      </h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        {hasSearch
          ? "Try a different search or status."
          : "Create the first expense to begin tracking reimbursements."}
      </p>
      {!hasSearch && (
        <Button className="mt-5 bg-[#0d4d85]" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      )}
    </div>
  );
}
function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}
