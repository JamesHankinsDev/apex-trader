import styles from "../page.module.css";
import { fmtTime } from "./helpers";

export default function EventLog({ events }) {
  return (
    <>
      <div className={styles.panelTitle}>{"\u25B2"} EVENT LOG</div>
      <div className={styles.eventLog}>
        {(events || []).map((e, i) => (
          <div
            key={i}
            className={`${styles.event} ${styles["event_" + e.type]}`}
            style={{ animation: "slideIn 0.3s ease" }}
          >
            <span className={styles.eventTime}>{fmtTime(e.time)}</span>
            <span>{e.message}</span>
          </div>
        ))}
        {(!events || events.length === 0) && (
          <div className={styles.empty}>Waiting for events...</div>
        )}
      </div>
    </>
  );
}
