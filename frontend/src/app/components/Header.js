import styles from "../page.module.css";
import NotificationToggle from "./NotificationToggle";

export default function Header({ running, mode, setMode, clock, onShowGuide, onShowDrawer, onShowExpectations, onShowHistory }) {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        APEX<span>TRADER</span>
      </div>
      <div className={styles.headerRight}>
        <div className={styles.pill}>
          <div className={`${styles.dot} ${running ? styles.dotGreen : styles.dotRed}`} />
          <span>{running ? "RUNNING" : "OFFLINE"}</span>
        </div>
        <div className={styles.pill}>
          <span style={{ color: "var(--dim)" }}>MODE:</span>&nbsp;
          <span style={{ color: mode === "live" ? "var(--red)" : "var(--dim)" }}>
            {mode.toUpperCase()}
          </span>
        </div>
        <div className={styles.modeToggle}>
          <button
            className={`${styles.modeBtn} ${mode === "paper" ? styles.modePaper : ""}`}
            onClick={() => !running && setMode("paper")}
          >
            PAPER
          </button>
          <button
            className={`${styles.modeBtn} ${mode === "live" ? styles.modeLive : ""}`}
            onClick={() => !running && setMode("live")}
          >
            LIVE
          </button>
        </div>
        <button className={styles.guideBtn} onClick={onShowHistory}>
          HISTORY
        </button>
        <button className={styles.guideBtn} onClick={onShowExpectations}>
          EXPECTATIONS
        </button>
        <button className={styles.guideBtn} onClick={onShowGuide}>
          ? GUIDE
        </button>
        <button className={styles.guideBtn} onClick={onShowDrawer}>
          {"\u2699"} SETTINGS
        </button>
        <NotificationToggle />
        <div className={styles.pill} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
          {clock}
        </div>
      </div>
    </header>
  );
}
