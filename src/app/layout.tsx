import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Confraria do Peixe", template: "%s | Confraria do Peixe" },
  description: "Faça seu pedido direto da sua mesa. Bebidas, petiscos e muito mais.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#F8FAFC",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#FFFFFF",
              color: "#0F172A",
              border: "1px solid #E2E8F0",
              borderRadius: "10px",
              fontFamily: "var(--font-inter)",
              fontSize: "0.875rem",
              boxShadow: "0 4px 16px rgba(15,23,42,0.12)",
            },
            success: { iconTheme: { primary: "#0F766E", secondary: "#FFFFFF" } },
            error:   { iconTheme: { primary: "#EF4444", secondary: "#FFFFFF" } },
          }}
        />
      </body>
    </html>
  );
}
