import { describe, expect, it } from "vitest";
import {
  classifyHouston,
  displayAddress,
  geocodeQuery,
  houstonExternalId,
  houstonTimeToIso,
  parseHoustonTable,
  type HoustonRow,
} from "@/server/sources/houstonActive";
import { zonedLocalToIso } from "@/server/sources/time";

const row = (over: Partial<HoustonRow>): HoustonRow => ({
  agency: "FD",
  address: "ALLEN GENOA RD",
  cross: "EL BUEY RD",
  keyMap: "577J",
  callTime: "10/01/2026 03:37",
  type: "EMS EVENT",
  combined: false,
  ...over,
});

const PAGE = `
<table><tr><td>City of Houston Active Incidents</td></tr></table>
<table>
<tr><td colspan="7">The below table shows All active incidents</td></tr>
<tr><th>Agency</th><th>Address</th><th>Cross Street</th><th>Key Map</th><th>Call Time(Opened)</th><th>Incident Type</th><th>Combined Response</th></tr>
<tr><td>FD</td><td>ALLEN GENOA RD</td><td>BLK EL BUEY RD</td><td>577J</td><td>10/01/2026 03:37</td><td>EMS EVENT</td><td>N</td></tr>
<tr><td>PD</td><td>5999 SCOTT ST</td><td></td><td>533M</td><td>10/01/2026 01:47</td><td>TRAFFIC HAZARD/URGENT</td><td>N</td></tr>
<tr><td>PD</td><td>NUS59IB-NIH610 4005 N US 59 FWY</td><td>CAVALCADE EXIT RAMP</td><td>454S</td><td>09/30/2026 22:44</td><td>CRASH/MAJOR/FATALITY</td><td>Y</td></tr>
<tr><td>FD</td><td>W LITTLE YORK RD</td><td></td><td>412X</td><td>10/01/2026 03:37</td><td>EMS EVENT</td><td>N</td></tr>
</table>`;

describe("Houston active incidents", () => {
  it("parses the dispatch table and strips the BLK prefix", () => {
    const rows = parseHoustonTable(PAGE);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ agency: "FD", address: "ALLEN GENOA RD", cross: "EL BUEY RD", type: "EMS EVENT", combined: false });
    expect(rows[2]!.combined).toBe(true);
  });

  it("converts Houston wall-clock time to UTC (CDT = UTC-5)", () => {
    expect(houstonTimeToIso("10/01/2026 03:37")).toBe("2026-10-01T08:37:00.000Z");
    // Standard time in January: UTC-6.
    expect(zonedLocalToIso("2026-01-15T12:00:00", "America/Chicago")).toBe("2026-01-15T18:00:00.000Z");
  });

  it("geocodes intersections and house numbers, never a bare street", () => {
    expect(geocodeQuery(row({}))).toBe("ALLEN GENOA RD & EL BUEY RD, Houston, TX");
    expect(geocodeQuery(row({ agency: "PD", address: "5999 SCOTT ST", cross: "" }))).toBe("5999 SCOTT ST, Houston, TX");
    expect(geocodeQuery(row({ address: "NUS59IB-NIH610 4005 N US 59 FWY", cross: "CAVALCADE EXIT RAMP" }))).toBe("4005 N US 59 FWY, Houston, TX");
    expect(geocodeQuery(row({ address: "W LITTLE YORK RD", cross: "" }))).toBeNull();
  });

  it("shows block or intersection, never the house number", () => {
    expect(displayAddress(row({ agency: "PD", address: "5999 SCOTT ST", cross: "" }))).toBe("5900 block of Scott St");
    expect(displayAddress(row({}))).toBe("Allen Genoa Rd & El Buey Rd");
  });

  it("classifies dispatch types, skipping alarms and capping noise", () => {
    expect(classifyHouston("FD", "AUTOMATIC ALARM")).toBeNull();
    expect(classifyHouston("FD", "CHECK PATIENT*")).toBeNull();
    expect(classifyHouston("FD", "APARTMENT FIRE")).toMatchObject({ category: "fire", severity: "high" });
    expect(classifyHouston("PD", "CRASH/MAJOR/FATALITY")).toMatchObject({ category: "traffic_accident", severity: "critical" });
    expect(classifyHouston("PD", "CRASH/MAJOR/NON FATAL")).toMatchObject({ severity: "high" });
    expect(classifyHouston("PD", "CRASH/MINOR/FSGI")).toMatchObject({ severity: "low" });
    expect(classifyHouston("PD", "TRAFFIC HAZARD/URGENT")).toMatchObject({ category: "road_hazard" });
    expect(classifyHouston("FD", "EMS EVENT")).toMatchObject({ category: "medical", severity: "low" });
    expect(classifyHouston("PD", "SOMETHING NEW")).toMatchObject({ category: "police", severity: "low" });
  });

  it("gives each row a stable id", () => {
    expect(houstonExternalId(row({}))).toBe(houstonExternalId(row({})));
    expect(houstonExternalId(row({}))).not.toBe(houstonExternalId(row({ callTime: "10/01/2026 03:38" })));
  });
});
