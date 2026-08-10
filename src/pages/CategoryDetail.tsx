import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  categoriesAPI,
  subCategoriesAPI,
  inventoryItemsAPI,
  inventoryTransactionsAPI,
  type SubCategory,
  type Category,
  type InventoryItem,
} from "@/integrations/firebase/firestore";
import { realtimeCategoriesAPI, realtimeSubCategoriesAPI, realtimeInventoryItemsAPI } from "@/integrations/firebase/realtimeAPI";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Plus, Package, Pencil, Trash2, ChevronDown, ChevronRight, FolderOpen, Layers } from "lucide-react";
import { format } from "date-fns";
import { z } from "zod";

const subCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  model_no: z.string().trim().max(100).optional(),
  supplier_name: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional(),
});

export default function CategoryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const [subCatDialogOpen, setSubCatDialogOpen] = useState(false);
  const [editSubCatId, setEditSubCatId] = useState<string | null>(null);
  const [subCatName, setSubCatName] = useState("");
  const [subCatModelNo, setSubCatModelNo] = useState("");
  const [subCatSupplierName, setSubCatSupplierName] = useState("");
  const [subCatDescription, setSubCatDescription] = useState("");
  const [expandedSubCategories, setExpandedSubCategories] = useState<Set<string>>(new Set());

  // Real-time subscriptions
  const [category, setCategory] = useState<Category | null>(null);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);

  const categoryUnsubRef = useRef<(() => void) | null>(null);
  const subCatUnsubRef = useRef<(() => void) | null>(null);
  const itemsUnsubRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  // Track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;

    // Subscribe to category
    categoryUnsubRef.current = realtimeCategoriesAPI.subscribeById(
      id,
      (cat) => {
        if (isMountedRef.current) {
          setCategory(cat);
        }
      },
      (error) => {
        if (isMountedRef.current) {
          console.error("Failed to load category:", error);
        }
      }
    );

    // Subscribe to sub-categories
    subCatUnsubRef.current = realtimeSubCategoriesAPI.subscribeByCategory(
      id,
      (subs) => {
        if (isMountedRef.current) {
          setSubCategories(subs);
        }
      },
      (error) => {
        if (isMountedRef.current) {
          console.error("Failed to load subcategories:", error);
        }
      }
    );

    // Subscribe to items
    itemsUnsubRef.current = realtimeInventoryItemsAPI.subscribeByCategory(
      id,
      (itms) => {
        if (isMountedRef.current) {
          setItems(itms);
        }
      },
      (error) => {
        if (isMountedRef.current) {
          console.error("Failed to load items:", error);
        }
      }
    );

    return () => {
      categoryUnsubRef.current?.();
      subCatUnsubRef.current?.();
      itemsUnsubRef.current?.();
    };
  }, [id]);

  const saveSubCatMutation = useMutation({
    mutationFn: async () => {
      const parsed = subCategorySchema.parse({
        name: subCatName,
        model_no: subCatModelNo || undefined,
        supplier_name: subCatSupplierName || undefined,
        description: subCatDescription || undefined,
      });
      if (editSubCatId) {
        await subCategoriesAPI.update(editSubCatId, parsed);
      } else {
        await subCategoriesAPI.create({
          name: parsed.name,
          category_id: id!,
          ...(parsed.model_no ? { model_no: parsed.model_no } : {}),
          ...(parsed.supplier_name ? { supplier_name: parsed.supplier_name } : {}),
          ...(parsed.description ? { description: parsed.description } : {}),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-subcategories", id] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(editSubCatId ? "Sub category updated" : "Sub category created");
      closeSubCatDialog();
    },
    onError: (err: any) => {
      if (err.issues) toast.error(err.issues[0].message);
      else toast.error(err.message || "Failed to save");
    },
  });

  const deleteSubCatMutation = useMutation({
    mutationFn: (subCatId: string) => subCategoriesAPI.delete(subCatId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-subcategories", id] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Sub category deleted");
    },
    onError: () => toast.error("Failed to delete sub category"),
  });

  const closeSubCatDialog = () => {
    setSubCatDialogOpen(false);
    setEditSubCatId(null);
    setSubCatName("");
    setSubCatModelNo("");
    setSubCatSupplierName("");
    setSubCatDescription("");
  };

  const openEditSubCat = (subCat: SubCategory) => {
    setEditSubCatId(subCat.id!);
    setSubCatName(subCat.name);
    setSubCatModelNo(subCat.model_no || "");
    setSubCatSupplierName(subCat.supplier_name || "");
    setSubCatDescription(subCat.description || "");
    setSubCatDialogOpen(true);
  };

  const toggleExpand = (subCatId: string) => {
    setExpandedSubCategories((prev) => {
      const next = new Set(prev);
      if (next.has(subCatId)) {
        next.delete(subCatId);
      } else {
        next.add(subCatId);
      }
      return next;
    });
  };

  const getSubCategoryItems = (subCatId: string) =>
    items?.filter((item) => item.subcategory_id === subCatId) || [];

  const getAvailableStock = (subCatId: string) => {
    return items?.filter((item) => item.subcategory_id === subCatId && item.status === "in").length || 0;
  };

  const handleDeleteSubCat = (subCatId: string) => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only administrators can delete sub categories");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this sub category?")) {
      return;
    }

    deleteSubCatMutation.mutate(subCatId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/categories")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{category?.name ?? "Category"}</h1>
          {category?.description && <p className="text-muted-foreground text-sm">{category.description}</p>}
        </div>
        <Button onClick={() => setSubCatDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Sub Category
        </Button>
      </div>

      {/* Items without Sub Category */}
      {items && items.length > 0 && items.some((i) => !i.subcategory_id) && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Items (No Sub Category)</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serial Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items
                .filter((i) => !i.subcategory_id)
                .map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">
                      {item.serial_number || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === "in" ? "default" : "destructive"}>
                        {item.status === "in" ? "In Stock" : "Issued"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{item.owner || "Avira"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.created_at ? format(new Date(item.created_at), "MMM d, yyyy") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Sub Categories List */}
      {subCategories && subCategories.length > 0 ? (
        <div className="space-y-3">
          {subCategories.map((subCat) => {
            const subCatItems = getSubCategoryItems(subCat.id!);
            const isExpanded = expandedSubCategories.has(subCat.id!);

            return (
              <Card key={subCat.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                      onClick={() => navigate(`/subcategories/${subCat.id}`)}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                        <Layers className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm">{subCat.name}</h3>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                          {subCat.model_no && <span>Model: {subCat.model_no}</span>}
                          {subCat.supplier_name && <span>Supplier: {subCat.supplier_name}</span>}
                        </div>
                        {subCat.description && (
                          <p className="text-xs text-muted-foreground mt-1">{subCat.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Badge variant="secondary">{subCatItems.length} items</Badge>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{getAvailableStock(subCat.id!)} available</Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50 hover:text-blue-700" onClick={() => openEditSubCat(subCat)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleDeleteSubCat(subCat.id!)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">No sub categories yet</p>
            <p className="text-muted-foreground text-xs mt-1">Add a sub category to start organizing items</p>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Sub Category Dialog */}
      <Dialog open={subCatDialogOpen} onOpenChange={(open) => !open && closeSubCatDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editSubCatId ? "Edit Sub Category" : "Add Sub Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subcat-name">Sub Category Name *</Label>
              <Input
                id="subcat-name"
                value={subCatName}
                onChange={(e) => setSubCatName(e.target.value)}
                placeholder="e.g. 2MP Bullet Camera"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcat-model">Model No (optional)</Label>
              <Input
                id="subcat-model"
                value={subCatModelNo}
                onChange={(e) => setSubCatModelNo(e.target.value)}
                placeholder="e.g. DS-2CD1023G0"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcat-desc">Description (optional)</Label>
              <Input
                id="subcat-desc"
                value={subCatDescription}
                onChange={(e) => setSubCatDescription(e.target.value)}
                placeholder="Brief description"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeSubCatDialog} disabled={saveSubCatMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => saveSubCatMutation.mutate()} disabled={saveSubCatMutation.isPending || !subCatName.trim()}>
              {saveSubCatMutation.isPending ? "Saving..." : editSubCatId ? "Update Sub Category" : "Create Sub Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
