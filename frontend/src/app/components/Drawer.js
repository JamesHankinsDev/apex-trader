"use client";
import styles from "../page.module.css";

export default function Drawer({ open, onClose, title, children }) {
  if (!open) return null;

  return (
    <>
      <div className={styles.drawerBackdrop} onClick={onClose} />
      <div className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <span>{title}</span>
          <button className={styles.drawerClose} onClick={onClose}>{"\u2715"}</button>
        </div>
        <div className={styles.drawerBody}>
          {children}
        </div>
      </div>
    </>
  );
}
