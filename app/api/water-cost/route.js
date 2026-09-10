import { NextResponse } from "next/server";

// Revalidate once per day (in seconds). Next.js caches the response so the
// number only changes once every 24h.
export const revalidate = 86400;

/**
 * Precio del metro cúbico (m³) de agua tratada.
 *
 * FUENTE DE DATOS
 * ---------------
 * No existe una API pública global y gratuita del precio del m³. Las fuentes
 * habituales son de pago o son PDFs anuales:
 *   - GWI Global Water Tariff Survey (Global Water Intelligence) — de pago.
 *   - IB-NET Tariffs Database (World Bank / IBNET) — https://tariffs.ib-net.org
 *   - Reguladores nacionales (p. ej. CRA Colombia, CNA México, INE España).
 *
 * Estrategia de este endpoint:
 *   1. Si defines WATER_TARIFF_API_URL en el entorno, se usa esa fuente real.
 *   2. Si no, se genera un valor DETERMINISTA por día a partir de una tarifa
 *      base regional + una variación diaria pseudo-aleatoria (índice de coste
 *      energético / químicos). Así "se actualiza todos los días" de forma
 *      reproducible sin depender de terceros.
 */

// Tarifa base de referencia por región (USD / m³ de agua potable tratada).
const BASE_TARIFFS = {
  "LATAM": 0.62,
  "US": 2.1,
  "EU": 3.4,
  "GLOBAL_AVG": 1.85,
};

// PRNG determinista (mulberry32) para que el valor de un día sea siempre igual.
function seededRandom(seed) {
  let t = seed + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function seedFromDate(d) {
  // AAAAMMDD como entero -> semilla estable por día.
  return Number(
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
      d.getUTCDate()
    ).padStart(2, "0")}`
  );
}

function priceForDate(date, base) {
  const seed = seedFromDate(date);
  // Variación diaria +/- 6% simulando coste de energía y reactivos.
  const drift = (seededRandom(seed) - 0.5) * 0.12;
  // Componente estacional suave a lo largo del año.
  const dayOfYear = Math.floor(
    (date - new Date(Date.UTC(date.getUTCFullYear(), 0, 0))) / 86400000
  );
  const seasonal = Math.sin((dayOfYear / 365) * Math.PI * 2) * 0.03;
  return +(base * (1 + drift + seasonal)).toFixed(4);
}

async function fetchRealTariff() {
  const url = process.env.WATER_TARIFF_API_URL;
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = await res.json();
    // Ajusta este mapeo al esquema de tu proveedor real.
    const value = Number(data.price ?? data.tariff ?? data.value);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const region = (searchParams.get("region") || "LATAM").toUpperCase();
  const currency = (searchParams.get("currency") || "USD").toUpperCase();
  const base = BASE_TARIFFS[region] ?? BASE_TARIFFS.GLOBAL_AVG;

  const today = new Date();
  const real = await fetchRealTariff();
  const current = real ?? priceForDate(today, base);

  // Histórico de 30 días para la gráfica del gemelo digital.
  const history = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    history.push({
      date: d.toISOString().slice(0, 10),
      price: priceForDate(d, base),
    });
  }

  const yesterday = history[history.length - 2]?.price ?? current;
  const changePct = +(((current - yesterday) / yesterday) * 100).toFixed(2);

  return NextResponse.json({
    region,
    currency,
    unit: "m3",
    pricePerCubicMeter: +current.toFixed(4),
    previousPrice: +yesterday.toFixed(4),
    changePct,
    updatedAt: today.toISOString(),
    source: real ? "external-api" : "deterministic-daily-model",
    history,
  });
}
