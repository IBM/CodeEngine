"use client";
import "./globals.scss";
import { Inter } from "next/font/google";
import { Header, SkipToContent, HeaderName } from "@carbon/react";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Header aria-label="IBM Cloud Code Engine">
          <SkipToContent />
          <HeaderName href="#" prefix="My">
            Translator
          </HeaderName>
        </Header>
        {children}
      </body>
    </html>
  );
}
