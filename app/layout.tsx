import type { Metadata, Viewport } from "next";
import { Libre_Franklin, Fraunces } from "next/font/google";
import "./globals.css";

const sans = Libre_Franklin({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  axes: ["opsz"],
});

const title = "Jumbles — the daily word game";
const description =
  "Unscramble four words, then use the circled letters to crack the bonus. A new Jumbles puzzle every day.";

export const metadata: Metadata = {
  metadataBase: new URL("https://jumbles.vercel.app"),
  title,
  description,
  applicationName: "Jumbles",
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Jumbles",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  appleWebApp: { capable: true, title: "Jumbles", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#14161a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

/** Applies the saved theme before paint to avoid a flash of the wrong theme. */
const themeScript = `(function(){try{var t=JSON.parse(localStorage.getItem('jumbles:prefs:v1')||'{}').theme;var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${sans.variable} ${serif.variable}`}>{children}</body>
    </html>
  );
}
