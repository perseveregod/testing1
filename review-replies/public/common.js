// Shared helpers for both pages.
window.RD = {
  // Which link or site this visit came from (set by the server; see lib/stats.js).
  get src() { return document.body?.dataset.src || ""; },

  async api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || "GET",
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : {},
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong."), { status: res.status, data });
    return data;
  },

  // Turns a container into a 1-5 star picker. Returns { get(), set(n) }.
  starPicker(el, initial = 5) {
    let value = initial;
    el.classList.add("star-pick");
    el.setAttribute("role", "radiogroup");
    const buttons = [1, 2, 3, 4, 5].map((n) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "★";
      b.setAttribute("aria-label", `${n} star${n > 1 ? "s" : ""}`);
      b.onclick = () => set(n);
      el.append(b);
      return b;
    });
    function set(n) {
      value = n;
      buttons.forEach((b, i) => {
        b.classList.toggle("on", i < n);
        b.setAttribute("aria-checked", String(i + 1 === n));
      });
    }
    set(initial);
    return { get: () => value, set };
  },

  stars: (n) => "★".repeat(n) + "☆".repeat(5 - n),

  async copy(text, statusEl) {
    try {
      await navigator.clipboard.writeText(text);
      if (statusEl) statusEl.textContent = "Copied. Paste it into Google or Yelp.";
      return true;
    } catch {
      if (statusEl) statusEl.textContent = "Select the reply and copy it manually.";
      return false;
    }
  },
};
