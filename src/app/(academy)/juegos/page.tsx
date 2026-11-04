import type { Metadata } from "next";
import { JuegosView } from "./juegos-view";

export const metadata: Metadata = {
  title: "Juegos",
  description:
    "Juegos de melodía, armonía y ritmo para entrenar el oído y el pulso.",
};

export default function JuegosPage() {
  return <JuegosView />;
}
