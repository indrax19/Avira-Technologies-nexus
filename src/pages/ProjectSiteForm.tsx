import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { projectTrackingAPI, type ProjectTracking } from "@/integrations/firebase/projectTrackingAPI";
import { parentProjectsAPI, type ParentProject } from "@/integrations/firebase/parentProjectsAPI";
import { realtimeProjectTrackingAPI, realtimeParentProjectsAPI } from "@/integrations/firebase/realtimeAPI";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Download, FileIcon, ImageIcon, Plus, Upload, X } from "lucide-react";
import { z } from "zod";

const siteSchema = z.object({
  millName: z.string().trim().min(1, "Mill name is required"),
  city: z.string().trim().min(1, "City is required"),
  district: z.string().trim().optional(),
  address: z.string().trim().optional(),
  state: z.string().trim().optional(),
  unitNo: z.string().trim().optional(),
  supplierName: z.string().trim().optional(),
  pocName: z.string().trim().optional(),
  pocPhone: z.string().trim().optional(),
  projectStatus: z.enum(["Not Yet Started", "In Progress", "Partially Completed", "Complete", "No PO Yet"]).optional(),
  logisticsStatus: z.enum(["Pending Dispatch", "Dispatched", "In Transit", "Arrived at Destination", "Delayed – Logistics"]).optional(),
  poNumber: z.string().trim().optional(),
  poStatus: z.enum(["Issued", "Pending", "Cancelled", "On Hold"]).optional(),
  poDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  supervisorName: z.string().trim().optional(),
  technicianNames: z.array(z.string().trim()),
  teamStatus: z.enum([
    "Scheduled",
    "Mobilized",
    "Travelling",
    "Onsite – Work In Progress",
    "Completed",
    "Returned to Base",
    "Standby / Idle",
  ]).optional(),
  hardwareDeliveryStatus: z.enum(["Pending Dispatch", "Dispatched", "In Transit", "Arrived at Destination", "Delayed – Logistics"]).optional(),
  remarks: z.string().trim().optional(),
});

const PROJECT_STATUS_OPTIONS = ["Not Yet Started", "In Progress", "Partially Completed", "Complete", "No PO Yet"];
const LOGISTICS_STATUS_OPTIONS = ["Pending Dispatch", "Dispatched", "In Transit", "Arrived at Destination", "Delayed – Logistics"];
const PO_STATUS_OPTIONS = ["Issued", "Pending", "Cancelled", "On Hold"];
const TEAM_STATUS_OPTIONS = [
  "Scheduled",
  "Mobilized",
  "Travelling",
  "Onsite – Work In Progress",
  "Completed",
  "Returned to Base",
  "Standby / Idle",
];
const HARDWARE_DELIVERY_STATUS_OPTIONS = ["Pending Dispatch", "Dispatched", "In Transit", "Arrived at Destination", "Delayed – Logistics"];

export default function ProjectSiteForm() {
  const { siteId, projectId } = useParams<{ siteId?: string; projectId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!siteId;
  const { appUser } = useAuth();

  // Form state
  const [millName, setMillName] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [state, setState] = useState("");
  const [unitNo, setUnitNo] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [pocName, setPocName] = useState("");
  const [pocPhone, setPocPhone] = useState("");
  const [projectStatus, setProjectStatus] = useState<string>("Not Yet Started");
  const [logisticsStatus, setLogisticsStatus] = useState<string>("Pending Dispatch");
  const [poNumber, setPoNumber] = useState("");
  const [poStatus, setPoStatus] = useState<string>("Pending");
  const [poDate, setPoDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectDurationDays, setProjectDurationDays] = useState(0);
  const [supervisorName, setSupervisorName] = useState("");
  const [technicianInput, setTechnicianInput] = useState("");
  const [technicianNames, setTechnicianNames] = useState<string[]>([]);
  const [teamStatus, setTeamStatus] = useState<string>("Scheduled");
  const [hardwareDeliveryStatus, setHardwareDeliveryStatus] = useState<string>("Pending Dispatch");
  const [remarks, setRemarks] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<File | null>(null);
  const [siteDocumentUrl, setSiteDocumentUrl] = useState("");
  const [siteDocumentName, setSiteDocumentName] = useState("");
  const [siteDocumentType, setSiteDocumentType] = useState("");
  const [documentPreview, setDocumentPreview] = useState("");

  // Real-time subscriptions
  const [site, setSite] = useState<ProjectTracking | null>(null);
  const [project, setProject] = useState<ParentProject | null>(null);

  const siteUnsubRef = useRef<(() => void) | null>(null);
  const projectUnsubRef = useRef<(() => void) | null>(null);

  // Fetch existing site if editing with real-time updates
  useEffect(() => {
    if (!siteId) {
      setSite(null);
      return;
    }

    siteUnsubRef.current = realtimeProjectTrackingAPI.subscribeById(siteId, (s) => {
      setSite(s);
    });

    return () => {
      if (siteUnsubRef.current) siteUnsubRef.current();
    };
  }, [siteId]);

  // Fetch project info with real-time updates
  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }

    projectUnsubRef.current = realtimeParentProjectsAPI.subscribeById(projectId, (p) => {
      setProject(p);
    });

    return () => {
      if (projectUnsubRef.current) projectUnsubRef.current();
    };
  }, [projectId]);

  // Initialize form with site data
  useEffect(() => {
    if (site) {
      setMillName(site.millName || "");
      setCity(site.city || "");
      setDistrict(site.district || "");
      setAddress(site.address || "");
      setState(site.state || "");
      setUnitNo(site.unitNo || "");
      setSupplierName(site.supplierName || "");
      setPocName(site.pocName || "");
      setPocPhone(site.pocPhone || "");
      setProjectStatus(site.projectStatus || "Not Yet Started");
      setLogisticsStatus(site.logisticsStatus || "Pending Dispatch");
      setPoNumber(site.poNumber || "");
      setPoStatus(site.poStatus || "Pending");
      setPoDate(site.poDate || "");
      setStartDate(site.startDate || "");
      setEndDate(site.endDate || "");
      setProjectDurationDays(site.projectDurationDays || 0);
      setSupervisorName(site.supervisorName || "");
      setTechnicianNames(site.technicianNames || []);
      setTeamStatus(site.teamStatus || "Scheduled");
      setHardwareDeliveryStatus(site.hardwareDeliveryStatus || "Pending Dispatch");
      setRemarks(site.remarks || "");
      setSelectedDocument(null);
      setSiteDocumentUrl(site.siteDocumentUrl || "");
      setSiteDocumentName(site.siteDocumentName || "");
      setSiteDocumentType(site.siteDocumentType || "");
      setDocumentPreview(site.siteDocumentType?.startsWith("image/") ? site.siteDocumentUrl || "" : "");
    }
  }, [site]);

  // Auto-calculate project duration
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      setProjectDurationDays(Math.max(0, days));
    }
  }, [startDate, endDate]);

  const addTechnician = () => {
    if (technicianInput.trim()) {
      setTechnicianNames([...technicianNames, technicianInput.trim()]);
      setTechnicianInput("");
    }
  };

  const removeTechnician = (index: number) => {
    setTechnicianNames(technicianNames.filter((_, i) => i !== index));
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setSelectedDocument(file);
    setSiteDocumentUrl("");
    setSiteDocumentName(file.name);
    setSiteDocumentType(file.type);

    const reader = new FileReader();
    reader.onload = (event) => {
      setDocumentPreview((event.target?.result as string) || "");
    };
    reader.readAsDataURL(file);

    toast.success("Document selected. It will be uploaded when you save the site.");
  };

  const handleRemoveDocument = () => {
    setSelectedDocument(null);
    setSiteDocumentUrl("");
    setSiteDocumentName("");
    setSiteDocumentType("");
    setDocumentPreview("");
    toast.success("Document removed");
  };

  const handleDownloadDocument = async () => {
    const urlToDownload = selectedDocument ? documentPreview : siteDocumentUrl;
    if (!urlToDownload) {
      toast.error("No document to download");
      return;
    }

    const sourceName = selectedDocument?.name || siteDocumentName || "Purchase_Order";
    const extensionMatch = sourceName.match(/\.[^.]+$/);
    const extension = extensionMatch?.[0] || "";
    const safeMillName = (millName.trim() || "Mill Name").replace(/[\\/:*?"<>|]+/g, "-");
    const fileName = `${safeMillName} - Purchase Order${extension}`;

    try {
      const response = await fetch(urlToDownload);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("Document downloaded");
    } catch {
      window.open(urlToDownload, "_blank");
      toast.success("Document opened in new tab");
    }
  };

  const uploadSiteDocument = async () => {
    if (!selectedDocument) {
      return {
        url: siteDocumentUrl || null,
        name: siteDocumentName || null,
        type: siteDocumentType || null,
      };
    }

    const safeFileName = selectedDocument.name.replace(/\s+/g, "_");
    const filePath = `project_sites/${projectId || site?.project_id || "general"}/${Date.now()}_${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("company-logos")
      .upload(filePath, selectedDocument);

    if (uploadError) {
      throw new Error(uploadError.message || "Failed to upload document");
    }

    const { data: urlData } = supabase.storage
      .from("company-logos")
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      name: selectedDocument.name,
      type: selectedDocument.type || "application/octet-stream",
    };
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = siteSchema.parse({
        millName,
        city,
        district,
        address: address || undefined,
        state: state || undefined,
        unitNo: unitNo || undefined,
        supplierName: supplierName || undefined,
        pocName,
        pocPhone,
        projectStatus: projectStatus as any,
        logisticsStatus: logisticsStatus as any,
        poNumber: poNumber || undefined,
        poStatus: poStatus as any,
        poDate,
        startDate,
        endDate,
        supervisorName,
        technicianNames,
        teamStatus: teamStatus as any,
        hardwareDeliveryStatus: hardwareDeliveryStatus as any,
      });

      const uploadedDocument = await uploadSiteDocument();
      const documentFields = uploadedDocument.url
        ? {
            siteDocumentUrl: uploadedDocument.url,
            siteDocumentName: uploadedDocument.name,
            siteDocumentType: uploadedDocument.type,
          }
        : isEditing
          ? {
              siteDocumentUrl: null,
              siteDocumentName: null,
              siteDocumentType: null,
            }
          : {};

      if (isEditing && siteId) {
        await projectTrackingAPI.update(siteId, {
          ...parsed,
          ...documentFields,
          poNumber,
          remarks,
          updated_by: appUser?.id,
        } as any);
      } else {
        await projectTrackingAPI.create({
          project_id: projectId || "",
          ...parsed,
          ...documentFields,
          poNumber,
          remarks,
          created_by: appUser?.id,
          updated_by: appUser?.id,
        } as any);
      }
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["project-sites", projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ["all-sites"] });
      toast.success(isEditing ? "Site updated" : "Site created");
      navigate(`/projects/${projectId || site?.project_id}`);
    },
    onError: (err: any) => {
      if (err.issues) toast.error(err.issues[0].message);
      else toast.error(`Failed to save site: ${err.message || "Unknown error"}`);
    },
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/projects/${projectId || site?.project_id}`)}
          className="flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{isEditing ? "Edit Site" : "Add New Site"}</h1>
          {project && <p className="text-muted-foreground text-xs sm:text-sm truncate">Project: {project.name}</p>}
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4 sm:space-y-6">
        {/* Site Information Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Site Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="millName">Mill Name *</Label>
                <Input
                  id="millName"
                  value={millName}
                  onChange={(e) => setMillName(e.target.value)}
                  placeholder="e.g. Textile Mill A"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Faisalabad"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Input
                  id="district"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Faisalabad"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State (optional)</Label>
                <Input
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Punjab"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitNo">Unit No (optional)</Label>
                <Input
                  id="unitNo"
                  value={unitNo}
                  onChange={(e) => setUnitNo(e.target.value)}
                  placeholder="e.g. Unit A, Unit 1"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Address (optional)</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 123 Industrial Area, Main Road"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="supplierName">Supplier Name (optional)</Label>
                <Input
                  id="supplierName"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. ABC Suppliers"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Upload Purchase Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3">
            {(selectedDocument || siteDocumentUrl) ? (
              <div className="space-y-3">
                {(selectedDocument?.type || siteDocumentType).startsWith("image/") ? (
                  <div className="relative">
                    <img
                      src={selectedDocument ? documentPreview : siteDocumentUrl}
                      alt="Site document preview"
                      className="max-h-48 rounded border object-cover w-full"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4">
                    <FileIcon className="h-8 w-8 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{siteDocumentName || "Uploaded document"}</p>
                      <p className="text-xs text-muted-foreground">PDF or document file</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadDocument}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Purchase Order
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.getElementById("site-document-upload") as HTMLInputElement;
                      input?.click();
                    }}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Change Document
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveDocument}
                    className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => {
                  const input = document.getElementById("site-document-upload") as HTMLInputElement;
                  input?.click();
                }}
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 hover:bg-muted/50 transition"
              >
                <ImageIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground mb-1">Click to upload document/photo</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, PDF (Max 10MB)</p>
              </div>
            )}

            <input
              id="site-document-upload"
              type="file"
              accept="image/*,application/pdf"
              onChange={handleDocumentUpload}
              className="hidden"
            />
          </CardContent>
        </Card>

        {/* Point of Contact Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Point of Contact Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="pocName">POC Name</Label>
                <Input
                  id="pocName"
                  value={pocName}
                  onChange={(e) => setPocName(e.target.value)}
                  placeholder="e.g. ABC"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pocPhone">POC Phone</Label>
                <Input
                  id="pocPhone"
                  value={pocPhone}
                  onChange={(e) => setPocPhone(e.target.value)}
                  placeholder="e.g. +92 98765 43210"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Status Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Project Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="projectStatus">Project Status</Label>
                <Select value={projectStatus} onValueChange={setProjectStatus}>
                  <SelectTrigger id="projectStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="logisticsStatus">Logistics Status</Label>
                <Select value={logisticsStatus} onValueChange={setLogisticsStatus}>
                  <SelectTrigger id="logisticsStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOGISTICS_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Purchase Order Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Purchase Order (PO)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="poNumber">PO Number (optional)</Label>
                <Input
                  id="poNumber"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="e.g. PO-2024-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="poStatus">PO Status</Label>
                <Select value={poStatus} onValueChange={setPoStatus}>
                  <SelectTrigger id="poStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PO_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="poDate">PO Date</Label>
                <Input
                  id="poDate"
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Timeline Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Project Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Project Duration (days)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={projectDurationDays}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Auto-calculated</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Supervisor & Team Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Supervisor & Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supervisorName">Supervisor Name</Label>
              <Input
                id="supervisorName"
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                placeholder="e.g. Mr. ABC"
              />
            </div>

            <div className="space-y-2">
              <Label>Technician Names</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={technicianInput}
                  onChange={(e) => setTechnicianInput(e.target.value)}
                  placeholder="Enter technician name"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTechnician();
                    }
                  }}
                />
                <Button type="button" size="sm" onClick={addTechnician} className="gap-1">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              {technicianNames.length > 0 && (
                <div className="space-y-2">
                  {technicianNames.map((tech, index) => (
                    <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                      <span className="text-sm">{tech}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTechnician(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="teamStatus">Team Status</Label>
              <Select value={teamStatus} onValueChange={setTeamStatus}>
                <SelectTrigger id="teamStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Hardware Delivery Status Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Hardware Delivery Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hardwareDeliveryStatus">Hardware Delivery Status</Label>
              <Select value={hardwareDeliveryStatus} onValueChange={setHardwareDeliveryStatus}>
                <SelectTrigger id="hardwareDeliveryStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HARDWARE_DELIVERY_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Remarks Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Remarks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks (optional)</Label>
              <textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter any additional remarks or notes"
                className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex flex-col sm:flex-row gap-2 justify-start items-start sm:items-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/projects/${projectId || site?.project_id}`)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saveMutation.isPending} className="w-full sm:w-auto">
            {saveMutation.isPending ? "Saving..." : isEditing ? "Update Site" : "Create Site"}
          </Button>
        </div>
      </form>
    </div>
  );
}
