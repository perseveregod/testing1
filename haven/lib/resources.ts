// Official places to go for things Haven doesn't do itself. Links point to the
// agencies' own sites; Haven doesn't copy or re-host their data.

export interface Resource {
  id: string;
  title: string;
  detail: string;
  href: string;
  /** Shown instead of the link host, e.g. a phone number. */
  label?: string;
}

export interface ResourceGroup {
  id: string;
  title: string;
  items: Resource[];
}

export const RESOURCE_AREA = "Houston & Harris County";

export const RESOURCES: ResourceGroup[] = [
  {
    id: "call",
    title: "Call for help",
    items: [
      {
        id: "hpd-nonemergency",
        title: "Houston Police non-emergency",
        detail: "For police help that isn't an emergency, inside Houston city limits",
        href: "tel:+17138843131",
        label: "(713) 884-3131",
      },
      {
        id: "houston-311",
        title: "Houston 311",
        detail: "Streetlights, potholes, flooding, other city services",
        href: "https://www.houstontx.gov/311/",
      },
    ],
  },
  {
    id: "scanner",
    title: "Police & fire scanner",
    items: [
      {
        id: "broadcastify-harris",
        title: "Harris County scanner feeds",
        detail: "Live public-safety radio from Broadcastify",
        href: "https://www.broadcastify.com/listen/ctid/2623",
      },
    ],
  },
  {
    id: "registry",
    title: "Sex offender registry",
    items: [
      {
        id: "nsopw",
        title: "National Sex Offender Public Website",
        detail: "U.S. Department of Justice search across all states",
        href: "https://www.nsopw.gov/",
      },
      {
        id: "tx-dps-registry",
        title: "Texas DPS registry",
        detail: "Texas Department of Public Safety public search",
        href: "https://www.dps.texas.gov/section/crime-records/texas-sex-offender-registration-program",
      },
    ],
  },
  {
    id: "missing",
    title: "Missing persons",
    items: [
      {
        id: "tx-dps-missing",
        title: "Texas missing persons bulletin",
        detail: "Texas DPS Missing Persons Clearinghouse",
        href: "https://www.dps.texas.gov/apps/mpch/",
      },
      {
        id: "ncmec",
        title: "Missing children (NCMEC)",
        detail: "National Center for Missing & Exploited Children",
        href: "https://www.missingkids.org/",
      },
      {
        id: "namus",
        title: "NamUs",
        detail: "National Missing and Unidentified Persons System",
        href: "https://namus.nij.ojp.gov/",
      },
    ],
  },
];
