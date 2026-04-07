"use client";
import { useState } from "react";
import styles from "../page.module.css";

export default function CollapsibleSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={styles.collapsible}>
      <button className={styles.collapsibleHeader} onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className={styles.collapsibleChevron} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          {"\u25BC"}
        </span>
      </button>
      {open && <div className={styles.collapsibleBody}>{children}</div>}
    </div>
  );
}
