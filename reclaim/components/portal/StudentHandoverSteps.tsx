import Link from "next/link";
import { PrivacyNote } from "./ui";
import styles from "./StudentExperience.module.css";

// MAG-003's approved-zone read contract is pending. Never infer intake from buildings.
export default function StudentDropoffGuidance() {
  return <section className={`panel ${styles.guidance}`} aria-labelledby="student-dropoff-title">
    <span className="eyebrow">FOUND SOMETHING?</span>
    <h2 id="student-dropoff-title">Hand it to authorized campus staff</h2>
    <p>Students report lost items in Magpie. Only authorized staff can receive and register found items.</p>
    <ol>
      <li>Keep the item secure. Do not post photographs or identifying details publicly.</li>
      <li>Confirm an approved intake desk and its opening hours with campus staff before travelling.</li>
      <li>Hand the item directly to staff. A building marker on this map does not mean the building accepts found items.</li>
    </ol>
    <div className="alert info" role="note">
      The approved drop-off directory is not connected to the student portal yet. Staff may have configured desks, but this page cannot verify their locations or availability.
    </div>
    <Link className="button secondary" href="/student/report/">Lost your own item? Make a lost report</Link>
    <PrivacyNote>Physical handover belongs with authorized staff. Do not leave an item at an unconfirmed desk or share private ownership evidence publicly.</PrivacyNote>
  </section>;
}
