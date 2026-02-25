import styles from "./AnimatedBorder.module.css";

const TOP_TEXT = "McDrive Index™";
const SIDE_TEXT = "i’m drivin’ it™";

function Repeater({ text, count = 10 }: { text: string; count?: number }) {
  const items = Array.from({ length: count });
  return (
    <>
      {items.map((_, i) => (
        <span key={i} className={styles.item}>
          {text}
          <span className={styles.dot} aria-hidden="true">•</span>
        </span>
      ))}
    </>
  );
}

export default function AnimatedBorder() {
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={`${styles.strip} ${styles.top}`}>
        <div className={`${styles.track} ${styles.trackX} ${styles.toRight}`}>
          <div className={styles.group}>
            <Repeater text={TOP_TEXT} count={12} />
          </div>
          <div className={styles.group} aria-hidden="true">
            <Repeater text={TOP_TEXT} count={12} />
          </div>
        </div>
      </div>

      <div className={`${styles.strip} ${styles.right}`}>
        <div className={`${styles.sideTrack} ${styles.rotateRight}`}>
          <div className={`${styles.track} ${styles.trackX} ${styles.toRight} ${styles.sideAnim}`}>
            <div className={styles.group}>
              <Repeater text={SIDE_TEXT} count={60} />
            </div>
            <div className={styles.group} aria-hidden="true">
              <Repeater text={SIDE_TEXT} count={60} />
            </div>
          </div>
        </div>
      </div>

      <div className={`${styles.strip} ${styles.bottom}`}>
        <div className={`${styles.track} ${styles.trackX} ${styles.toLeft}`}>
          <div className={styles.group}>
            <Repeater text={TOP_TEXT} count={12} />
          </div>
          <div className={styles.group} aria-hidden="true">
            <Repeater text={TOP_TEXT} count={12} />
          </div>
        </div>
      </div>

      <div className={`${styles.strip} ${styles.left}`}>
        <div className={`${styles.sideTrack} ${styles.rotateLeft}`}>
          <div className={`${styles.track} ${styles.trackX} ${styles.toRight} ${styles.sideAnim}`}>
            <div className={styles.group}>
              <Repeater text={SIDE_TEXT} count={60} />
            </div>
            <div className={styles.group} aria-hidden="true">
              <Repeater text={SIDE_TEXT} count={60} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
