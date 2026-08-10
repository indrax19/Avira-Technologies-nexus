export interface PortalCompany {
  id: string;
  name: string;
  description: string;
  areas: string[];
  accent: string;
  softAccent: string;
}

export const portalCompanies: PortalCompany[] = [
  {
    id: "avira-technologies",
    name: "Avira Technologies",
    description: "Technology services and project delivery",
    areas: ["IT Solutions", "Hardware", "Networking", "Surveillance", "Projects"],
    accent: "#273C70",
    softAccent: "#e8eefc",
  },
  {
    id: "innovax-consulting",
    name: "Innovax Consulting",
    description: "Software, hosting, and subscription services",
    areas: ["Software / SLA", "Domains / Hosting", "Renewals", "Subscriptions"],
    accent: "#0f766e",
    softAccent: "#e4f7f4",
  },
  {
    id: "mh-arfah",
    name: "MH Arfah",
    description: "IT, procurement, projects, and trading",
    areas: ["IT / Projects", "Procurement", "Trading"],
    accent: "#9a3412",
    softAccent: "#fff0e8",
  },
];
