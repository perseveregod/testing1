"use client";

import { useT } from "@/lib/client/lang";
import { Sheet } from "@/components/ui/Sheet";

// Plain answers to the questions new people ask. Short on purpose: someone
// reads this once, on a phone, before deciding whether to trust the app.

const QA = [
  {
    q: ["What is Haven?", "¿Qué es Haven?"],
    a: [
      "A live map of what's happening around you in Houston: fire, EMS and police calls, weather alerts, and things neighbors report. Free to use, with one optional one-time upgrade. No subscriptions, no ads.",
      "Un mapa en vivo de lo que pasa a su alrededor en Houston: llamadas de bomberos, ambulancias y policía, alertas del clima y lo que reportan los vecinos. Gratis, con una mejora opcional de un solo pago. Sin suscripciones ni anuncios.",
    ],
  },
  {
    q: ["Where does the information come from?", "¿De dónde sale la información?"],
    a: [
      "City dispatch feeds, the National Weather Service, and neighbors who report what they see. Every incident says its source. Haven is not an official channel: in an emergency, call 911.",
      "De los despachos de la ciudad, del Servicio Nacional de Meteorología y de vecinos que reportan lo que ven. Cada incidente dice su fuente. Haven no es un canal oficial: en una emergencia, llame al 911.",
    ],
  },
  {
    q: ["Why do some things say “Demo”?", "¿Por qué algunas cosas dicen “Demo”?"],
    a: [
      "Demo items are fictional examples so you can explore before real feeds are switched on in your area. They're always labeled and never count as real events.",
      "Los elementos Demo son ejemplos ficticios para que explore antes de que se activen las fuentes reales en su zona. Siempre están marcados y nunca cuentan como eventos reales.",
    ],
  },
  {
    q: ["Is my location shared?", "¿Se comparte mi ubicación?"],
    a: [
      "Your exact location stays on your phone. Reports and saved places are rounded to about a block. “Near me” alerts share an approximate (~1 km) location only while that setting is on, and turning it off deletes it.",
      "Su ubicación exacta se queda en su teléfono. Los reportes y lugares guardados se redondean a una cuadra aproximadamente. Las alertas “cerca de mí” comparten una ubicación aproximada (~1 km) solo mientras esa opción está activa, y al apagarla se borra.",
    ],
  },
  {
    q: ["Can Haven call for help?", "¿Haven puede pedir ayuda?"],
    a: [
      "No. Haven never contacts 911 or anyone else on its own. Safe Walk prepares a text with your location that you send yourself.",
      "No. Haven nunca contacta al 911 ni a nadie por sí solo. Camino seguro prepara un mensaje con su ubicación que usted mismo envía.",
    ],
  },
  {
    q: ["What happens to a false report?", "¿Qué pasa con un reporte falso?"],
    a: [
      "Anyone can flag a report. A few flags hide it while it's reviewed, and personal details (names, plates, phone numbers) are removed automatically before anything is shown.",
      "Cualquiera puede marcar un reporte. Con unas pocas marcas se oculta mientras se revisa, y los datos personales (nombres, placas, teléfonos) se quitan automáticamente antes de mostrar algo.",
    ],
  },
] as const;

export function HowItWorksSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { es } = useT();
  const i = es ? 1 : 0;
  return (
    <Sheet open={open} onClose={onClose} title={es ? "Cómo funciona Haven" : "How Haven works"}>
      <dl className="divide-y divide-line pb-2">
        {QA.map((item) => (
          <div key={item.q[0]} className="py-3.5">
            <dt className="text-[15.5px] font-semibold tracking-[-0.01em]">{item.q[i]}</dt>
            <dd className="mt-1 text-[14px] leading-relaxed text-muted">{item.a[i]}</dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}
