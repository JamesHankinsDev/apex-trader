"use client";
import { useState, useEffect } from "react";
import styles from "../page.module.css";
import { requestNotificationPermission, getNotificationPermission } from "./useTradeNotifications";

export default function NotificationToggle() {
  const [permission, setPermission] = useState("default");

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const handleClick = async () => {
    if (permission === "granted") return; // already enabled
    const result = await requestNotificationPermission();
    setPermission(result);
  };

  if (permission === "unsupported") return null;

  const label = permission === "granted" ? "\uD83D\uDD14" : "\uD83D\uDD15";
  const title = permission === "granted"
    ? "Notifications enabled"
    : permission === "denied"
      ? "Notifications blocked — enable in browser settings"
      : "Enable trade notifications";

  return (
    <button
      className={styles.guideBtn}
      onClick={handleClick}
      title={title}
      style={{
        fontSize: 16, padding: "4px 10px",
        opacity: permission === "denied" ? 0.4 : 1,
        cursor: permission === "denied" ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );
}
