import Link from "next/link";
import Image from "next/image";
import styles from "./Brand.module.css";

export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`brand ${styles.link}`} href="/" aria-label="Magpie home">
      <Image
        className={`${styles.image} ${compact ? styles.compact : ""}`}
        src="/brand/magpie.png"
        alt="Magpie — Lost & Found"
        width={144}
        height={144}
        priority
      />
    </Link>
  );
}
