import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Building2, CalendarDays, Download, Eye, FileUp, Loader2, Mail, MapPin, MessageSquarePlus, Pencil, Phone, Plus, Search, Send, ShieldCheck, Trash2, Upload, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import PermissionDeniedDialog from "@/components/PermissionDeniedDialog";
import { useAuth } from "@/context/AuthContext";
import { customerDataAPI, type CustomerData, type CustomerRemark, type PointOfContact } from "@/integrations/firebase/customerDataAPI";
import { supabase } from "@/integrations/supabase/client";

const sources = ["Social media", "Phone", "Email", "Reference"] as const;
const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const emptyPoc = (): PointOfContact => ({ id: crypto.randomUUID(), name: "", designation: "", email: "", mobile: "" });
const emptyCustomer = (): Omit<CustomerData, "id" | "created_at" | "updated_at"> => ({ customerName: "", organization: "", industry: "", designation: "", address: "", telephone: "", email: "", businessCardUrl: "", pocs: [emptyPoc()], source: "Social media", referenceName: "", remarks: [] });

export default function CustomerDataPage() {
  const { appUser, isAdmin } = useAuth();
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(25);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerData | null>(null);
  const [form, setForm] = useState(emptyCustomer());
  const [uploadingCard, setUploadingCard] = useState(false);
  const [remarksCustomer, setRemarksCustomer] = useState<CustomerData | null>(null);
  const [remarkText, setRemarkText] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignMessage, setCampaignMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<CustomerData | null>(null);
  const [showPermissionDenied, setShowPermissionDenied] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<CustomerData | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => customerDataAPI.subscribeAll(setCustomers, () => toast.error("Unable to load customer data.")), []);

  const industries = useMemo(() => [...new Set(customers.map((customer) => customer.industry?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)), [customers]);
  const filteredCustomers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesIndustry = industryFilter === "all" || customer.industry === industryFilter;
      const matchesSearch = !needle || [customer.customerName, customer.organization, customer.industry, customer.designation, customer.email, customer.telephone, customer.source, ...customer.pocs.flatMap((poc) => [poc.name, poc.email, poc.mobile])].some((value) => value?.toLowerCase().includes(needle));
      return matchesIndustry && matchesSearch;
    });
  }, [customers, search, industryFilter]);

  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageOffset = pageSize === "all" ? 0 : (currentPage - 1) * pageSize;
  const paginatedCustomers = useMemo(() => pageSize === "all" ? filteredCustomers : filteredCustomers.slice(pageOffset, pageOffset + pageSize), [filteredCustomers, pageOffset, pageSize]);
  const showingStart = filteredCustomers.length ? pageOffset + 1 : 0;
  const showingEnd = pageSize === "all" ? filteredCustomers.length : Math.min(pageOffset + pageSize, filteredCustomers.length);

  useEffect(() => setPage(1), [search, industryFilter, pageSize]);
  useEffect(() => setPage((currentPage) => Math.min(currentPage, totalPages)), [totalPages]);

  const selectedCustomers = useMemo(() => customers.filter((customer) => customer.id && selectedIds.includes(customer.id)), [customers, selectedIds]);

  const saveCustomer = useMutation({
    mutationFn: async () => {
      if (!form.customerName.trim()) throw new Error("Customer name is required");
      if (uploadingCard) throw new Error("Wait for business card upload to finish");
      const data = { ...form, customerName: form.customerName.trim(), pocs: form.pocs.filter((poc) => poc.name.trim() || poc.email.trim() || poc.mobile.trim()), created_by: appUser?.id };
      if (editingCustomer?.id) await customerDataAPI.update(editingCustomer.id, data);
      else await customerDataAPI.create(data);
    },
    onSuccess: () => { toast.success(editingCustomer ? "Customer updated" : "Customer added"); closeForm(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const addRemark = useMutation({
    mutationFn: async () => {
      if (!remarksCustomer?.id || !remarkText.trim()) throw new Error("Enter a remark first");
      const remark: CustomerRemark = { id: crypto.randomUUID(), text: remarkText.trim(), createdAt: new Date().toISOString(), createdBy: appUser?.fullName };
      await customerDataAPI.update(remarksCustomer.id, { remarks: [...(remarksCustomer.remarks || []), remark] });
    },
    onSuccess: () => { toast.success("Remark saved to history"); setRemarkText(""); setRemarksCustomer(null); },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteCustomer = useMutation({ mutationFn: (id: string) => customerDataAPI.delete(id), onSuccess: () => { toast.success("Customer removed"); setPendingDelete(null); }, onError: () => toast.error("Unable to remove customer") });

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        const customersToImport = rows.map((row) => {
          const normalized = Object.entries(row).map(([key, value]) => [normalizeKey(key), value] as const);
          const valueFor = (names: string[]) => { const entry = normalized.find(([key]) => names.includes(key)); return entry?.[1] == null ? "" : String(entry[1]).trim(); };
          const pocs: PointOfContact[] = [];
          for (let index = 1; index <= 10; index += 1) {
            const poc = { id: crypto.randomUUID(), name: valueFor([`poc${index}name`]), designation: valueFor([`poc${index}designation`, `poc${index}title`]), email: valueFor([`poc${index}email`, `poc${index}mail`]), mobile: valueFor([`poc${index}mobile`, `poc${index}phone`, `poc${index}number`]) };
            if (poc.name || poc.designation || poc.email || poc.mobile) pocs.push(poc);
          }
          return { customerName: valueFor(["customername", "name", "customer", "organization", "company"]), organization: valueFor(["organization", "company", "customerorganization"]), industry: valueFor(["industry", "sector", "businessindustry"]), designation: valueFor(["designation", "title", "jobtitle"]), address: valueFor(["address"]), telephone: valueFor(["telephone", "phone", "phonenumber"]), email: valueFor(["email", "customermail"]), pocs, source: "Social media" as const, referenceName: "", remarks: [], created_by: appUser?.id };
        }).filter((customer) => customer.customerName);
        if (!customersToImport.length) throw new Error("No customer name column data was found");
        await Promise.all(customersToImport.map((customer) => customerDataAPI.create(customer)));
        toast.success(`${customersToImport.length} customer${customersToImport.length === 1 ? "" : "s"} imported`);
        setImportOpen(false);
      } catch (error) { toast.error(error instanceof Error ? error.message : "Import failed"); }
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadSampleExcel() {
    const worksheet = XLSX.utils.json_to_sheet([{ "Customer Name": "Sample Customer", Organization: "Sample Organization", Industry: "Textile", Designation: "Procurement Manager", Address: "123 Business Street", Telephone: "+1 555 0100", Email: "customer@example.com", "POC1 Name": "Alex Morgan", "POC1 Designation": "Procurement Manager", "POC1 Email": "alex@example.com", "POC1 Mobile": "+1 555 0101", "POC2 Name": "Sam Lee", "POC2 Designation": "Director", "POC2 Email": "sam@example.com", "POC2 Mobile": "+1 555 0102" }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
    XLSX.writeFile(workbook, "customer_data_sample.xlsx");
  }

  function downloadCustomersAsExcel() {
    if (!customers.length) { toast.info("There are no customers to export yet."); return; }
    const customerRows = customers.map((customer, index) => ({
      "Sr. No.": index + 1,
      "Customer Name": customer.customerName,
      Organization: customer.organization || "",
      Industry: customer.industry || "",
      Designation: customer.designation || "",
      Telephone: customer.telephone || "",
      Email: customer.email || "",
      Address: customer.address || "",
      Source: customer.source,
      "Referred By": customer.referenceName || "",
      "Business Card": customer.businessCardUrl || "",
      "POC Count": customer.pocs?.length || 0,
      "Remarks Count": customer.remarks?.length || 0,
      "Created At": customer.created_at || "",
    }));
    const pocRows = customers.flatMap((customer, customerIndex) => (customer.pocs || [])
      .filter((poc) => poc.name || poc.designation || poc.email || poc.mobile)
      .map((poc, pocIndex) => ({ "Customer Sr. No.": customerIndex + 1, "Customer Name": customer.customerName, Organization: customer.organization || "", "POC No.": pocIndex + 1, Name: poc.name, Designation: poc.designation, Email: poc.email, Mobile: poc.mobile })));
    const remarkRows = customers.flatMap((customer, customerIndex) => (customer.remarks || []).map((remark) => ({ "Customer Sr. No.": customerIndex + 1, "Customer Name": customer.customerName, Remark: remark.text, "Created At": new Date(remark.createdAt).toLocaleString(), "Created By": remark.createdBy || "" })));
    const workbook = XLSX.utils.book_new();
    const customerSheet = XLSX.utils.json_to_sheet(customerRows);
    const pocSheet = XLSX.utils.json_to_sheet(pocRows, { header: ["Customer Sr. No.", "Customer Name", "Organization", "POC No.", "Name", "Designation", "Email", "Mobile"] });
    const remarkSheet = XLSX.utils.json_to_sheet(remarkRows, { header: ["Customer Sr. No.", "Customer Name", "Remark", "Created At", "Created By"] });
    customerSheet["!cols"] = [{ wch: 8 }, { wch: 28 }, { wch: 28 }, { wch: 20 }, { wch: 18 }, { wch: 28 }, { wch: 36 }, { wch: 18 }, { wch: 24 }, { wch: 48 }, { wch: 12 }, { wch: 14 }, { wch: 24 }];
    pocSheet["!cols"] = [{ wch: 18 }, { wch: 28 }, { wch: 28 }, { wch: 10 }, { wch: 24 }, { wch: 24 }, { wch: 30 }, { wch: 18 }];
    remarkSheet["!cols"] = [{ wch: 18 }, { wch: 28 }, { wch: 60 }, { wch: 24 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(workbook, customerSheet, "Customers");
    XLSX.utils.book_append_sheet(workbook, pocSheet, "Points of Contact");
    XLSX.utils.book_append_sheet(workbook, remarkSheet, "Remarks");
    XLSX.writeFile(workbook, `Customers_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success(`${customers.length} customer${customers.length === 1 ? "" : "s"} exported to Excel`);
  }

  function closeForm() { setFormOpen(false); setEditingCustomer(null); setForm(emptyCustomer()); }
  function openEdit(customer: CustomerData) { setEditingCustomer(customer); setForm({ ...emptyCustomer(), ...customer, pocs: customer.pocs?.length ? customer.pocs : [emptyPoc()], remarks: customer.remarks || [] }); setFormOpen(true); }
  function updateField(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  function updatePoc(id: string, field: keyof Omit<PointOfContact, "id">, value: string) { setForm((current) => ({ ...current, pocs: current.pocs.map((poc) => poc.id === id ? { ...poc, [field]: value } : poc) })); }
  async function uploadBusinessCard(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast.error("Please upload a JPG, PNG, or WebP image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Business card image must be less than 5MB"); return; }

    setUploadingCard(true);
    try {
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const filePath = `customer-business-cards/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("company-logos").upload(filePath, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("company-logos").getPublicUrl(filePath);
      setForm((current) => ({ ...current, businessCardUrl: data.publicUrl }));
      toast.success("Business card uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload business card");
    } finally {
      setUploadingCard(false);
    }
  }
  function toggleCustomer(id: string, checked: boolean) { setSelectedIds((current) => checked ? [...new Set([...current, id])] : current.filter((entry) => entry !== id)); }
  function requestDelete(customer: CustomerData) { if (!isAdmin) { setShowPermissionDenied(true); return; } setPendingDelete(customer); }
  function composeEmail(email?: string) { if (!email) { toast.error("This customer has no email address."); return; } window.location.href = `mailto:${encodeURIComponent(email)}`; }
  function composeCampaign() {
    const emails = [...new Set(selectedCustomers.map((customer) => customer.email?.trim()).filter(Boolean))];
    if (!emails.length) { toast.error("Selected customers do not have email addresses."); return; }
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(campaignSubject)}&body=${encodeURIComponent(campaignMessage)}`;
    setCampaignOpen(false);
  }

  return <div className="min-h-full bg-[#f4f8fc] text-slate-800 p-3 sm:p-5 lg:p-7"><div className="mx-auto max-w-[1800px] space-y-4">
    <div className="flex flex-col gap-4 rounded-md bg-gradient-to-r from-[#092f5b] via-[#0d477f] to-[#092f5b] px-4 py-4 text-white shadow-md sm:flex-row sm:items-center sm:justify-between"><div><div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Customer management</div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Customer Data</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-blue-100">Maintain customer details, points of contact, lead source, and follow-up remarks.</p></div><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end sm:gap-2"><input ref={uploadRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} /><Button variant="outline" className="w-full border-blue-200/30 bg-white/10 font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-white/20 hover:text-white sm:w-auto" onClick={downloadCustomersAsExcel} disabled={!customers.length}><Download className="h-4 w-4" /><span>Download Excel</span></Button><Button variant="outline" className="w-full border-blue-200/30 bg-white/10 font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-white/20 hover:text-white sm:w-auto" onClick={() => setImportOpen(true)}><FileUp className="h-4 w-4" /><span>Import customers</span></Button><Button variant="outline" className="w-full border-blue-200/30 bg-white/10 font-semibold text-white hover:bg-white/20 hover:text-white sm:w-auto" onClick={() => selectedCustomers.length ? setCampaignOpen(true) : toast.error("Select one or more customers first.")}><Send className="mr-2 h-4 w-4" />Run campaign ({selectedCustomers.length})</Button><Button className="w-full bg-white font-semibold text-[#0b3b6d] shadow-md transition-all hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-lg sm:w-auto" onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" />Add customer</Button></div></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"><Stat icon={<Building2 className="h-5 w-5" />} label="Total customers" value={customers.length} color="blue" /><Stat icon={<Users className="h-5 w-5" />} label="Points of contact" value={customers.reduce((total, customer) => total + (customer.pocs?.length || 0), 0)} color="violet" /><Stat icon={<MessageSquarePlus className="h-5 w-5" />} label="With remarks" value={customers.filter((customer) => customer.remarks?.length).length} color="emerald" /></div>
    <Card className="overflow-hidden border-slate-200 shadow-sm transition-shadow duration-200 hover:shadow-md"><CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Customer directory</CardTitle><p className="mt-1 text-sm text-slate-500">Select multiple customers to prepare a campaign email.</p></div><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers or POCs" className="pl-9" /></div><select value={industryFilter} onChange={(event) => setIndustryFilter(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:w-48"><option value="all">All industries</option>{industries.map((industry) => <option key={industry} value={industry}>{industry}</option>)}</select></div></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-12 px-2 py-3">Sr.</th><th className="w-12 px-2 py-3"><Checkbox checked={filteredCustomers.length > 0 && filteredCustomers.every((customer) => customer.id && selectedIds.includes(customer.id))} onCheckedChange={(checked) => setSelectedIds(checked ? filteredCustomers.map((customer) => customer.id!).filter(Boolean) : [])} aria-label="Select all customers" /></th><th className="w-[200px] px-3 py-3">Customer / organization</th><th className="px-4 py-3">Industry</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">POCs</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Remarks</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{paginatedCustomers.map((customer, index) => <tr key={customer.id} className="hover:bg-slate-50/70"><td className="w-12 px-2 py-3 text-slate-500">{pageOffset + index + 1}</td><td className="w-12 px-2 py-4"><Checkbox checked={!!customer.id && selectedIds.includes(customer.id)} onCheckedChange={(checked) => customer.id && toggleCustomer(customer.id, checked === true)} aria-label={`Select ${customer.customerName}`} /></td><td className="w-[200px] px-3 py-4"><p className="font-semibold text-slate-900">{customer.customerName}</p><p className="mt-1 text-xs text-slate-500">{customer.organization || "No organization"}</p></td><td className="px-4 py-4"><p>{customer.industry || "—"}</p></td><td className="px-4 py-4"><p>{customer.telephone || "—"}</p><p className="mt-1 text-xs text-slate-500">{customer.email || "No email"}</p></td><td className="px-4 py-4"><p className="font-medium text-slate-700">{customer.pocs?.[0]?.name || "No POC"}</p><p className="mt-1 text-xs text-slate-500">{customer.pocs?.length || 0} contact{customer.pocs?.length === 1 ? "" : "s"}</p></td><td className="px-4 py-4"><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">{customer.source}</span>{customer.referenceName && <p className="mt-2 text-xs text-slate-500">{customer.referenceName}</p>}</td><td className="px-4 py-4"><Button variant="ghost" size="sm" onClick={() => setRemarksCustomer(customer)}><MessageSquarePlus className="mr-1.5 h-4 w-4" />{customer.remarks?.length || 0}</Button></td><td className="px-4 py-4"><div className="grid grid-cols-2 gap-1"><Button variant="ghost" size="icon" className="transition-all hover:-translate-y-0.5 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-sm" title="View customer" onClick={() => setViewingCustomer(customer)}><Eye className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="transition-all hover:-translate-y-0.5 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm" title="Compose email" onClick={() => composeEmail(customer.email)}><Mail className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="transition-all hover:-translate-y-0.5 hover:bg-slate-100 hover:text-slate-900 hover:shadow-sm" title="Edit customer" onClick={() => openEdit(customer)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-red-600 transition-all hover:-translate-y-0.5 hover:bg-red-50 hover:text-red-700 hover:shadow-sm" title="Delete customer" onClick={() => requestDelete(customer)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}{!filteredCustomers.length && <tr><td colSpan={7} className="px-4 py-14 text-center text-slate-500">No customers found. Add your first customer to get started.</td></tr>}</tbody></table></div><div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-2"><span>Rows per page</span><select value={pageSize} onChange={(event) => setPageSize(event.target.value === "all" ? "all" : Number(event.target.value))} className="h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value="all">All</option></select><span>Showing {showingStart}-{showingEnd} of {filteredCustomers.length}</span></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>Previous</Button><span className="min-w-20 text-center">Page {currentPage} of {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages}>Next</Button></div></div></CardContent></Card>
    <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{editingCustomer ? "Edit customer" : "Add customer"}</DialogTitle><DialogDescription>Save customer information and one or more points of contact.</DialogDescription></DialogHeader><form onSubmit={(event: FormEvent) => { event.preventDefault(); saveCustomer.mutate(); }} className="space-y-6"><section className="space-y-4"><h3 className="font-semibold text-slate-900">Customer information</h3><div className="grid gap-4 sm:grid-cols-2"><Field label="Customer name *" value={form.customerName} onChange={(value) => updateField("customerName", value)} /><Field label="Organization" value={form.organization || ""} onChange={(value) => updateField("organization", value)} /><Field label="Designation" value={form.designation || ""} onChange={(value) => updateField("designation", value)} /><Field label="Industry" value={form.industry || ""} onChange={(value) => updateField("industry", value)} /><Field label="Telephone" value={form.telephone || ""} onChange={(value) => updateField("telephone", value)} type="tel" /><Field label="Email" value={form.email || ""} onChange={(value) => updateField("email", value)} type="email" /><div className="sm:col-span-2"><Label>Address</Label><Textarea value={form.address || ""} onChange={(event) => updateField("address", event.target.value)} className="mt-2" /></div></div><div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><Label htmlFor="customer-business-card">Business Card</Label><p className="mt-1 text-sm text-slate-500">Upload a JPG, PNG, or WebP image up to 5MB.</p></div><Button type="button" variant="outline" disabled={uploadingCard} asChild><label htmlFor="customer-business-card" className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />{uploadingCard ? "Uploading..." : form.businessCardUrl ? "Change business card" : "Upload business card"}</label></Button></div><input id="customer-business-card" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={uploadBusinessCard} disabled={uploadingCard} />{form.businessCardUrl && <div className="mt-4 w-[340px] max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><img src={form.businessCardUrl} alt="Uploaded business card preview" className="aspect-[1.586/1] w-full object-cover" /></div>}{form.businessCardUrl && <a href={form.businessCardUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline">View uploaded business card</a>}</div></section><section className="space-y-4 rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold text-slate-900">Points of contact</h3><p className="text-sm text-slate-500">Add POC details for this customer.</p></div><Button type="button" variant="outline" onClick={() => setForm((current) => ({ ...current, pocs: [...current.pocs, emptyPoc()] }))}><Plus className="mr-2 h-4 w-4" />Add POC</Button></div>{form.pocs.map((poc, index) => <div key={poc.id} className="rounded-lg bg-slate-50 p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-slate-700">POC {index + 1}</p>{form.pocs.length > 1 && <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => setForm((current) => ({ ...current, pocs: current.pocs.filter((entry) => entry.id !== poc.id) }))}>Remove</Button>}</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Name" value={poc.name} onChange={(value) => updatePoc(poc.id, "name", value)} /><Field label="Designation" value={poc.designation} onChange={(value) => updatePoc(poc.id, "designation", value)} /><Field label="Email" value={poc.email} onChange={(value) => updatePoc(poc.id, "email", value)} type="email" /><Field label="Mobile" value={poc.mobile} onChange={(value) => updatePoc(poc.id, "mobile", value)} type="tel" /></div></div>)}</section><section className="space-y-4"><div><h3 className="font-semibold text-slate-900">Lead source</h3><p className="text-sm text-slate-500">Choose how this customer entered the pipeline.</p></div><RadioGroup value={form.source} onValueChange={(value) => updateField("source", value)} className="grid grid-cols-2 gap-3 sm:grid-cols-4">{sources.map((source) => <Label key={source} htmlFor={`source-${source}`} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-medium hover:bg-slate-50"><RadioGroupItem value={source} id={`source-${source}`} />{source}</Label>)}</RadioGroup>{form.source === "Reference" && <div className="max-w-md"><Field label="Referred by" value={form.referenceName || ""} onChange={(value) => updateField("referenceName", value)} /></div>}</section><DialogFooter><Button type="button" variant="outline" onClick={closeForm}>Cancel</Button><Button type="submit" disabled={saveCustomer.isPending}>{saveCustomer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingCustomer ? "Save changes" : "Add customer"}</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={!!viewingCustomer} onOpenChange={(open) => !open && setViewingCustomer(null)}><DialogContent className="max-h-[92vh] overflow-y-auto bg-[#f8fbff] p-0 sm:max-w-5xl [&>button]:text-white"><div className="border-b bg-gradient-to-r from-[#092f5b] via-[#0d477f] to-[#1263a0] px-5 py-6 text-white sm:px-8"><DialogHeader className="pr-8"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100"><UserRound className="h-4 w-4" />Customer profile</div><DialogTitle className="truncate text-xl text-white sm:text-2xl">{viewingCustomer?.customerName || "Customer details"}</DialogTitle><DialogDescription className="text-blue-100">Complete customer record and relationship information.</DialogDescription></DialogHeader></div>{viewingCustomer && <div className="space-y-5 bg-[#f8fbff] p-4 sm:p-8">{viewingCustomer.businessCardUrl && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-3"><h3 className="font-semibold text-slate-900">Business card</h3><p className="mt-1 text-sm text-slate-500">Click the card to view the full-size image.</p></div><a href={viewingCustomer.businessCardUrl} target="_blank" rel="noreferrer" className="block w-[340px] max-w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm transition hover:shadow-md"><img src={viewingCustomer.businessCardUrl} alt={`${viewingCustomer.customerName} business card`} className="aspect-[1.586/1] w-full object-cover" /></a></section>}<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-start gap-3"><div className="rounded-xl bg-blue-100 p-2.5 text-blue-700"><Building2 className="h-5 w-5" /></div><div><h3 className="font-semibold text-slate-900">Customer overview</h3><p className="mt-1 text-sm text-slate-500">Key customer information for quick reference.</p></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><CustomerInfoTile icon={<Building2 className="h-4 w-4" />} label="Organization" value={viewingCustomer.organization} tone="violet" /><CustomerInfoTile icon={<MessageSquarePlus className="h-4 w-4" />} label="Industry" value={viewingCustomer.industry} tone="blue" /><CustomerInfoTile icon={<Phone className="h-4 w-4" />} label="Telephone" value={viewingCustomer.telephone} tone="emerald" /><CustomerInfoTile icon={<Mail className="h-4 w-4" />} label="Email" value={viewingCustomer.email} tone="amber" /><CustomerInfoTile icon={<UserRound className="h-4 w-4" />} label="Points of contact" value={String(viewingCustomer.pocs?.length || 0)} tone="violet" /><CustomerInfoTile icon={<MessageSquarePlus className="h-4 w-4" />} label="Remarks" value={String(viewingCustomer.remarks?.length || 0)} tone="emerald" /><CustomerInfoTile icon={<CalendarDays className="h-4 w-4" />} label="Added" value={viewingCustomer.created_at ? new Date(viewingCustomer.created_at).toLocaleDateString() : undefined} tone="slate" /><CustomerInfoTile icon={<ShieldCheck className="h-4 w-4" />} label="Lead source" value={viewingCustomer.source} tone="amber" /></div><div className="mt-4 flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" /><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Address</p><p className="mt-1 break-words text-sm font-medium text-slate-900">{viewingCustomer.address || "Not provided"}</p></div></div></section>{viewingCustomer && !viewingCustomer && <section className="overflow-hidden rounded-xl border border-slate-200"><div className="border-b bg-slate-50 px-4 py-3"><h3 className="font-semibold text-slate-900">Customer information</h3></div><div className="grid gap-px bg-slate-200 sm:grid-cols-2"><DetailCell label="Customer name" value={viewingCustomer.customerName} /><DetailCell label="Organization" value={viewingCustomer.organization} /><DetailCell label="Industry" value={viewingCustomer.industry} /><DetailCell label="Designation" value={viewingCustomer.designation} /><DetailCell label="Telephone" value={viewingCustomer.telephone} /><DetailCell label="Email" value={viewingCustomer.email} /><DetailCell label="Address" value={viewingCustomer.address} wide /></div></section>}<section className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm"><div className="border-b border-amber-100 bg-amber-50/70 px-4 py-4"><h3 className="font-semibold text-slate-900">Lead source</h3><p className="mt-1 text-sm text-slate-500">How this customer was introduced.</p></div><div className="grid gap-px bg-slate-200 sm:grid-cols-2"><DetailCell label="Source" value={viewingCustomer.source} /><DetailCell label="Referred by" value={viewingCustomer.referenceName} /></div></section><section className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm"><div className="border-b border-indigo-100 bg-indigo-50/70 px-4 py-4"><h3 className="font-semibold text-slate-900">Points of contact</h3><p className="mt-1 text-sm text-slate-500">People connected with this customer.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Designation</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Mobile</th></tr></thead><tbody className="divide-y divide-slate-100">{viewingCustomer.pocs?.length ? viewingCustomer.pocs.map((poc, index) => <tr key={poc.id}><td className="px-4 py-3 text-slate-500">{index + 1}</td><td className="px-4 py-3 font-medium text-slate-900">{poc.name || "—"}</td><td className="px-4 py-3">{poc.designation || "—"}</td><td className="px-4 py-3">{poc.email || "—"}</td><td className="px-4 py-3">{poc.mobile || "—"}</td></tr>) : <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No points of contact added.</td></tr>}</tbody></table></div></section><section className="overflow-hidden rounded-xl border border-slate-200"><div className="border-b bg-slate-50 px-4 py-3"><h3 className="font-semibold text-slate-900">Remarks history</h3></div><div className="divide-y divide-slate-100">{viewingCustomer.remarks?.length ? [...viewingCustomer.remarks].reverse().map((remark) => <div key={remark.id} className="px-4 py-3"><p className="text-sm text-slate-800">{remark.text}</p><p className="mt-1 text-xs text-slate-500">{new Date(remark.createdAt).toLocaleString()}{remark.createdBy ? ` · ${remark.createdBy}` : ""}</p></div>) : <p className="px-4 py-6 text-center text-sm text-slate-500">No remarks yet.</p>}</div></section></div>}<DialogFooter><Button variant="outline" onClick={() => setViewingCustomer(null)}>Close</Button>{viewingCustomer?.email && <Button onClick={() => composeEmail(viewingCustomer.email)}><Mail className="mr-2 h-4 w-4" />Email customer</Button>}</DialogFooter></DialogContent></Dialog>
    <Dialog open={!!remarksCustomer} onOpenChange={(open) => !open && setRemarksCustomer(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Customer remarks</DialogTitle><DialogDescription>{remarksCustomer?.customerName}</DialogDescription></DialogHeader><div className="max-h-64 space-y-3 overflow-y-auto">{remarksCustomer?.remarks?.length ? [...remarksCustomer.remarks].reverse().map((remark) => <div key={remark.id} className="rounded-lg border p-3"><p>{remark.text}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(remark.createdAt).toLocaleString()}{remark.createdBy ? ` · ${remark.createdBy}` : ""}</p></div>) : <p className="py-6 text-center text-sm text-muted-foreground">No remarks yet.</p>}</div><div><Label>Add remark</Label><Textarea value={remarkText} onChange={(event) => setRemarkText(event.target.value)} placeholder="Document follow-up actions or important notes..." className="mt-2" /></div><DialogFooter><Button variant="outline" onClick={() => setRemarksCustomer(null)}>Close</Button><Button onClick={() => addRemark.mutate()} disabled={addRemark.isPending || !remarkText.trim()}>Save remark</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={importOpen} onOpenChange={setImportOpen}><DialogContent><DialogHeader><DialogTitle>Import customer data</DialogTitle><DialogDescription>Upload an Excel or CSV file. Source is optional and defaults to Social media; POC1, POC2, and up to POC10 columns are supported.</DialogDescription></DialogHeader><div className="space-y-3"><Button variant="outline" className="w-full justify-start" onClick={downloadSampleExcel}><Download className="mr-2 h-4 w-4" />Download sample Excel</Button><Button className="w-full justify-start" onClick={() => uploadRef.current?.click()}><FileUp className="mr-2 h-4 w-4" />Choose Excel or CSV file</Button></div></DialogContent></Dialog>
    <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}><DialogContent><DialogHeader><DialogTitle>Run email campaign</DialogTitle><DialogDescription>Open your email app with {selectedCustomers.length} selected customer{selectedCustomers.length === 1 ? "" : "s"} in BCC.</DialogDescription></DialogHeader><div className="space-y-4"><Field label="Subject" value={campaignSubject} onChange={setCampaignSubject} /><div><Label>Message</Label><Textarea value={campaignMessage} onChange={(event) => setCampaignMessage(event.target.value)} className="mt-2 min-h-32" placeholder="Write your campaign message..." /></div></div><DialogFooter><Button variant="outline" onClick={() => setCampaignOpen(false)}>Cancel</Button><Button onClick={composeCampaign}><Mail className="mr-2 h-4 w-4" />Open email</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}><DialogContent><DialogHeader><DialogTitle>Delete customer?</DialogTitle><DialogDescription>This permanently removes {pendingDelete?.customerName} and related contact details.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button><Button variant="destructive" onClick={() => pendingDelete?.id && deleteCustomer.mutate(pendingDelete.id)} disabled={deleteCustomer.isPending}>{deleteCustomer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete</Button></DialogFooter></DialogContent></Dialog><PermissionDeniedDialog open={showPermissionDenied} onOpenChange={setShowPermissionDenied} message="Only administrators can delete customer records." />
  </div></div>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <div><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2" /></div>; }
function CustomerInfoTile({ icon, label, value, tone }: { icon: ReactNode; label: string; value?: string; tone: "blue" | "violet" | "emerald" | "amber" | "slate" }) { const tones = { blue: "border-blue-100 bg-blue-50/70 text-blue-700", violet: "border-violet-100 bg-violet-50/70 text-violet-700", emerald: "border-emerald-100 bg-emerald-50/70 text-emerald-700", amber: "border-amber-100 bg-amber-50/70 text-amber-700", slate: "border-slate-200 bg-slate-50 text-slate-700" }; return <div className={`rounded-xl border p-3.5 ${tones[tone]}`}><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide"><span className="shrink-0">{icon}</span><span>{label}</span></div><p className="mt-2 break-words text-sm font-semibold text-slate-900">{value || "Not provided"}</p></div>; }
function DetailCell({ label, value, wide = false }: { label: string; value?: string; wide?: boolean }) { return <div className={`rounded-lg border border-indigo-100 bg-white px-3 py-2.5 ${wide ? "sm:col-span-2" : ""}`}><p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">{label}</p><p className="mt-1 break-words text-sm text-slate-900">{value || "Not provided"}</p></div>; }
function Stat({ icon, label, value, color }: { icon: ReactNode; label: string; value: number; color: "blue" | "violet" | "emerald" }) { const classes = { blue: "bg-blue-100 text-blue-600", violet: "bg-violet-100 text-violet-600", emerald: "bg-emerald-100 text-emerald-600" }; return <Card className="border-slate-200 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><CardContent className="flex min-h-[104px] items-center gap-4 p-5"><div className={`rounded-xl p-3 ${classes[color]}`}>{icon}</div><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div></CardContent></Card>; }
