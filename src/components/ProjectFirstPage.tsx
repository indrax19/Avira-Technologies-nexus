import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Building2, Loader2, MapPin, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PermissionDeniedDialog from "@/components/PermissionDeniedDialog";
import { useAuth } from "@/context/AuthContext";
import { workspaceProjectsAPI, type ParentProject, type WorkspaceProjectArea } from "@/integrations/firebase/parentProjectsAPI";
import MenuPage from "@/pages/MenuPage";
import { supabase } from "@/integrations/supabase/client";

interface ProjectFirstPageProps {
  title: string;
  description: string;
  basePath: string;
  projectArea: WorkspaceProjectArea;
}

export default function ProjectFirstPage({ title, description, basePath, projectArea }: ProjectFirstPageProps) {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { isAdmin } = useAuth();
  const [projects, setProjects] = useState<ParentProject[]>([]);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ParentProject | null>(null);
  const [projectPendingDelete, setProjectPendingDelete] = useState<ParentProject | null>(null);
  const [showPermissionDenied, setShowPermissionDenied] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [selectedIconFile, setSelectedIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);

  useEffect(() => workspaceProjectsAPI.subscribeAll(projectArea, setProjects, () => toast.error("Unable to load projects.")), [projectArea]);

  const saveProject = useMutation({
    mutationFn: async () => {
      const name = projectName.trim();
      if (!name) throw new Error("Project name is required");
      const projectDescriptionValue = projectDescription.trim();
      if (editingProject?.id) {
        const projectIconUrl = selectedIconFile
          ? await uploadProjectIcon(editingProject.id)
          : iconPreview || undefined;
        await workspaceProjectsAPI.update(projectArea, editingProject.id, {
          name,
          description: projectDescriptionValue || undefined,
          projectIconUrl,
        });
        return null;
      }
      const project = await workspaceProjectsAPI.create(projectArea, { name, description: projectDescriptionValue || undefined });
      if (selectedIconFile && project.id) {
        const projectIconUrl = await uploadProjectIcon(project.id);
        await workspaceProjectsAPI.update(projectArea, project.id, { projectIconUrl });
      }
      return project;
    },
    onSuccess: (project) => {
      const wasEditing = Boolean(editingProject);
      closeProjectDialog();
      toast.success(wasEditing ? "Project updated" : "Project created");
      if (project?.id) navigate(`${basePath}/${project.id}`);
    },
    onError: (error: Error) => toast.error(error.message || "Unable to save project"),
  });

  const deleteProject = useMutation({
    mutationFn: (id: string) => workspaceProjectsAPI.delete(projectArea, id),
    onSuccess: () => {
      toast.success("Project deleted");
      setProjectPendingDelete(null);
      if (projectId === projectPendingDelete?.id) navigate(basePath);
    },
    onError: (error: Error) => toast.error(error.message || "Unable to delete project"),
  });

  function openCreateProject() {
    setEditingProject(null);
    setProjectName("");
    setProjectDescription("");
    setSelectedIconFile(null);
    setIconPreview("");
    setProjectDialogOpen(true);
  }

  function openEditProject(project: ParentProject) {
    setEditingProject(project);
    setProjectName(project.name);
    setProjectDescription(project.description || "");
    setIconPreview(project.projectIconUrl || "");
    setSelectedIconFile(null);
    setProjectDialogOpen(true);
  }

  function closeProjectDialog() {
    setProjectDialogOpen(false);
    setEditingProject(null);
    setProjectName("");
    setProjectDescription("");
    setSelectedIconFile(null);
    setIconPreview("");
  }

  function handleIconUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file for the project icon.");
      return;
    }
    setSelectedIconFile(file);
    const reader = new FileReader();
    reader.onload = () => setIconPreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function uploadProjectIcon(projectId: string) {
    if (!selectedIconFile) return null;
    setUploadingIcon(true);
    try {
      const safeName = selectedIconFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `workspace-projects/${projectArea}/${projectId}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from("company-logos").upload(path, selectedIconFile, { upsert: true });
      if (error) throw error;
      return supabase.storage.from("company-logos").getPublicUrl(path).data.publicUrl;
    } finally {
      setUploadingIcon(false);
    }
  }

  function requestDeleteProject(project: ParentProject) {
    if (!isAdmin) {
      setShowPermissionDenied(true);
      return;
    }
    setProjectPendingDelete(project);
  }

  if (projectId) {
    const activeProject = projects.find((project) => project.id === projectId);
    return (
      <MenuPage
        title={title}
        description={description}
        projectName={activeProject?.name}
        backPath={basePath}
      />
    );
  }

  return (
    <main className="min-h-full w-full bg-[#f4f8fc] text-slate-800">
      <div className="w-full space-y-6">
        <section className="rounded-2xl bg-gradient-to-r from-[#092f5b] via-[#0d477f] to-[#092f5b] px-5 py-6 text-white shadow-md sm:px-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Project workspace</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{title} projects</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Choose a project to manage {description.toLowerCase().replace(/\.$/, "")}, or create a new project.</p>
        </section>

        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Select a project</h2>
            <p className="mt-1 text-sm text-slate-500">Open a workspace or manage its details.</p>
          </div>
          <Button className="w-full sm:w-auto" onClick={openCreateProject}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create project
          </Button>
        </section>

        {projects.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={`${title} projects`}>
            {projects.map((project) => project.id && (
              <Card key={project.id} className="flex min-w-0 cursor-pointer flex-col overflow-hidden border-slate-200 transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md" onClick={() => navigate(`${basePath}/${project.id}`)}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                  <div className="min-w-0">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-base sm:text-lg">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-50 text-blue-600">
                        {project.projectIconUrl ? <img src={project.projectIconUrl} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5" aria-hidden="true" />}
                      </span>
                      <span className="truncate">{project.name}</span>
                    </CardTitle>
                    <CardDescription className="mt-1 truncate pl-12">{title}</CardDescription>
                  </div>
                  <div className="flex shrink-0 gap-1" onClick={(event) => event.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-100 hover:text-blue-700" onClick={() => openEditProject(project)} aria-label={`Edit ${project.name}`} title="Edit project">
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-100 hover:text-red-700" onClick={() => requestDeleteProject(project)} aria-label={`Delete ${project.name}`} title="Delete project">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>}
                  </div>
                </CardHeader>
                <CardContent className="border-t pt-3 text-sm font-medium text-slate-700">
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4" aria-hidden="true" />0 sites</div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-slate-300">
            <CardContent className="py-12 text-center">
              <Building2 className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
              <p className="mt-3 font-medium text-slate-700">No projects yet</p>
              <p className="mt-1 text-sm text-slate-500">Create a project to get started.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={projectDialogOpen} onOpenChange={(open) => !open && closeProjectDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProject ? "Edit project" : "Create project"}</DialogTitle>
            <DialogDescription>{editingProject ? "Update the project details." : `Create a project for ${title.toLowerCase()}.`}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event: FormEvent) => { event.preventDefault(); saveProject.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project name <span aria-hidden="true">*</span></Label>
              <Input id="project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Enter project name" autoFocus required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea id="project-description" value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} placeholder="Add a short description" rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-icon">Project icon <span className="font-normal text-muted-foreground">(optional)</span></Label>
              {iconPreview && <img src={iconPreview} alt="Project icon preview" className="h-14 w-14 rounded-lg object-cover" />}
              <label htmlFor="project-icon" className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-700">
                <Upload className="h-4 w-4" /> {iconPreview ? "Change icon" : "Upload icon"}
              </label>
              <input id="project-icon" type="file" accept="image/*" onChange={handleIconUpload} className="sr-only" disabled={uploadingIcon} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeProjectDialog}>Cancel</Button>
              <Button type="submit" disabled={saveProject.isPending || uploadingIcon}>{saveProject.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{editingProject ? "Save changes" : "Create project"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(projectPendingDelete)} onOpenChange={(open) => !open && setProjectPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>This permanently removes {projectPendingDelete?.name}. Data associated with this project may no longer be accessible.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectPendingDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => projectPendingDelete?.id && deleteProject.mutate(projectPendingDelete.id)} disabled={deleteProject.isPending}>{deleteProject.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Delete project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PermissionDeniedDialog open={showPermissionDenied} onOpenChange={setShowPermissionDenied} message="Only administrators can delete project records." />
    </main>
  );
}
