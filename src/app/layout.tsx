import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Почасовой дневник настроения",
  description: "Приложение для почасовой оценки настроения от 1 до 10.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
