/** Shown in the dashboard until the gallery database + functions are installed in Supabase. */
export function SetupNeeded() {
  return (
    <div className="gm-setup">
      <h3>The client gallery is installed in the code, but not switched on yet</h3>
      <p className="ad-muted" style={{ marginTop: 6 }}>The gallery tables and server functions still have to be added to Supabase. Follow <b>docs/gallery/TODO_FOR_MACAULEY.md</b> (one command), then reload this page.</p>
    </div>
  )
}
