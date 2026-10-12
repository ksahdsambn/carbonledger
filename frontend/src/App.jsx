// Application shell. Full page set (P1..P9 per PRD 9.1) is built from
// stage 6 onward; this skeleton carries the identity and light theme base.

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <span className="brand">CarbonLedger</span>
        <span className="tagline">Scope 3 carbon accounting and disclosure agent</span>
      </header>
      <main className="app-main">
        <section className="hero">
          <h1>CarbonLedger</h1>
          <p className="value-prop">
            CarbonLedger compresses the cost of producing a Scope 3 report from
            &quot;RMB 30,000 + 3 weeks&quot; to &quot;1 hour + near-zero marginal cost&quot;,
            while making every single number traceable back to its source document.
          </p>
          <p className="hint">The workspace is being initialized. Task creation will be available here.</p>
        </section>
      </main>
      <footer className="app-footer">
        Track: Sustainability &amp; Social Impact
      </footer>
    </div>
  );
}
