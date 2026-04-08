import styles from "../page.module.css";

export default function TabBar({ activeTab, setActiveTab, regime }) {
  const drLabel = regime?.detailed?.label;
  const badge = regime ? (regime.current === "bear"
    ? ` \uD83D\uDD34 ${drLabel || "BEAR"}`
    : ` \uD83D\uDFE2 ${drLabel || "BULL"}`) : "";

  return (
    <div className={styles.tabBar}>
      <button className={activeTab === "main" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("main")}>
        Experiment 1 (Momentum){badge}
      </button>
      <button className={activeTab === "experiment" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("experiment")}>
        Experiment 2 (Scalping){badge}
      </button>
      <button className={activeTab === "experiment2" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("experiment2")}>
        Experiment 3 (Breakout){badge}
      </button>
    </div>
  );
}
