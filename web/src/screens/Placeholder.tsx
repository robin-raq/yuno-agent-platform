/** Temporary screen for routes not yet wired to the API (filled in over the next UI slices). */
export function Placeholder({ title }: { title: string }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>This screen is coming next. The backend it will use is already live.</p>
        </div>
      </div>
      <div className="card empty">Under construction — wiring to the API in the next slice.</div>
    </>
  );
}
