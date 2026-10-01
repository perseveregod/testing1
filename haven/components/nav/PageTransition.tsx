// Pages sit on an opaque surface above the always-mounted map. Tab switches
// are instant, like a native tab bar. Detail screens (`push`) slide in with a
// plain CSS animation: no View Transition snapshots, which cost ~200 ms of
// frozen UI per navigation on a phone.
export function PageTransition({ children, push }: { children: React.ReactNode; push?: boolean }) {
  return <div className={push ? "page-root page-push" : "page-root"}>{children}</div>;
}
