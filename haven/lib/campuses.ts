// Houston campuses for the student safety hub. Phone numbers and escort
// details come from each school's police/public-safety page (checked
// Oct 2026); coordinates are the main campus. Add a school by adding a row.

export interface Campus {
  id: string;
  name: string;
  school: string;
  lat: number;
  lng: number;
  police: {
    name: string;
    emergency: string;
    nonEmergency: string;
    url: string;
  };
  /** How to get a safety escort, when the school offers one. */
  escort: { phone: string; note: string } | null;
}

const HCC_POLICE = {
  name: "HCC Police",
  emergency: "713-718-8888",
  nonEmergency: "713-718-8770",
  url: "https://www.hccs.edu/departments/police/",
};

const hcc = (id: string, campus: string, lat: number, lng: number): Campus => ({
  id: `hcc-${id}`,
  name: `HCC ${campus}`,
  school: "Houston City College",
  lat,
  lng,
  police: HCC_POLICE,
  // HCC's police pages don't list an escort service, so none is promised here.
  escort: null,
});

export const CAMPUSES: Campus[] = [
  hcc("central", "Central", 29.7369, -95.376),
  hcc("northline", "Northline", 29.8331, -95.3777),
  hcc("southeast", "Southeast", 29.7048, -95.2953),
  hcc("westloop", "West Loop", 29.7214, -95.4573),
  hcc("springbranch", "Spring Branch", 29.7879, -95.561),
  {
    id: "uh",
    name: "University of Houston",
    school: "University of Houston",
    lat: 29.7208,
    lng: -95.3441,
    police: { name: "UH Police", emergency: "911", nonEmergency: "713-743-3333", url: "https://www.uh.edu/police/contact/" },
    escort: { phone: "713-743-3333", note: "UHPD security escorts, based on officer availability." },
  },
  {
    id: "tsu",
    name: "Texas Southern University",
    school: "Texas Southern University",
    lat: 29.7209,
    lng: -95.3596,
    police: { name: "TSU Police", emergency: "713-313-7011", nonEmergency: "713-313-7001", url: "https://tsu.edu/safety-and-wellness/public-safety/index.php" },
    escort: { phone: "713-313-7001", note: "After-hours safety escort: call when you're ready to leave." },
  },
  {
    id: "rice",
    name: "Rice University",
    school: "Rice University",
    lat: 29.7168,
    lng: -95.4048,
    police: { name: "Rice University Police", emergency: "713-348-6000", nonEmergency: "713-348-6000", url: "https://rupd.rice.edu/" },
    escort: null,
  },
  {
    id: "uhd",
    name: "University of Houston-Downtown",
    school: "University of Houston-Downtown",
    lat: 29.7661,
    lng: -95.3596,
    police: { name: "UHD Police", emergency: "713-221-8911", nonEmergency: "713-221-8065", url: "https://www.uhd.edu/police-department/pd-contactus.aspx" },
    escort: { phone: "713-221-8065", note: "Call the non-emergency line to request an escort." },
  },
];

export function getCampus(id: string | null | undefined): Campus | null {
  return CAMPUSES.find((c) => c.id === id) ?? null;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
