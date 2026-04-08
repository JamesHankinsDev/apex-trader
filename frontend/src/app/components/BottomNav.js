import styles from "../page.module.css";

const TABS = [
  { key: "dashboard", label: "Home" },
  { key: "signals", label: "Signals" },
  { key: "trades", label: "Trades" },
  { key: "settings", label: "Settings" },
];

export default function BottomNav({ activeSection, setActiveSection, activeBot, setActiveBot }) {
  return (
    <nav className={styles.bottomNav}>
      {/* Bot switcher row */}
      <div className={styles.bottomNavBotRow}>
        {[
          { key: "main", label: "Exp 1" },
          { key: "experiment", label: "Exp 2" },
          { key: "experiment2", label: "Exp 3" },
        ].map((b) => (
          <button
            key={b.key}
            className={`${styles.bottomNavBotBtn} ${activeBot === b.key ? styles.bottomNavBotActive : ""}`}
            onClick={() => setActiveBot(b.key)}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Section tabs */}
      <div className={styles.bottomNavTabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`${styles.bottomNavBtn} ${activeSection === t.key ? styles.bottomNavActive : ""}`}
            onClick={() => setActiveSection(t.key)}
          >
            <span className={styles.bottomNavLabel}>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
