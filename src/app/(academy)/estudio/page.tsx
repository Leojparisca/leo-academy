import type { Metadata } from "next";
import { EstudioView } from "./estudio-view";

export const metadata: Metadata = {
  title: "Estudio",
  description:
    "Teclado polifónico cálido, acordes y laboratorio de armonía. Funciona sin conexión.",
};

export default function EstudioPage() {
  return <EstudioView />;
}
