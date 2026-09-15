import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Building2,
  CalendarDays,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Handshake,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
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
  isPartnerExpiringSoon,
  partnerDataAPI,
  type PartnerData,
  type PartnerInput,
  type PartnershipContact,
} from "@/integrations/firebase/partnerDataAPI";
import { supabase } from "@/integrations/supabase/client";

const emptyContact = (): PartnershipContact => ({
  name: "",
  city: "",
  state: "",
  country: "",
  accountManager: "",
  salesOwner: "",
  email: "",
  phone: "",
});
const partnerTierOptions = [
  "Gold",
  "Silver",
  "Platinum",
  "Registered",
  "Autoraized",
  "Resellar",
  "Other",
];
const partnerStatusOptions = [
  "Gold",
  "Silver",
  "Platinum",
  "Registered",
  "Autoraized",
  "Resellar",
  "Other",
];

const emptyPartner = (): PartnerInput => ({
  partnerId: "",
  partnerName: "",
  brand: "",
  partnerTier: "",
  partnerStatus: "Registered",
  associatedCompany: "",
  address: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
  partnershipSince: "",
  validTill: "",
  authorizationNo: "",
  accountManager: "",
  accountManagerName: "",
  accountManagerEmail: "",
  accountManagerPhone: "",
  salesOwner: "",
  salesOwnerName: "",
  salesOwnerEmail: "",
  salesOwnerPhone: "",
  username: "",
  password: "",
  portalUrl: "",
  partnershipType: "Distributor",
  partnershipTypeOther: "",
  partnershipContacts: [emptyContact()],
  partnerTierLevel: "",
  partnerTierOther: "",
  partnerTierLevelOther: "",
  notes: "",
});

export default function PartnerPage() {
  const { appUser, isAdmin } = useAuth();
  const [partners, setPartners] = useState<PartnerData[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [tierFilter, setTierFilter] = useState("All");
  const [brandFilter, setBrandFilter] = useState("All");
  const [partnerNameFilter, setPartnerNameFilter] = useState("All");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PartnerInput>(emptyPartner());
  const [editingPartner, setEditingPartner] = useState<PartnerData | null>(
    null,
  );
  const [viewingPartner, setViewingPartner] = useState<PartnerData | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<PartnerData | null>(null);
  const [showPermissionDenied, setShowPermissionDenied] = useState(false);
  const [showPassword, setShowPassword] = useState(true);
  const [partnerDocument, setPartnerDocument] = useState<File | null>(null);
  const [businessCard, setBusinessCard] = useState<File | null>(null);

  useEffect(
    () =>
      partnerDataAPI.subscribeAll(setPartners, () =>
        toast.error("Unable to load partner data."),
      ),
    [],
  );

  const partnerBrands = useMemo(
    () =>
      [
        ...new Set(
          partners
            .map((partner) => partner.brand?.trim())
            .filter(Boolean) as string[],
        ),
      ].sort(),
    [partners],
  );
  const partnerNames = useMemo(
    () =>
      [
        ...new Set(
          partners
            .map((partner) => partner.partnerName?.trim())
            .filter(Boolean) as string[],
        ),
      ].sort(),
    [partners],
  );
  const filteredPartners = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return partners.filter((partner) => {
      const values = [
        partner.partnerId,
        partner.partnerName,
        partner.brand,
        partner.associatedCompany,
      ];
      return (
        (!needle ||
          values.some((value) => value?.toLowerCase().includes(needle))) &&
        (statusFilter === "All" || partner.partnerStatus === statusFilter) &&
        (tierFilter === "All" || partner.partnerTier === tierFilter) &&
        (brandFilter === "All" || partner.brand === brandFilter) &&
        (partnerNameFilter === "All" ||
          partner.partnerName === partnerNameFilter)
      );
    });
  }, [
    partners,
    search,
    statusFilter,
    tierFilter,
    brandFilter,
    partnerNameFilter,
  ]);

  const uploadPartnerFile = async (file: File, folder: string) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `partner-documents/${folder}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage
      .from("company-logos")
      .upload(path, file, { upsert: false });
    if (error) throw error;
    return supabase.storage.from("company-logos").getPublicUrl(path).data
      .publicUrl;
  };

  const savePartner = useMutation({
    mutationFn: async () => {
      if (!form.partnerName.trim()) throw new Error("Partner name is required");
      const partnerDocumentUrl = partnerDocument
        ? await uploadPartnerFile(partnerDocument, "documents")
        : editingPartner?.partnerDocumentUrl;
      const businessCardUrl = businessCard
        ? await uploadPartnerFile(businessCard, "business-cards")
        : editingPartner?.businessCardUrl;
      const data = {
        ...form,
        partnerName: form.partnerName.trim(),
        partnerDocumentUrl,
        businessCardUrl,
        created_by: appUser?.id,
      };
      if (editingPartner?.id)
        await partnerDataAPI.update(editingPartner.id, data);
      else await partnerDataAPI.create(data);
    },
    onSuccess: () => {
      toast.success(editingPartner ? "Partner updated" : "Partner added");
      closeForm();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deletePartner = useMutation({
    mutationFn: (id: string) => partnerDataAPI.delete(id),
    onSuccess: () => {
      toast.success("Partner deleted");
      setPendingDelete(null);
    },
    onError: () => toast.error("Unable to delete partner"),
  });

  function updateField(field: keyof PartnerInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  function updateContact(
    index: number,
    field: keyof PartnershipContact,
    value: string,
  ) {
    setForm((current) => {
      const contacts = current.partnershipContacts?.length
        ? [...current.partnershipContacts]
        : [emptyContact()];
      contacts[index] = { ...contacts[index], [field]: value };
      const legacyFields: Partial<
        Record<keyof PartnershipContact, keyof PartnerInput>
      > = {
        city: "city",
        state: "state",
        country: "country",
        accountManager: "accountManager",
        salesOwner: "salesOwner",
      };
      return {
        ...current,
        partnershipContacts: contacts,
        ...(index === 0 && legacyFields[field]
          ? { [legacyFields[field]]: value }
          : {}),
      };
    });
  }
  function addContact() {
    setForm((current) => ({
      ...current,
      partnershipContacts: [
        ...(current.partnershipContacts || [emptyContact()]),
        emptyContact(),
      ],
    }));
  }
  function openCreate() {
    setEditingPartner(null);
    setShowPassword(true);
    setPartnerDocument(null);
    setBusinessCard(null);
    setForm(emptyPartner());
    setFormOpen(true);
  }
  function openEdit(partner: PartnerData) {
    const legacyContact = {
      ...emptyContact(),
      city: partner.city,
      state: partner.state,
      country: partner.country,
      accountManager: partner.accountManager,
      salesOwner: partner.salesOwner,
    };
    setEditingPartner(partner);
    setShowPassword(true);
    setPartnerDocument(null);
    setBusinessCard(null);
    setForm({
      ...emptyPartner(),
      ...partner,
      partnershipType: partner.partnershipType || "Distributor",
      partnershipContacts: partner.partnershipContacts?.length
        ? partner.partnershipContacts
        : [legacyContact],
    });
    setFormOpen(true);
  }
  function closeForm() {
    setFormOpen(false);
    setEditingPartner(null);
    setPartnerDocument(null);
    setBusinessCard(null);
    setForm(emptyPartner());
  }
  function downloadPartnersAsExcel() {
    if (!partners.length) {
      toast.info("There are no partners to export yet.");
      return;
    }

    const rows = partners.map((partner, index) => ({
      "Sr. No.": index + 1,
      "Partner ID": partner.partnerId,
      "Partner Name": partner.partnerName,
      Brand: partner.brand,
      Tier: partner.partnerTier,
      Status: partner.partnerStatus,
      "Associated Company": partner.associatedCompany,
      Address: partner.address,
      City: partner.city,
      State: partner.state,
      Country: partner.country,
      "Postal Code": partner.postalCode,
      "Partnership Since": formatDate(partner.partnershipSince),
      "Valid Till": formatDate(partner.validTill),
      "Authorization No.": partner.authorizationNo,
      "Account Manager": partner.accountManager,
      "Sales Owner": partner.salesOwner,
      "Created At": partner.created_at || "",
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 28 },
      { wch: 24 },
      { wch: 16 },
      { wch: 14 },
      { wch: 28 },
      { wch: 34 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Partners");
    XLSX.writeFile(
      workbook,
      `Partners_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success(
      `${partners.length} partner${partners.length === 1 ? "" : "s"} exported to Excel`,
    );
  }

  function requestDelete(partner: PartnerData) {
    if (!isAdmin) {
      setShowPermissionDenied(true);
      return;
    }
    setPendingDelete(partner);
  }

  return (
    <div className="min-h-full bg-[#f4f8fc] text-slate-800">
      <div className="bg-gradient-to-r from-[#092f5b] via-[#0d477f] to-[#092f5b] px-4 py-3 text-white shadow-md sm:px-6">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-white/15 p-2">
              <Handshake className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wide sm:text-lg">
                OEM PARTNER MANAGEMENT
              </h1>
              <p className="text-[10px] font-medium text-blue-100 sm:text-xs">
                OEM Partner Registration &amp; Management System
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              variant="outline"
              className="w-full border-blue-200/30 bg-white/10 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white/20 hover:text-white sm:w-auto"
              onClick={downloadPartnersAsExcel}
              disabled={!partners.length}
              title={
                partners.length
                  ? "Download all partners as an Excel workbook"
                  : "No partners available to export"
              }
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Excel</span>
            </Button>
            <Button
              className="w-full bg-emerald-500 text-xs font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-400 sm:w-auto"
              onClick={openCreate}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New OEM Partner</span>
            </Button>
          </div>
        </div>
      </div>
      <main className="mx-auto min-w-0 max-w-[1800px] space-y-4 overflow-x-hidden p-3 sm:p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#1d588e]">
          <Building2 className="h-4 w-4" />
          OEM Partner Directory
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="Total partners"
            value={partners.length}
            icon={<Building2 />}
          />
          <Stat
            label="Active partners"
            value={
              partners.filter((partner) => partner.partnerStatus === "Active")
                .length
            }
            icon={<ShieldCheck />}
          />
          <Stat
            label="Partners with tier"
            value={
              partners.filter((partner) => partner.partnerTier?.trim()).length
            }
            icon={<Users />}
          />
        </div>
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="flex flex-col gap-3 border-b bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-[#145487]">
                OEM Partners
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Search, review, and manage registered partner records.
              </p>
            </div>
            <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
              <div className="relative w-full sm:w-52">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search partners"
                  className="h-9 w-full pl-8 text-xs"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs sm:w-auto"
              >
                <option value="All">All status</option>
                <option>Gold</option>
                <option>Silver</option>
                <option>Platinum</option>
                <option>Registered</option>
                <option>Autoraized</option>
                <option>Resellar</option>
                <option>Other</option>
              </select>
              <select
                value={tierFilter}
                onChange={(event) => setTierFilter(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs sm:w-auto"
              >
                <option value="All">All tiers</option>
                <option>Gold</option>
                <option>Silver</option>
                <option>Platinum</option>
                <option>Registered</option>
                <option>Autoraized</option>
                <option>Resellar</option>
                <option>Other</option>
              </select>
              <select
                value={brandFilter}
                onChange={(event) => setBrandFilter(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs sm:w-auto sm:max-w-40"
              >
                <option value="All">All brands</option>
                {partnerBrands.map((brand) => (
                  <option key={brand}>{brand}</option>
                ))}
              </select>
              <select
                value={partnerNameFilter}
                onChange={(event) => setPartnerNameFilter(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs sm:w-auto sm:max-w-52"
              >
                <option value="All">All partner names</option>
                {partnerNames.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>
          {filteredPartners.length ? (
            <div className="max-w-full overflow-x-auto overscroll-x-contain [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    {[
                      "Sr.",
                      "Partner Name",
                      "Partner ID",
                      "Brand / Product",
                      "Tier",
                      "Status",
                      "Partnership Since",
                      "Valid Till",
                      "Actions",
                    ].map((heading) => (
                      <th key={heading} className="whitespace-nowrap px-3 py-3">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPartners.map((partner, index) => (
                    <tr key={partner.id} className={isPartnerExpiringSoon(partner.validTill) ? "bg-red-100 text-red-950 hover:bg-red-200" : "hover:bg-blue-50/50"}>
                      <td className="px-3 py-3 text-xs">{index + 1}</td>
                      <td className="max-w-[240px] px-3 py-3 text-xs font-semibold">
                        {partner.partnerName}
                      </td>
                      <td className="px-3 py-3 text-xs font-medium text-blue-700">
                        {partner.partnerId || "—"}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {partner.brand || "—"}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {partner.partnerTier || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${partner.partnerStatus === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                        >
                          {partner.partnerStatus || "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs">
                        {formatDate(partner.partnershipSince)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs">
                        {formatDate(partner.validTill)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setViewingPartner(partner)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openEdit(partner)}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                            onClick={() => requestDelete(partner)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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
              hasSearch={Boolean(
                search ||
                statusFilter !== "All" ||
                tierFilter !== "All" ||
                brandFilter !== "All" ||
                partnerNameFilter !== "All",
              )}
            />
          )}
        </Card>
      </main>

      <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto bg-[#f7faff] p-0 sm:max-w-6xl">
          <div className="border-b bg-gradient-to-r from-[#092f5b] to-[#0d477f] px-5 py-5 text-white sm:px-7">
            <DialogHeader>
              <DialogTitle className="text-xl text-white">
                {editingPartner
                  ? "Edit OEM Partner"
                  : "OEM Partner Registration Form"}
              </DialogTitle>
              <DialogDescription className="text-blue-100">
                Complete all partner information below, then save the record.
              </DialogDescription>
            </DialogHeader>
          </div>
          <form
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              savePartner.mutate();
            }}
            className="flex flex-col space-y-5 p-4 sm:p-7"
          >
            <PartnerRegistrationFields
              form={form}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((current) => !current)}
              onUpdateField={updateField}
              onUpdateContact={updateContact}
              onAddContact={addContact}
            />
            <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 shadow-sm sm:p-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Partner documents
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Upload partner documents before saving the record.
                </p>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Partner documents *
                </Label>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(event) =>
                    setPartnerDocument(event.target.files?.[0] || null)
                  }
                  className="mt-2 cursor-pointer"
                />
                {editingPartner?.partnerDocumentUrl && !partnerDocument && (
                  <a
                    href={editingPartner.partnerDocumentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-xs text-blue-700 underline"
                  >
                    Existing document
                  </a>
                )}
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Business card (optional)
                </Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) =>
                    setBusinessCard(event.target.files?.[0] || null)
                  }
                  className="mt-2 cursor-pointer"
                />
                {editingPartner?.businessCardUrl && !businessCard && (
                  <a
                    href={editingPartner.businessCardUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-xs text-blue-700 underline"
                  >
                    Existing business card
                  </a>
                )}
              </div>
            </section>
            <DialogFooter className="border-t pt-5">
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#0d4d85] hover:bg-[#093b68]"
                disabled={savePartner.isPending}
              >
                {savePartner.isPending
                  ? "Saving..."
                  : editingPartner
                    ? "Update Partner"
                    : "Save Partner"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewingPartner)}
        onOpenChange={(open) => !open && setViewingPartner(null)}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto bg-[#f8fbff] p-0 sm:max-w-5xl [&>button]:text-white">
          <div className="border-b bg-gradient-to-r from-[#092f5b] via-[#0d477f] to-[#1263a0] px-5 py-6 text-white sm:px-8">
            <DialogHeader className="pr-8">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
                <Handshake className="h-4 w-4" />
                Partner profile
              </div>
              <DialogTitle className="truncate text-xl text-white sm:text-2xl">
                {viewingPartner?.partnerName || "Partner details"}
              </DialogTitle>
              <DialogDescription className="text-blue-100">
                Complete partner record and business relationship information.
              </DialogDescription>
            </DialogHeader>
          </div>
          {viewingPartner && (
            <div className="space-y-5 bg-[#f8fbff] p-4 sm:p-8">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-start gap-3">
                  <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700">
                    <Handshake className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Partner overview
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Key relationship information for quick reference.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <PartnerInfoTile
                    icon={<FileText className="h-4 w-4" />}
                    label="Partner ID"
                    value={viewingPartner.partnerId}
                    tone="blue"
                  />
                  <PartnerInfoTile
                    icon={<Users className="h-4 w-4" />}
                    label="Username"
                    value={viewingPartner.username}
                    tone="violet"
                  />
                  <PartnerInfoTile
                    icon={<ShieldCheck className="h-4 w-4" />}
                    label="Password"
                    value={viewingPartner.password}
                    tone="slate"
                  />
                  <PartnerInfoTile
                    icon={<CalendarDays className="h-4 w-4" />}
                    label="Created At"
                    value={viewingPartner.created_at}
                    tone="slate"
                  />
                  <PartnerInfoTile
                    icon={<Building2 className="h-4 w-4" />}
                    label="Brand / product"
                    value={viewingPartner.brand}
                    tone="violet"
                  />
                  <PartnerInfoTile
                    icon={<ShieldCheck className="h-4 w-4" />}
                    label="Tier"
                    value={viewingPartner.partnerTier}
                    tone="amber"
                  />
                  <PartnerInfoTile
                    icon={<ShieldCheck className="h-4 w-4" />}
                    label="Status"
                    value={viewingPartner.partnerStatus}
                    tone={
                      viewingPartner.partnerStatus === "Active"
                        ? "emerald"
                        : "slate"
                    }
                  />
                  <PartnerInfoTile
                    icon={<Building2 className="h-4 w-4" />}
                    label="Associated company"
                    value={viewingPartner.associatedCompany}
                    tone="slate"
                    wide
                  />
                  <PartnerInfoTile
                    icon={<FileText className="h-4 w-4" />}
                    label="Authorization no."
                    value={viewingPartner.authorizationNo}
                    tone="blue"
                  />
                  <PartnerInfoTile
                    icon={<CalendarDays className="h-4 w-4" />}
                    label="Partnership since"
                    value={formatDate(viewingPartner.partnershipSince)}
                    tone="violet"
                  />
                  <PartnerInfoTile
                    icon={<CalendarDays className="h-4 w-4" />}
                    label="Valid till"
                    value={formatDate(viewingPartner.validTill)}
                    tone="amber"
                  />
                </div>
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                      Registered address
                    </p>
                    <p className="mt-1 break-words text-sm font-medium text-slate-900">
                      {[
                        viewingPartner.address,
                        viewingPartner.city,
                        viewingPartner.state,
                        viewingPartner.country,
                        viewingPartner.postalCode,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Not provided"}
                    </p>
                  </div>
                </div>
              </section>
              <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
                <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50/70 px-4 py-4 sm:px-5">
                  <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Relationship owners
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Internal ownership for this partner account.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                  <PartnerDetail
                    label="Account manager"
                    value={viewingPartner.accountManager}
                  />
                  <PartnerDetail
                    label="Sales owner"
                    value={viewingPartner.salesOwner}
                  />
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete partner?</DialogTitle>
            <DialogDescription>
              This permanently removes {pendingDelete?.partnerName} from the
              partner directory.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                pendingDelete?.id && deletePartner.mutate(pendingDelete.id)
              }
              disabled={deletePartner.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PermissionDeniedDialog
        open={showPermissionDenied}
        onOpenChange={setShowPermissionDenied}
        message="Only administrators can delete partner records."
      />
    </div>
  );
}

function SectionHeader({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3.5 sm:px-5">
      <span className="rounded-md bg-[#145487] px-2 py-1 text-[10px] font-bold tracking-wider text-white">
        {number}
      </span>
      <div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function PartnerRegistrationFields({
  form,
  showPassword,
  onTogglePassword,
  onUpdateField,
  onUpdateContact,
  onAddContact,
}: {
  form: PartnerInput;
  showPassword: boolean;
  onTogglePassword: () => void;
  onUpdateField: (field: keyof PartnerInput, value: string) => void;
  onUpdateContact: (
    index: number,
    field: keyof PartnershipContact,
    value: string,
  ) => void;
  onAddContact: () => void;
}) {
  return (
    <>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader
          number="01"
          title="Basic Information"
          description="OEM partner identity and portal access."
        />
        <div className="grid gap-x-4 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-5">
          <Field
            label="OEM Partner ID"
            value={form.partnerId}
            onChange={(value) => onUpdateField("partnerId", value)}
          />
          <Field
            label="OEM Partner Name *"
            value={form.partnerName}
            onChange={(value) => onUpdateField("partnerName", value)}
          />
          <Field
            label="Portal URL"
            value={form.portalUrl || ""}
            onChange={(value) => onUpdateField("portalUrl", value)}
            type="url"
          />
          <Field
            label="Username"
            value={form.username}
            onChange={(value) => onUpdateField("username", value)}
          />
          <div>
            <Label className="text-xs font-semibold text-slate-600">
              Password
            </Label>
            <div className="relative mt-1.5">
              <Input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) =>
                  onUpdateField("password", event.target.value)
                }
                className="pr-10"
              />
              <button
                type="button"
                onClick={onTogglePassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#145487]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <Field
            label="Brand / Product Line"
            value={form.brand}
            onChange={(value) => onUpdateField("brand", value)}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader
          number="02"
          title="Partnership Details"
          description="Relationship type and primary contact information."
        />
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-4 sm:px-5">
          <Label className="text-xs font-semibold text-slate-700">
            Partnership type
          </Label>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {["Distributor", "Reseller", "Deller", "Patner", "Other"].map((type) => (
              <label
                key={type}
                className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="radio"
                  name="partnershipType"
                  value={type}
                  checked={form.partnershipType === type}
                  onChange={(event) =>
                    onUpdateField("partnershipType", event.target.value)
                  }
                  className="h-4 w-4 accent-[#145487]"
                />
                {type}
              </label>
            ))}
          </div>
          {form.partnershipType === "Other" && (
            <Input
              value={form.partnershipTypeOther || ""}
              onChange={(event) =>
                onUpdateField("partnershipTypeOther", event.target.value)
              }
              placeholder="Enter partnership type"
              className="mt-3 max-w-md"
            />
          )}
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          {(form.partnershipContacts || [emptyContact()]).map(
            (contact, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-lg border border-slate-200"
              >
                <div className="flex items-center justify-between border-b border-slate-100 bg-blue-50/70 px-4 py-2.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#145487]">
                    Contact set {String(index + 1).padStart(2, "0")}
                  </p>
                  <span className="text-xs text-slate-500">
                    Relationship contact details
                  </span>
                </div>
                <div className="grid gap-x-4 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field
                    label="Name"
                    value={contact.name}
                    onChange={(value) => onUpdateContact(index, "name", value)}
                  />
                  <Field
                    label="City"
                    value={contact.city}
                    onChange={(value) => onUpdateContact(index, "city", value)}
                  />
                  <Field
                    label="State / Province"
                    value={contact.state}
                    onChange={(value) => onUpdateContact(index, "state", value)}
                  />
                  <Field
                    label="Country"
                    value={contact.country}
                    onChange={(value) =>
                      onUpdateContact(index, "country", value)
                    }
                  />
                </div>
              </div>
            ),
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onAddContact}
            className="border-dashed border-[#145487]/40 text-[#145487] hover:bg-blue-50"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add another contact set
          </Button>
          <div className="grid gap-4 lg:grid-cols-2">
            <ContactRoleFields
              title="Account Manager"
              name={form.accountManagerName || ""}
              email={form.accountManagerEmail || ""}
              phone={form.accountManagerPhone || ""}
              onUpdateField={onUpdateField}
              fields={["accountManagerName", "accountManagerEmail", "accountManagerPhone"]}
            />
            <ContactRoleFields
              title="Sales Owner"
              name={form.salesOwnerName || ""}
              email={form.salesOwnerEmail || ""}
              phone={form.salesOwnerPhone || ""}
              onUpdateField={onUpdateField}
              fields={["salesOwnerName", "salesOwnerEmail", "salesOwnerPhone"]}
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader
          number="03"
          title="Commercial Information"
          description="Tier, eligibility, and authorization details."
        />
        <div className="grid gap-x-4 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-5">
          <SelectField
            label="Partner Tier"
            value={form.partnerTier}
            options={partnerTierOptions}
            onChange={(value) => onUpdateField("partnerTier", value)}
          />
          <Field
            label="Partnership Since"
            value={form.partnershipSince}
            onChange={(value) => onUpdateField("partnershipSince", value)}
            type="date"
          />
          {form.partnerTier === "Other" && (
            <Field
              label="Specify Partner Tier"
              value={form.partnerTierOther || ""}
              onChange={(value) => onUpdateField("partnerTierOther", value)}
            />
          )}
          <Field
            label="Valid Till"
            value={form.validTill}
            onChange={(value) => onUpdateField("validTill", value)}
            type="date"
          />
          <Field
            label="Authorization Number"
            value={form.authorizationNo}
            onChange={(value) => onUpdateField("authorizationNo", value)}
          />
          <SelectField
            label="Partner Status / Type"
            value={form.partnerTierLevel || ""}
            options={partnerStatusOptions}
            onChange={(value) => onUpdateField("partnerTierLevel", value)}
          />
          {form.partnerTierLevel === "Other" && (
            <Field
              label="Specify Tier / Level"
              value={form.partnerTierLevelOther || ""}
              onChange={(value) =>
                onUpdateField("partnerTierLevelOther", value)
              }
            />
          )}
          <Field
            label="Brand / Product Line"
            value={form.brand}
            onChange={(value) => onUpdateField("brand", value)}
          />
          <Field
            label="Associated Company"
            value={form.associatedCompany}
            onChange={(value) => onUpdateField("associatedCompany", value)}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader
          number="04"
          title="Notes & Remarks"
          description="Optional internal context for this partner record."
        />
        <div className="p-4 sm:p-5">
          <Field
            label="Notes & Remarks"
            value={form.notes || ""}
            onChange={(value) => onUpdateField("notes", value)}
            multiline
            placeholder="Add notes or remarks"
          />
        </div>
      </section>
    </>
  );
}

function ContactRoleFields({
  title,
  name,
  email,
  phone,
  onUpdateField,
  fields,
}: {
  title: string;
  name: string;
  email: string;
  phone: string;
  onUpdateField: (field: keyof PartnerInput, value: string) => void;
  fields: [keyof PartnerInput, keyof PartnerInput, keyof PartnerInput];
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <h3 className="mb-3 text-sm font-bold text-[#145487]">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Name"
          value={name}
          onChange={(value) => onUpdateField(fields[0], value)}
        />
        <Field
          label="Email"
          value={email}
          type="email"
          onChange={(value) => onUpdateField(fields[1], value)}
        />
        <Field
          label="Phone"
          value={phone}
          type="tel"
          onChange={(value) => onUpdateField(fields[2], value)}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div className={multiline ? "sm:col-span-2" : ""}>
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="mt-1.5 min-h-28 w-full resize-y rounded-md border border-input p-2.5 text-sm"
        />
      ) : (
        <Input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="mt-1.5"
        />
      )}
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
        className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-blue-50 p-2 text-blue-700">{icon}</div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
function PartnerInfoTile({
  icon,
  label,
  value,
  tone,
  wide = false,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  tone: "blue" | "violet" | "emerald" | "amber" | "slate";
  wide?: boolean;
}) {
  const tones = {
    blue: "border-blue-100 bg-blue-50/70 text-blue-700",
    violet: "border-violet-100 bg-violet-50/70 text-violet-700",
    emerald: "border-emerald-100 bg-emerald-50/70 text-emerald-700",
    amber: "border-amber-100 bg-amber-50/70 text-amber-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return (
    <div
      className={`rounded-xl border p-3.5 ${tones[tone]} ${wide ? "sm:col-span-2 lg:col-span-4" : ""}`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        <span className="shrink-0">{icon}</span>
        <span>{label}</span>
      </div>
      <p className="mt-2 break-words text-sm font-semibold text-slate-900">
        {value || "Not provided"}
      </p>
    </div>
  );
}
function PartnerDetail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-slate-900">
        {value || "Not assigned"}
      </p>
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
        <Handshake className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">
        {hasSearch ? "No partners match your filters" : "No OEM partners yet"}
      </h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        {hasSearch
          ? "Try a different search or filter."
          : "Create your first partner record to start managing OEM relationships."}
      </p>
      {!hasSearch && (
        <Button className="mt-5 bg-[#0d4d85]" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New OEM Partner
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
