import "./globals.css";

export const metadata = {
  title: "PharmaClash",
  description: "Interactive medication-safety engine. Educational prototype, not for clinical use.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
