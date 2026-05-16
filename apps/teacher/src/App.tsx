import { TRUTH_PROTECTED_FIELDS } from "@simwar/shared-contracts";

const workflow = [
  { label: "课程", value: "1 draft" },
  { label: "队伍", value: "0 active" },
  { label: "回合", value: "not started" },
  { label: "结算", value: "guarded" }
];

export function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Teacher Console</p>
          <h1>SimWar 教师端基线</h1>
        </div>
        <span className="status">Phase 0</span>
      </header>

      <section className="grid" aria-label="教学运行概览">
        {workflow.map((item) => (
          <article className="metric" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="panel">
        <h2>真值保护字段</h2>
        <div className="chips">
          {TRUTH_PROTECTED_FIELDS.slice(0, 6).map((field) => (
            <span key={field}>{field}</span>
          ))}
        </div>
      </section>
    </main>
  );
}
