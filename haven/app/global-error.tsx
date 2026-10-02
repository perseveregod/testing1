"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#0a0d13", color: "#eef1f7", fontFamily: "system-ui", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <p>Haven hit an unexpected error.</p>
          <button onClick={reset} style={{ marginTop: 12, minHeight: 44, padding: "0 16px", borderRadius: 12, border: 0, background: "#5ee0c8", color: "#062a24", fontWeight: 600 }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
