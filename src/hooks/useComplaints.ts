import { useEffect, useRef, useState } from "react";
import { complaintsAPI, type Complaint } from "@/integrations/firebase/complaintsAPI";
import { technicalProjectsAPI, type TechnicalProject } from "@/integrations/firebase/technicalProjectsAPI";
import { siteDetailsAPI, type SiteDetails } from "@/integrations/firebase/siteDetailsAPI";

export interface ComplaintWithDetails extends Complaint {
  projectName?: string;
  siteName?: string;
}

export function useAllComplaints() {
  const [complaints, setComplaints] = useState<ComplaintWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);
  const cacheRef = useRef<{ projects: Map<string, TechnicalProject>; sites: Map<string, SiteDetails> }>({
    projects: new Map(),
    sites: new Map(),
  });

  useEffect(() => {
    setIsLoading(true);

    unsubRef.current = complaintsAPI.subscribeAll(
      async (complaintsData) => {
        const enrichedComplaints = await Promise.all(
          complaintsData.map(async (complaint) => {
            let projectName = complaint.projectId;
            let siteName = complaint.siteId;

            // Try cache first
            if (cacheRef.current.projects.has(complaint.projectId)) {
              projectName = cacheRef.current.projects.get(complaint.projectId)?.name || complaint.projectId;
            } else {
              try {
                const project = await technicalProjectsAPI.getById(complaint.projectId);
                if (project) {
                  cacheRef.current.projects.set(complaint.projectId, project);
                  projectName = project.name;
                }
              } catch (error) {
                console.error("Failed to fetch project:", error);
              }
            }

            // Try cache first
            if (cacheRef.current.sites.has(complaint.siteId)) {
              siteName = cacheRef.current.sites.get(complaint.siteId)?.millName || complaint.siteId;
            } else {
              try {
                const site = await siteDetailsAPI.getById(complaint.siteId);
                if (site) {
                  cacheRef.current.sites.set(complaint.siteId, site);
                  siteName = site.millName || complaint.siteId;
                }
              } catch (error) {
                console.error("Failed to fetch site:", error);
              }
            }

            return {
              ...complaint,
              projectName,
              siteName,
            };
          })
        );

        setComplaints(enrichedComplaints);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error loading complaints:", error);
        setIsLoading(false);
      }
    );

    return () => {
      unsubRef.current?.();
    };
  }, []);

  return { complaints, isLoading };
}
