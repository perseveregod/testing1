// Minimal CSV parser (RFC 4180 quoting) for bulk review import.
// Expected columns, any order, header row required: rating, reviewer, review.

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim()));
}

const HEADERS = {
  rating: ["rating", "stars", "star rating", "score"],
  reviewer: ["reviewer", "name", "author", "customer"],
  body: ["review", "text", "comment", "body", "review text"],
};

function reviewsFromCsv(text) {
  const rows = parseCsv(String(text ?? ""));
  if (rows.length < 2) return { error: "Add a header row (rating, reviewer, review) and at least one review." };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [k, names] of Object.entries(HEADERS)) col[k] = header.findIndex((h) => names.includes(h));
  if (col.rating < 0 || col.body < 0) return { error: "The CSV needs a 'rating' column and a 'review' column." };
  const reviews = rows.slice(1).map((r) => ({
    rating: parseInt(String(r[col.rating] ?? "").trim(), 10),
    reviewer: col.reviewer >= 0 ? r[col.reviewer] ?? "" : "",
    body: r[col.body] ?? "",
  }));
  return { reviews };
}

module.exports = { parseCsv, reviewsFromCsv };
