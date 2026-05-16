const decisionRows = [
  ["定价", "待提交"],
  ["营销预算", "待提交"],
  ["服务质量", "待提交"],
  ["现金缓冲", "待提交"]
];

export function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Student Cockpit</p>
          <h1>SimWar 学员端基线</h1>
        </div>
        <span className="badge">advisory only</span>
      </header>

      <section className="board" aria-label="决策草稿">
        {decisionRows.map(([name, status]) => (
          <article className="row" key={name}>
            <span>{name}</span>
            <strong>{status}</strong>
          </article>
        ))}
      </section>

      <section className="panel">
        <h2>回合状态</h2>
        <p>当前空工程只展示团队驾驶舱骨架；正式决策提交将在 Course/Team/Round API 就绪后接入。</p>
      </section>
    </main>
  );
}
