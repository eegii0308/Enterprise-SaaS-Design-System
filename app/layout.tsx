import type { Metadata } from "next";
import { defaultLocale, t } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: t("app.name"),
  description: t("app.description"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={defaultLocale}>
      <body>{children}</body>
    </html>
  );
}
