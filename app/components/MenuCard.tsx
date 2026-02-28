"use client";

import { useEffect, useState } from "react";
import styles from "./MenuCard.module.css";

type Meal = {
  label: string;
  onClick: () => void;
  onWarmup?: () => void;
};

type MenuCardProps = {
  date: string;
  minDate?: string;
  maxDate?: string;
  onDateChange: (v: string) => void;
  onOrder: () => void;
  onOrderWarmup?: () => void;
  meals: Meal[];
  infoLine?: string | null;
  busyLabel?: string | null;
};

export default function MenuCard({
  date,
  minDate,
  maxDate,
  onDateChange,
  onOrder,
  onOrderWarmup,
  meals,
  infoLine,
  busyLabel,
}: MenuCardProps) {
  const [isDateFocused, setIsDateFocused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateIsMobile = () => {
      setIsMobile(window.matchMedia("(max-width: 900px)").matches);
    };

    updateIsMobile();

    const onResize = () => updateIsMobile();
    window.addEventListener("resize", onResize);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      viewport?.removeEventListener("resize", onResize);
    };
  }, []);

  const showDateHint = isMobile && !date && !isDateFocused;

  return (
    <section className={styles.card} aria-label="McDrive menu">
      <div className={styles.head}>
        <p className={styles.menuLabel}>MENU</p>
        <div className={styles.barcode} aria-hidden="true" />
      </div>

      <div className={styles.rule} />

      <div className={styles.pickerBlock}>
        <p className={styles.pickLine}>
          <span className={styles.pickLight}>PICK YOUR</span>
          <span className={styles.pickStrong}>McDATE™</span>
        </p>

        <div className={styles.inputRow}>
          <div className={styles.dateField}>
            <input
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              onFocus={() => setIsDateFocused(true)}
              onBlur={() => setIsDateFocused(false)}
              onChange={(e) => onDateChange(e.target.value)}
              className={styles.dateInput}
            />
            {showDateHint ? (
              <>
                <span className={styles.datePlaceholder} aria-hidden="true">gg/mm/aaaa</span>
                <span className={styles.dateIcon} aria-hidden="true">📅</span>
              </>
            ) : null}
          </div>
          <span className={styles.spacer} aria-hidden="true" />
          <button
            onClick={onOrder}
            onMouseEnter={onOrderWarmup}
            onFocus={onOrderWarmup}
            onTouchStart={onOrderWarmup}
            className={styles.orderButton}
          >
            ORDER
          </button>
        </div>

        {busyLabel ? <p className={styles.busyLine}>{busyLabel}</p> : null}
        {infoLine ? <p className={styles.infoLine}>{infoLine}</p> : null}
      </div>

      <div className={styles.rule} />

      <div className={styles.mealsBlock}>
        <p className={styles.mealsTitle}>SIGNATURE MEALS</p>
        <div className={styles.mealsList}>
          {meals.map((meal) => (
            <button
              key={meal.label}
              onClick={meal.onClick}
              onMouseEnter={meal.onWarmup}
              onFocus={meal.onWarmup}
              onTouchStart={meal.onWarmup}
              className={styles.mealButton}
            >
              <span className={styles.strip} aria-hidden="true" />
              <span className={styles.mealText}>{meal.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
