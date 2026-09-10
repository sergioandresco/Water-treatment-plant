import "./globals.css";

export const metadata = {
  title: "AquaTwin — Planta de Tratamiento de Agua",
  description:
    "Gemelo digital de una planta de purificación de agua: modelo 3D, coste del m³ actualizado a diario e interfaz optimizada con IA.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
