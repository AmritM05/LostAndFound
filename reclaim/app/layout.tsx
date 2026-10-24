import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Magpie — Campus Lost & Found", template: "%s · Magpie" },
  description:
    "A private, secure way to report and recover belongings on campus.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
