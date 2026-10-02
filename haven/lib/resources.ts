// Official places to go for things Haven doesn't do itself. Links point to the
// agencies' own sites; Haven doesn't copy or re-host their data.

export interface Resource {
  id: string;
  title: string;
  titleEs: string;
  detail: string;
  detailEs: string;
  href: string;
  /** Shown instead of the link host, e.g. a phone number. */
  label?: string;
}

export interface ResourceGroup {
  id: string;
  title: string;
  titleEs: string;
  items: Resource[];
}

export const RESOURCE_AREA = "Houston & Harris County";

export const RESOURCES: ResourceGroup[] = [
  {
    id: "call",
    title: "Call for help",
    titleEs: "Pedir ayuda",
    items: [
      {
        id: "hpd-nonemergency",
        title: "Houston Police non-emergency",
        titleEs: "Policía de Houston, no emergencias",
        detail: "For police help that isn't an emergency, inside Houston city limits",
        detailEs: "Ayuda policial que no es emergencia, dentro de la ciudad de Houston",
        href: "tel:+17138843131",
        label: "(713) 884-3131",
      },
      {
        id: "houston-311",
        title: "Houston 311",
        titleEs: "Houston 311",
        detail: "Streetlights, potholes, flooding, other city services",
        detailEs: "Alumbrado, baches, inundaciones y otros servicios de la ciudad",
        href: "https://www.houstontx.gov/311/",
      },
    ],
  },
  {
    // HPD's dispatch talkgroups and HFD's dispatch channels are unencrypted on
    // the regional P25 system; these are volunteer-run live streams of them.
    id: "scanner",
    title: "Live police & fire radio",
    titleEs: "Radio de policía y bomberos en vivo",
    items: [
      {
        id: "broadcastify-hpd",
        title: "Houston Police, all districts",
        titleEs: "Policía de Houston, todas las divisiones",
        detail: "Dispatch radio for every HPD patrol division, live on Broadcastify",
        detailEs: "Radio de despacho de todas las divisiones de HPD, en vivo en Broadcastify",
        href: "https://www.broadcastify.com/listen/feed/32889",
      },
      {
        id: "broadcastify-hfd",
        title: "Houston Fire",
        titleEs: "Bomberos de Houston",
        detail: "HFD dispatch, live on Broadcastify",
        detailEs: "Despacho de HFD, en vivo en Broadcastify",
        href: "https://www.broadcastify.com/listen/feed/28416",
      },
      {
        id: "broadcastify-harris",
        title: "More Harris County feeds",
        titleEs: "Más canales del condado de Harris",
        detail: "Constables, sheriff and nearby cities",
        detailEs: "Constables, sheriff y ciudades cercanas",
        href: "https://www.broadcastify.com/listen/ctid/2623",
      },
    ],
  },
  {
    id: "registry",
    title: "Sex offender registry",
    titleEs: "Registro de delincuentes sexuales",
    items: [
      {
        id: "nsopw",
        title: "National Sex Offender Public Website",
        titleEs: "Sitio público nacional de delincuentes sexuales",
        detail: "U.S. Department of Justice search across all states",
        detailEs: "Búsqueda del Departamento de Justicia de EE. UU. en todos los estados",
        href: "https://www.nsopw.gov/",
      },
      {
        id: "tx-dps-registry",
        title: "Texas DPS registry",
        titleEs: "Registro del DPS de Texas",
        detail: "Texas Department of Public Safety public search",
        detailEs: "Búsqueda pública del Departamento de Seguridad Pública de Texas",
        href: "https://www.dps.texas.gov/section/crime-records/texas-sex-offender-registration-program",
      },
    ],
  },
  {
    id: "missing",
    title: "Missing persons",
    titleEs: "Personas desaparecidas",
    items: [
      {
        id: "tx-dps-missing",
        title: "Texas missing persons bulletin",
        titleEs: "Boletín de personas desaparecidas de Texas",
        detail: "Texas DPS Missing Persons Clearinghouse",
        detailEs: "Centro de personas desaparecidas del DPS de Texas",
        href: "https://www.dps.texas.gov/apps/mpch/",
      },
      {
        id: "ncmec",
        title: "Missing children (NCMEC)",
        titleEs: "Niños desaparecidos (NCMEC)",
        detail: "National Center for Missing & Exploited Children",
        detailEs: "Centro Nacional para Niños Desaparecidos y Explotados",
        href: "https://www.missingkids.org/",
      },
      {
        id: "namus",
        title: "NamUs",
        titleEs: "NamUs",
        detail: "National Missing and Unidentified Persons System",
        detailEs: "Sistema Nacional de Personas Desaparecidas y No Identificadas",
        href: "https://namus.nij.ojp.gov/",
      },
    ],
  },
];
