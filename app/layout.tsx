import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "E-Reconcile MN",
  description: "Organization-scoped reconciliation workspace for finance teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
