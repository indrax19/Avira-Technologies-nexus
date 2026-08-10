import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { categoriesAPI, inventoryItemsAPI, inventoryTransactionsAPI, companyProfileAPI, CompanyProfile, subCategoriesAPI } from "@/integrations/firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, FileText } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addLogoToPDF } from "@/lib/pdfLogoHelper";

const formatCertificateDate = (dateString: string): string => {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "long" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

export default function Reports() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const { data: rawData } = useQuery({
    queryKey: ["report-data"],
    queryFn: async () => {
      const [items, transactions] = await Promise.all([
        inventoryItemsAPI.getAll(),
        inventoryTransactionsAPI.getAll(),
      ]);
      return { items, transactions };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: categories } = useQuery({
    queryKey: ["categories-list"],
    queryFn: categoriesAPI.getAll,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const { data: subCategories } = useQuery({
    queryKey: ["subcategories-list"],
    queryFn: subCategoriesAPI.getAll,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const { data: allProfiles } = useQuery({
    queryKey: ["company-profiles"],
    queryFn: async () => {
      const data = await companyProfileAPI.getAll();
      if (data && data.length > 0) {
        setProfiles(data);
        setSelectedProfileId(data[0].id || null);
      }
      return data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  const filtered = useMemo(() => {
    if (!rawData?.items) return [];

    const categoryMap = new Map(categories?.map((c) => [c.id, c]) || []);
    const subCategoryMap = new Map(subCategories?.map((sc) => [sc.id, sc]) || []);

    // Build transaction map properly
    const txMap = new Map<string, any[]>();
    rawData.transactions?.forEach((t) => {
      const existing = txMap.get(t.item_id) || [];
      txMap.set(t.item_id, [...existing, t]);
    });

    let result = rawData.items.map((item) => ({
      ...item,
      categories: categoryMap.get(item.category_id),
      sub_categories: item.subcategory_id ? subCategoryMap.get(item.subcategory_id) : null,
      inventory_transactions: txMap.get(item.id) || [],
    }));

    // Apply filters
    if (categoryFilter !== "all") {
      result = result.filter((i) => i.category_id === categoryFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((i) => i.status === (statusFilter as "in" | "out"));
    }
    if (supplierFilter !== "all") {
      result = result.filter((i) => i.supplier_name === supplierFilter);
    }

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter((i) => {
        const recipientName = i.inventory_transactions
          ?.filter((t: any) => t.type === "removal")
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.recipient_name || "";

        return (
          i.serial_number.toLowerCase().includes(searchLower) ||
          (recipientName.toLowerCase().includes(searchLower))
        );
      });
    }

    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [rawData, categories, subCategories, categoryFilter, statusFilter, supplierFilter, search]);

  const getRecipientName = (item: any) => {
    if (item.status !== "out" || !item.inventory_transactions?.length) return "—";

    const removal = item.inventory_transactions
      .filter((t: any) => t.type === "removal")
      .at(0); // Most recent is already sorted
    return removal?.recipient_name || "—";
  };

  const uniqueSuppliers = useMemo(() => {
    if (!rawData?.items) return [];
    const suppliers = new Set(rawData.items.map(i => i.supplier_name).filter(Boolean));
    return Array.from(suppliers).sort();
  }, [rawData]);

  const exportCSV = () => {
    if (!filtered?.length) return;
    const headers = ["Serial Number", "Category", "Sub Category", "Model", "Supplier", "Store", "Status", "Recipient", "Date"];
    const rows = filtered.map((i: any) => [
      i.serial_number,
      i.categories?.name || "",
      i.sub_categories?.name || "",
      i.sub_categories?.model_no || "",
      i.supplier_name || "",
      i.store_name || "",
      i.status === "in" ? "In Stock" : "Issued",
      getRecipientName(i),
      format(new Date(i.created_at), "yyyy-MM-dd HH:mm"),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c: string) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async (profileId?: string | null) => {
    if (!filtered?.length) return;

    // Fetch the specific profile if profileId is provided, otherwise get the first one
    let companyProfile: CompanyProfile | null = null;
    try {
      if (profileId) {
        companyProfile = await companyProfileAPI.getById(profileId);
      } else {
        companyProfile = await companyProfileAPI.get();
      }
    } catch (e) {
      console.error("Failed to fetch company profile:", e);
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    let yPosition = margin;

    // Header
    doc.setFontSize(16);
    doc.setFont(undefined, "bold");
    doc.text("INVENTORY REPORT", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 8;

    let topLeftY = yPosition, topRightY = yPosition;

    // Logo (left)
    if (companyProfile?.logo_url) {
      const logoHeight = await addLogoToPDF(doc, companyProfile.logo_url, margin, topLeftY, {
        maxWidth: 50,
        maxHeight: 30,
        maintainAspectRatio: true,
      });
      topLeftY += logoHeight + 2;
    }

    // Company info (right)
    if (companyProfile) {
      doc.setFontSize(9);
      doc.setFont(undefined, "bold");
      doc.text(companyProfile.company_name || "Company", pageWidth - margin, topRightY, { align: "right" });
      topRightY += 5;

      doc.setFontSize(7);
      doc.setFont(undefined, "normal");
      [companyProfile.phone && `Phone: ${companyProfile.phone}`, companyProfile.email && `Email: ${companyProfile.email}`, companyProfile.website && `Website: ${companyProfile.website}`]
        .filter(Boolean)
        .forEach((line) => {
          doc.text(line as string, pageWidth - margin, topRightY, { align: "right" });
          topRightY += 3;
        });
    }

    yPosition = Math.max(topLeftY, topRightY) + 3;
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    // Title & timestamp
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text("INVENTORY REPORT", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 6;

    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text(`Generated: ${formatCertificateDate(new Date().toISOString())} ${format(new Date(), "h:mm a")}`, margin, yPosition);
    yPosition += 8;

    // Table
    autoTable(doc, {
      startY: yPosition,
      head: [["Serial No.", "Category", "Sub Category", "Model", "Store", "Status", "Recipient", "Date"]],
      body: filtered.map((i: any) => [
        i.serial_number,
        i.categories?.name || "—",
        i.sub_categories?.name || "—",
        i.sub_categories?.model_no || "—",
        i.store_name || "—",
        i.status === "in" ? "In Stock" : "Issued",
        getRecipientName(i),
        formatCertificateDate(i.created_at),
      ]),
      margin,
      headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`inventory-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const handlePDFClick = () => {
    if (profiles.length === 0) {
      alert("Please create a company profile first in Settings");
      return;
    }
    setShowProfileDialog(true);
  };

  const handleConfirmDownload = async () => {
    setDownloadingPDF(true);
    try {
      await exportPDF(selectedProfileId);
      setShowProfileDialog(false);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("Failed to generate PDF");
    } finally {
      setDownloadingPDF(false);
    }
  };

  return (
    <>
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Company Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Choose which company profile to use for this inventory report PDF:
            </p>
            <div className="space-y-2">
              {profiles.map((profile) => (
                <Button
                  key={profile.id}
                  variant={selectedProfileId === profile.id ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setSelectedProfileId(profile.id || null)}
                >
                  <div className="flex items-center gap-3 w-full">
                    {profile.logo_url && (
                      <img
                        src={profile.logo_url}
                        alt={profile.company_name}
                        className="h-8 w-8 rounded object-contain bg-muted p-1"
                      />
                    )}
                    <div className="text-left">
                      <p className="font-medium text-sm">{profile.company_name}</p>
                      <p className="text-xs text-muted-foreground">{profile.email}</p>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => setShowProfileDialog(false)}
                disabled={downloadingPDF}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDownload}
                disabled={downloadingPDF}
              >
                {downloadingPDF ? "Generating..." : "Generate PDF"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reports</h1>
            <p className="text-muted-foreground">Filter and export inventory data</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCSV} className="gap-2">
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" onClick={handlePDFClick} className="gap-2">
              <FileText className="h-4 w-4" /> PDF
            </Button>
          </div>
        </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-48">
          <Label className="text-xs">Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="in">In Stock</SelectItem>
              <SelectItem value="out">Issued</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {uniqueSuppliers.length > 0 && (
          <div className="w-48">
            <Label className="text-xs">Supplier</Label>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {uniqueSuppliers.map((supplier) => (
                  <SelectItem key={supplier} value={supplier}>{supplier}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Search</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Serial or recipient..." />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {!rawData ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Sub Category</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.serial_number}</TableCell>
                    <TableCell>{item.categories?.name}</TableCell>
                    <TableCell>{item.sub_categories?.name || "—"}</TableCell>
                    <TableCell className="text-sm">{item.sub_categories?.model_no || "—"}</TableCell>
                    <TableCell className="text-sm">{item.supplier_name || "—"}</TableCell>
                    <TableCell className="text-sm">{item.store_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === "in" ? "default" : "destructive"}>
                        {item.status === "in" ? "In Stock" : "Issued"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{getRecipientName(item)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(item.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center text-muted-foreground">No items match your filters</div>
          )}
        </CardContent>
      </Card>
        {filtered && <p className="text-sm text-muted-foreground">{filtered.length} items</p>}
      </div>
    </>
  );
}
