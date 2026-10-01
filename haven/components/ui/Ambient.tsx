/** Soft drifting color behind every screen. Pure CSS; see `.ambient` in globals.css. */
export function Ambient() {
  return (
    <div className="ambient" aria-hidden>
      <span style={{ left: "-25vmax", top: "-20vmax", background: "#2f6bff" }} />
      <span style={{ right: "-30vmax", top: "10vh", background: "#7a4dff", animationDelay: "-9s", opacity: 0.38 }} />
      <span style={{ left: "-10vmax", bottom: "-35vmax", background: "#ff2d55", animationDelay: "-18s", opacity: 0.22 }} />
    </div>
  );
}
