import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-[#F2F2F2]">
        {children}
      </body>
    </html>
  );
}