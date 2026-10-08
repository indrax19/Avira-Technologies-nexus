import { useMutation } from "@tanstack/react-query";
import { Building2, Camera, Download, Eye, ExternalLink, Mail, MapPin, Pencil, Phone, Plus, Search, ShieldCheck, Trash2, Upload, UserRound, X } from "lucide-react";
import * as XLSX from "xlsx";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PermissionDeniedDialog from "@/components/PermissionDeniedDialog";
import { useAuth } from "@/context/AuthContext";
import { dealWithOptions, vendorDataAPI, vendorTypeOptions, type PointOfContact, type VendorData } from "@/integrations/firebase/vendorDataAPI";
import { supabase } from "@/integrations/supabase/client";

const emptyPoc = (): PointOfContact => ({ id: crypto.randomUUID(), name: "", designation: "", email: "", mobile: "" });
const emptyVendor = (): Omit<VendorData, "id" | "created_at" | "updated_at"> => ({ vendorName: "", companyName: "", designation: "", contactNumber: "", contactNumber2: "", email: "", address: "", visitingCardUrl: "", dealWith: [], manualDealWith: "", vendorTypes: [], pocs: [emptyPoc()] });
const getDealWith = (vendor: VendorData) => [...(Array.isArray(vendor.dealWith) ? vendor.dealWith : vendor.dealWith ? [vendor.dealWith] : []), ...(vendor.manualDealWith?.trim() ? [vendor.manualDealWith.trim()] : [])];
const getDisplayedDealWith = (vendor: VendorData) => getDealWith(vendor).filter((brand) => brand !== "Manual Enter");
const getPocs = (vendor: VendorData) => vendor.pocs?.length ? vendor.pocs : [emptyPoc()];

export default function VendorDatabasePage() {
  const { appUser, isAdmin } = useAuth();
  const [vendors, setVendors] = useState<VendorData[]>([]);
  const [search, setSearch] = useState("");
  const [dealWithFilter, setDealWithFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorData | null>(null);
  const [viewingVendor, setViewingVendor] = useState<VendorData | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VendorData | null>(null);
  const [showPermissionDenied, setShowPermissionDenied] = useState(false);
  const [form, setForm] = useState(emptyVendor());
  const [uploadingCard, setUploadingCard] = useState(false);

  useEffect(() => vendorDataAPI.subscribeAll(setVendors, () => toast.error("Unable to load vendor data.")), []);

  const filteredVendors = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return vendors.filter((vendor) => {
      const brands = getDealWith(vendor);
      const pocs = getPocs(vendor);
      const matchesBrand = dealWithFilter === "all" || brands.includes(dealWithFilter);
      const values = [vendor.vendorName, vendor.companyName, vendor.designation, vendor.contactNumber, vendor.contactNumber2, vendor.email, vendor.address, ...brands, ...vendor.vendorTypes, ...pocs.flatMap((poc) => [poc.name, poc.designation, poc.email, poc.mobile])];
      return matchesBrand && (!needle || values.some((value) => value?.toLowerCase().includes(needle)));
    });
  }, [vendors, search, dealWithFilter]);

  const manualDealWithValues = useMemo(() => [...new Set(vendors.map((vendor) => vendor.manualDealWith?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)), [vendors]);

  const saveVendor = useMutation({
    mutationFn: async () => {
      if (!form.vendorName.trim()) throw new Error("Vendor name is required");
      if (uploadingCard) throw new Error("Wait for visiting card upload to finish");
      const data = { ...form, vendorName: form.vendorName.trim(), pocs: form.pocs.filter((poc) => poc.name.trim() || poc.designation.trim() || poc.email.trim() || poc.mobile.trim()), created_by: appUser?.id };
      if (editingVendor?.id) await vendorDataAPI.update(editingVendor.id, data);
      else await vendorDataAPI.create(data);
    },
    onSuccess: () => { toast.success(editingVendor ? "Vendor updated" : "Vendor added"); closeForm(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteVendor = useMutation({ mutationFn: (id: string) => vendorDataAPI.delete(id), onSuccess: () => { toast.success("Vendor removed"); setPendingDelete(null); }, onError: () => toast.error("Unable to remove vendor") });

  function closeForm() { setFormOpen(false); setEditingVendor(null); setForm(emptyVendor()); }
  function openEdit(vendor: VendorData) { setEditingVendor(vendor); setForm({ ...emptyVendor(), ...vendor, dealWith: Array.isArray(vendor.dealWith) ? vendor.dealWith : vendor.dealWith ? [vendor.dealWith] : [], manualDealWith: vendor.manualDealWith || "", vendorTypes: vendor.vendorTypes || [], pocs: getPocs(vendor) }); setFormOpen(true); }
  function updateField(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  function updatePoc(id: string, field: keyof Omit<PointOfContact, "id">, value: string) { setForm((current) => ({ ...current, pocs: current.pocs.map((poc) => poc.id === id ? { ...poc, [field]: value } : poc) })); }
  function toggleDealWith(brand: string, checked: boolean) { setForm((current) => ({ ...current, dealWith: checked ? [...new Set([...current.dealWith, brand])] : current.dealWith.filter((item) => item !== brand), ...(brand === "Manual Enter" && !checked ? { manualDealWith: "" } : {}) })); }
  function toggleVendorType(type: string, checked: boolean) { setForm((current) => ({ ...current, vendorTypes: checked ? [...new Set([...current.vendorTypes, type])] : current.vendorTypes.filter((item) => item !== type) })); }
  async function uploadVisitingCard(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast.error("Please upload a JPG, PNG, or WebP image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Visiting card image must be less than 5MB"); return; }

    setUploadingCard(true);
    try {
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const filePath = `vendor-visiting-cards/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("company-logos").upload(filePath, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("company-logos").getPublicUrl(filePath);
      setForm((current) => ({ ...current, visitingCardUrl: data.publicUrl }));
      toast.success("Visiting card uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload visiting card");
    } finally {
      setUploadingCard(false);
    }
  }

  function downloadVendorsAsExcel() {
    if (!vendors.length) { toast.info("There are no vendors to export yet."); return; }

    const vendorRows = vendors.map((vendor, index) => ({
      "Sr. No.": index + 1,
      "Vendor Name": vendor.vendorName,
      "Company Name": vendor.companyName || "",
      Designation: vendor.designation || "",
      Email: vendor.email || "",
      "Contact - 1": vendor.contactNumber || "",
      "Contact - 2": vendor.contactNumber2 || "",
      Address: vendor.address || "",
      "Deal With": getDisplayedDealWith(vendor).join(", "),
      "Vendor Type": vendor.vendorTypes?.join(", ") || "",
      "Visiting Card": vendor.visitingCardUrl || "",
      "Created At": vendor.created_at || "",
    }));
    const contactRows = vendors.flatMap((vendor, vendorIndex) => getPocs(vendor)
      .filter((poc) => poc.name || poc.designation || poc.email || poc.mobile)
      .map((poc, contactIndex) => ({
        "Vendor Sr. No.": vendorIndex + 1,
        "Vendor Name": vendor.vendorName,
        "Company Name": vendor.companyName || "",
        "POC No.": contactIndex + 1,
        Name: poc.name,
        Designation: poc.designation,
        Email: poc.email,
        Mobile: poc.mobile,
      })));

    const workbook = XLSX.utils.book_new();
    const vendorsSheet = XLSX.utils.json_to_sheet(vendorRows);
    const contactsSheet = XLSX.utils.json_to_sheet(contactRows, { header: ["Vendor Sr. No.", "Vendor Name", "Company Name", "POC No.", "Name", "Designation", "Email", "Mobile"] });
    vendorsSheet["!cols"] = [
      { wch: 8 }, { wch: 26 }, { wch: 26 }, { wch: 24 }, { wch: 28 }, { wch: 18 }, { wch: 18 },
      { wch: 36 }, { wch: 28 }, { wch: 24 }, { wch: 48 }, { wch: 24 },
    ];
    contactsSheet["!cols"] = [{ wch: 16 }, { wch: 26 }, { wch: 26 }, { wch: 10 }, { wch: 24 }, { wch: 24 }, { wch: 30 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(workbook, vendorsSheet, "Vendors");
    XLSX.utils.book_append_sheet(workbook, contactsSheet, "Points of Contact");
    XLSX.writeFile(workbook, `Vendors_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success(`${vendors.length} vendor${vendors.length === 1 ? "" : "s"} exported to Excel`);
  }

  function requestDelete(vendor: VendorData) { if (!isAdmin) { setShowPermissionDenied(true); return; } setPendingDelete(vendor); }

  return <div className="min-h-full bg-[#f4f8fc] text-slate-800 p-3 sm:p-5 lg:p-7"><div className="mx-auto max-w-[1800px] space-y-4">
    <div className="flex flex-col gap-4 rounded-md bg-gradient-to-r from-[#092f5b] via-[#0d477f] to-[#092f5b] px-4 py-4 text-white shadow-md sm:flex-row sm:items-center sm:justify-between"><div><div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Vendor management</div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Vendor Database</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-blue-100">Maintain vendor details, companies, contact information, and vendor categories.</p></div><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><Button variant="outline" className="w-full border-blue-200/30 bg-white/10 font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white/20 hover:text-white sm:w-auto" onClick={downloadVendorsAsExcel} disabled={!vendors.length} title={vendors.length ? "Download all vendors as an Excel workbook" : "No vendors available to export"}><Download className="h-4 w-4" /><span>Download Excel</span></Button><Button className="w-full bg-white font-semibold text-[#0b3b6d] shadow-md transition-all hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-lg sm:w-auto" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /><span>Add vendor</span></Button></div></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"><Stat icon={<Building2 className="h-5 w-5" />} label="Total vendors" value={vendors.length} color="blue" /><Stat icon={<Building2 className="h-5 w-5" />} label="With company" value={vendors.filter((vendor) => vendor.companyName?.trim()).length} color="violet" /><Stat icon={<Building2 className="h-5 w-5" />} label="With contact" value={vendors.filter((vendor) => vendor.contactNumber?.trim() || vendor.email?.trim() || getPocs(vendor).some((poc) => poc.email || poc.mobile)).length} color="emerald" /></div>
    <Card className="overflow-hidden border-slate-200 shadow-sm transition-shadow duration-200 hover:shadow-md"><CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Vendor directory</CardTitle><p className="mt-1 text-sm text-slate-500">Search vendors, brands, and points of contact.</p></div><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><div className="relative w-full sm:w-64"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vendors or brands" className="pl-9" /></div><select value={dealWithFilter} onChange={(event) => setDealWithFilter(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:w-48"><option value="all">All Deal With</option>{dealWithOptions.filter((brand) => brand !== "Manual Enter").map((brand) => <option key={brand} value={brand}>{brand}</option>)}{manualDealWithValues.length > 0 && <optgroup label="Custom values">{manualDealWithValues.map((brand) => <option key={`manual-${brand}`} value={brand}>{brand}</option>)}</optgroup>}</select></div></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Sr.</th><th className="px-4 py-3">Vendor Name</th><th className="px-4 py-3">Company Name</th><th className="px-4 py-3">Contact Number</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">POCs</th><th className="px-4 py-3">Deal With</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>{filteredVendors.length ? filteredVendors.map((vendor, index) => <tr key={vendor.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-4 py-3 text-slate-500">{index + 1}</td><td className="px-4 py-3 font-medium text-slate-900">{vendor.vendorName}</td><td className="px-4 py-3">{vendor.companyName || "—"}</td><td className="px-4 py-3">{vendor.contactNumber || "—"}</td><td className="px-4 py-3">{vendor.email || "—"}</td><td className="px-4 py-3">{getPocs(vendor).filter((poc) => poc.name || poc.email || poc.mobile).length || "—"}</td><td className="w-[3in] max-w-[3in] whitespace-normal break-words px-4 py-3 align-top">{getDisplayedDealWith(vendor).join(", ") || "—"}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => setViewingVendor(vendor)} aria-label="View vendor"><Eye className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => openEdit(vendor)} aria-label="Edit vendor"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => requestDelete(vendor)} aria-label="Delete vendor"><Trash2 className="h-4 w-4" /></Button></div></td></tr>) : <tr><td colSpan={8} className="px-4 py-14 text-center text-slate-500">{search || dealWithFilter !== "all" ? "No vendors match your filters." : "No vendors yet. Add your first vendor."}</td></tr>}</tbody></table></div></CardContent></Card>

    <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}><DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-4xl"><div className="border-b bg-gradient-to-r from-slate-950 to-slate-800 px-5 py-6 text-white sm:px-8"><DialogHeader><DialogTitle className="text-xl text-white">{editingVendor ? "Edit vendor" : "Add vendor"}</DialogTitle><DialogDescription className="text-slate-300">Add company details, multiple points of contact, and vendor categories.</DialogDescription></DialogHeader></div><form onSubmit={(event: FormEvent) => { event.preventDefault(); saveVendor.mutate(); }} className="space-y-5 p-5 sm:p-8"><section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4"><h3 className="font-semibold text-slate-900">Vendor information</h3><p className="mt-1 text-sm text-slate-500">Basic information used in the vendor directory.</p></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Vendor Name *" value={form.vendorName} onChange={(value) => updateField("vendorName", value)} /><Field label="Company Name" value={form.companyName || ""} onChange={(value) => updateField("companyName", value)} /><Field label="Designation" value={form.designation || ""} onChange={(value) => updateField("designation", value)} /><Field label="Email" value={form.email || ""} onChange={(value) => updateField("email", value)} type="email" /><Field label="Contact - 1" value={form.contactNumber || ""} onChange={(value) => updateField("contactNumber", value)} type="tel" /><Field label="Contact - 2" value={form.contactNumber2 || ""} onChange={(value) => updateField("contactNumber2", value)} type="tel" /><div className="sm:col-span-2"><Label>Address</Label><Textarea value={form.address || ""} onChange={(event) => updateField("address", event.target.value)} className="mt-2 min-h-24" placeholder="Enter complete business address" /></div></div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold text-slate-900">Points of contact</h3><p className="mt-1 text-sm text-slate-500">Add one or more people for this vendor.</p></div><Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setForm((current) => ({ ...current, pocs: [...current.pocs, emptyPoc()] }))}><Plus className="mr-2 h-4 w-4" />Add POC</Button></div><div className="space-y-4">{form.pocs.map((poc, index) => <div key={poc.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-slate-800">POC {index + 1}</p>{form.pocs.length > 1 && <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setForm((current) => ({ ...current, pocs: current.pocs.filter((item) => item.id !== poc.id) }))}><X className="mr-1 h-4 w-4" />Remove</Button>}</div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><PocField label="Name" value={poc.name} onChange={(value) => updatePoc(poc.id, "name", value)} /><PocField label="Company" value={poc.designation} onChange={(value) => updatePoc(poc.id, "designation", value)} /><PocField label="Email" value={poc.email} onChange={(value) => updatePoc(poc.id, "email", value)} type="email" /><PocField label="Mobile" value={poc.mobile} onChange={(value) => updatePoc(poc.id, "mobile", value)} type="tel" /></div></div>)}</div></section>
      <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h3 className="font-semibold text-slate-900">Deal With</h3><p className="mb-4 mt-1 text-sm text-slate-500">Select all brands this vendor deals with.</p><div className="grid gap-3 sm:grid-cols-2">{dealWithOptions.map((option) => <label key={option} className="flex items-center gap-2 text-sm"><Checkbox checked={form.dealWith.includes(option)} onCheckedChange={(checked) => toggleDealWith(option, checked === true)} />{option}</label>)}</div>{form.dealWith.includes("Manual Enter") && <div className="mt-4"><Label htmlFor="manualDealWith">Custom brand or company</Label><Input id="manualDealWith" value={form.manualDealWith || ""} onChange={(event) => updateField("manualDealWith", event.target.value)} placeholder="Enter a custom Deal With value" className="mt-2" /></div>}</section><div className="space-y-5"><section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h3 className="font-semibold text-slate-900">Vendor Type</h3><p className="mb-4 mt-1 text-sm text-slate-500">Select one or more vendor categories.</p><div className="grid gap-3 sm:grid-cols-2">{vendorTypeOptions.map((type) => <label key={type} className="flex items-center gap-2 text-sm"><Checkbox checked={form.vendorTypes.includes(type)} onCheckedChange={(checked) => toggleVendorType(type, checked === true)} />{type}</label>)}</div></section><section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4"><h3 className="font-semibold text-slate-900">Upload Visiting Card</h3><p className="mt-1 text-sm text-slate-500">Take a photo or upload an image of the visiting card.</p></div>{form.visitingCardUrl ? <div className="space-y-3"><img src={form.visitingCardUrl} alt="Visiting card preview" className="h-36 w-full rounded-lg border border-slate-200 object-contain bg-slate-50" /><Button type="button" variant="outline" size="sm" onClick={() => updateField("visitingCardUrl", "")}>Remove card</Button></div> : <div className="grid gap-3 sm:grid-cols-2"><Label htmlFor="visitingCardCamera" className="flex h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 text-sm font-medium text-slate-700 transition-colors hover:border-blue-400 hover:bg-blue-50"><Camera className="h-5 w-5 text-blue-600" />{uploadingCard ? "Uploading..." : "Use camera"}</Label><Input id="visitingCardCamera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={uploadVisitingCard} disabled={uploadingCard} /><Label htmlFor="visitingCardUpload" className="flex h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 text-sm font-medium text-slate-700 transition-colors hover:border-blue-400 hover:bg-blue-50"><Upload className="h-5 w-5 text-blue-600" />{uploadingCard ? "Uploading..." : "Upload image"}</Label><Input id="visitingCardUpload" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={uploadVisitingCard} disabled={uploadingCard} /></div>}<p className="mt-3 text-xs text-slate-500">JPG, PNG, or WebP up to 5MB.</p></section></div></div><DialogFooter className="border-t pt-5"><Button type="button" variant="outline" onClick={closeForm}>Cancel</Button><Button type="submit" disabled={saveVendor.isPending || !form.vendorName.trim()}>{saveVendor.isPending ? "Saving..." : editingVendor ? "Update vendor" : "Create vendor"}</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={!!viewingVendor} onOpenChange={(open) => !open && setViewingVendor(null)}><DialogContent className="max-h-[92vh] overflow-y-auto bg-[#f8fbff] p-0 sm:max-w-5xl [&>button]:text-white"><div className="border-b bg-gradient-to-r from-[#092f5b] via-[#0d477f] to-[#1263a0] px-5 py-6 text-white sm:px-8"><DialogHeader className="pr-8"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100"><ShieldCheck className="h-4 w-4" />Vendor profile</div><DialogTitle className="truncate text-xl text-white sm:text-2xl">{viewingVendor?.vendorName || "Vendor details"}</DialogTitle><DialogDescription className="text-blue-100">Complete vendor record and contact information.</DialogDescription></DialogHeader></div>{viewingVendor && <div className="space-y-5 bg-[#f8fbff] p-4 sm:p-8"><section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-start gap-3"><div className="rounded-xl bg-blue-100 p-2.5 text-blue-700"><Building2 className="h-5 w-5" /></div><div><h3 className="font-semibold text-slate-900">Profile overview</h3><p className="mt-1 text-sm text-slate-500">Key information for quick reference.</p></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><InfoTile icon={<Building2 className="h-4 w-4" />} label="Company" value={viewingVendor.companyName} tone="violet" /><InfoTile icon={<UserRound className="h-4 w-4" />} label="Designation" value={viewingVendor.designation} tone="blue" /><InfoTile icon={<Phone className="h-4 w-4" />} label="Contact - 1" value={viewingVendor.contactNumber} tone="emerald" /><InfoTile icon={<Phone className="h-4 w-4" />} label="Contact - 2" value={viewingVendor.contactNumber2} tone="blue" /><InfoTile icon={<Mail className="h-4 w-4" />} label="Email" value={viewingVendor.email} tone="amber" /><InfoTile icon={<ShieldCheck className="h-4 w-4" />} label="Vendor type" value={viewingVendor.vendorTypes?.join(", ")} tone="blue" /><InfoTile icon={<MapPin className="h-4 w-4" />} label="Address" value={viewingVendor.address} tone="slate" wide /></div><div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700"><ShieldCheck className="h-4 w-4" />Deal With</div><div className="flex flex-wrap gap-2">{getDisplayedDealWith(viewingVendor).length ? getDisplayedDealWith(viewingVendor).map((brand) => <span key={brand} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-sm font-medium text-blue-800">{brand}</span>) : <span className="text-sm text-slate-500">No brands selected</span>}</div></div></section>{viewingVendor.visitingCardUrl && <section className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="rounded-xl bg-amber-100 p-2.5 text-amber-700"><ExternalLink className="h-5 w-5" /></div><div><h3 className="font-semibold text-slate-900">Visiting card</h3><p className="mt-1 text-sm text-slate-500">Uploaded reference for this vendor.</p></div></div><a href={viewingVendor.visitingCardUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"><ExternalLink className="h-3.5 w-3.5" />Open</a></div><a href={viewingVendor.visitingCardUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-amber-100 bg-white"><img src={viewingVendor.visitingCardUrl} alt={`${viewingVendor.vendorName} visiting card`} className="max-h-72 w-full object-contain" /></a></section>}<section className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm"><div className="flex items-center gap-3 border-b border-indigo-100 bg-indigo-50/70 px-4 py-4 sm:px-5"><div className="rounded-xl bg-indigo-100 p-2.5 text-indigo-700"><UserRound className="h-5 w-5" /></div><div><h3 className="font-semibold text-slate-900">Points of contact</h3><p className="mt-1 text-sm text-slate-500">People connected with this vendor.</p></div></div><div className="space-y-3 p-3 sm:p-4">{getPocs(viewingVendor).filter((poc) => poc.name || poc.designation || poc.email || poc.mobile).map((poc, index) => <div key={poc.id} className="grid gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50 sm:grid-cols-2"><DetailCell label={`POC ${index + 1} Name`} value={poc.name} /><DetailCell label="Company" value={poc.designation} /><DetailCell label="Email" value={poc.email} /><DetailCell label="Mobile" value={poc.mobile} /></div>)}</div></section></div>}<DialogFooter><Button variant="outline" onClick={() => setViewingVendor(null)}>Close</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}><DialogContent><DialogHeader><DialogTitle>Delete vendor?</DialogTitle><DialogDescription>This permanently removes {pendingDelete?.vendorName} and its details.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button><Button variant="destructive" onClick={() => pendingDelete?.id && deleteVendor.mutate(pendingDelete.id)} disabled={deleteVendor.isPending}>Delete</Button></DialogFooter></DialogContent></Dialog><PermissionDeniedDialog open={showPermissionDenied} onOpenChange={setShowPermissionDenied} message="Only administrators can delete vendor records." />
  </div></div>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <div><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2" /></div>; }
function PocField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <div><Label className="text-xs">{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 bg-white" /></div>; }
function InfoTile({ icon, label, value, tone, wide = false }: { icon: React.ReactNode; label: string; value?: string; tone: "blue" | "violet" | "emerald" | "amber" | "slate"; wide?: boolean }) { const tones = { blue: "border-blue-100 bg-blue-50/70 text-blue-700", violet: "border-violet-100 bg-violet-50/70 text-violet-700", emerald: "border-emerald-100 bg-emerald-50/70 text-emerald-700", amber: "border-amber-100 bg-amber-50/70 text-amber-700", slate: "border-slate-200 bg-slate-50 text-slate-700" }; return <div className={`rounded-xl border p-3.5 ${tones[tone]} ${wide ? "sm:col-span-2 lg:col-span-4" : ""}`}><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide"><span className="shrink-0">{icon}</span><span>{label}</span></div><p className="mt-2 break-words text-sm font-semibold text-slate-900">{value || "Not provided"}</p></div>; }
function DetailCell({ label, value, wide = false }: { label: string; value?: string; wide?: boolean }) { return <div className={`rounded-lg border border-indigo-100 bg-white px-3 py-2.5 ${wide ? "sm:col-span-2" : ""}`}><p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">{label}</p><p className="mt-1 break-words text-sm text-slate-900">{value || "Not provided"}</p></div>; }
function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: "blue" | "violet" | "emerald" }) { const classes = { blue: "bg-blue-100 text-blue-600", violet: "bg-violet-100 text-violet-600", emerald: "bg-emerald-100 text-emerald-600" }; return <Card className="border-slate-200 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><CardContent className="flex min-h-[104px] items-center gap-4 p-5"><div className={`rounded-xl p-3 ${classes[color]}`}>{icon}</div><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div></CardContent></Card>; }
