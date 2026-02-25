import styles from "./MenuCard.module.css";

type Meal = {
  label: string;
  onClick: () => void;
};

type MenuCardProps = {
  date: string;
  minDate?: string;
  maxDate?: string;
  onDateChange: (v: string) => void;
  onOrder: () => void;
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
  meals,
  infoLine,
  busyLabel,
}: MenuCardProps) {
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
          <input
            type="date"
            value={date}
            min={minDate}
            max={maxDate}
            onChange={(e) => onDateChange(e.target.value)}
            className={styles.dateInput}
          />
          <span className={styles.spacer} aria-hidden="true" />
          <button onClick={onOrder} className={styles.orderButton}>
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
            <button key={meal.label} onClick={meal.onClick} className={styles.mealButton}>
              <span className={styles.strip} aria-hidden="true" />
              <span className={styles.mealText}>{meal.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
