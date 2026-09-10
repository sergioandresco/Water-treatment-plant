"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

const PlantScene = dynamic(() => import("./components/PlantScene"), {
  ssr: false,
  loading: () => <div style={{ padding: 20, color: "#8fb4c4" }}>Cargando modelo 3D…</div>,
});

function Sparkline({ data }) {
  if (!data?.length) return null;
  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const w = 320;
  const h = 60;
  const pts = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((d.price - min) / (max - min || 1)) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke="#29d6c9"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---- Gemelo digital: simulación en vivo de sensores ----
function useDigitalTwin() {
  const [s, setS] = useState({
    flow: 480, // m³/h
    turbidityIn: 12.0, // NTU
    turbidityOut: 0.35, // NTU
    ph: 7.2,
    chlorine: 1.15, // mg/L
    energy: 0.42, // kWh/m³
    pressure: 2.4, // bar
  });
  const t = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      t.current += 1;
      const k = t.current;
      setS((prev) => ({
        flow: clamp(prev.flow + rnd(-14, 14), 380, 560),
        turbidityIn: clamp(9 + Math.sin(k / 9) * 3 + rnd(-0.6, 0.6), 4, 18),
        turbidityOut: clamp(0.3 + Math.sin(k / 12) * 0.08 + rnd(-0.03, 0.03), 0.1, 0.9),
        ph: clamp(7.2 + Math.sin(k / 15) * 0.15 + rnd(-0.04, 0.04), 6.6, 7.8),
        chlorine: clamp(1.1 + Math.sin(k / 10) * 0.12 + rnd(-0.03, 0.03), 0.6, 1.8),
        energy: clamp(0.42 + Math.sin(k / 11) * 0.05 + rnd(-0.01, 0.01), 0.3, 0.6),
        pressure: clamp(2.4 + Math.sin(k / 8) * 0.25 + rnd(-0.05, 0.05), 1.6, 3.4),
      }));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return s;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

export default function Home() {
  const [cost, setCost] = useState(null);
  const [err, setErr] = useState(null);
  const twin = useDigitalTwin();

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/water-cost?region=LATAM")
        .then((r) => r.json())
        .then((d) => alive && setCost(d))
        .catch((e) => alive && setErr(String(e)));
    load();
    const id = setInterval(load, 1000 * 60 * 30); // re-chequea cada 30 min
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // ---- Optimización con IA (heurística sobre el gemelo digital) ----
  const ai = useMemo(() => {
    const price = cost?.pricePerCubicMeter ?? 0.62;
    // Dosis de coagulante recomendada proporcional a la turbidez de entrada.
    const recommendedCoagulant = +(twin.turbidityIn * 0.9 + 2).toFixed(1); // mg/L
    // Setpoint de energía objetivo según presión de membrana.
    const targetEnergy = +(0.3 + (twin.pressure - 1.6) * 0.05).toFixed(3);
    const energyGap = +(twin.energy - targetEnergy).toFixed(3);
    // Ahorro proyectado por m³ y por día (a 480 m³/h * 24 h).
    const savingPerM3 = Math.max(0, energyGap) * 0.12 + (twin.chlorine > 1.3 ? 0.004 : 0);
    const dailyVolume = twin.flow * 24;
    const dailySaving = +(savingPerM3 * dailyVolume).toFixed(0);
    const complianceOk = twin.turbidityOut < 0.5 && twin.ph >= 6.8 && twin.ph <= 7.6;
    return {
      recommendedCoagulant,
      targetEnergy,
      energyGap,
      savingPerM3: +savingPerM3.toFixed(4),
      dailySaving,
      complianceOk,
      priceImpact: +(savingPerM3 / price * 100).toFixed(1),
    };
  }, [twin, cost]);

  const up = (cost?.changePct ?? 0) >= 0;

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <div className="logo">💧</div>
          <div>
            <h1>AquaTwin — Planta de Tratamiento de Agua</h1>
            <p>Purificación · Gemelo digital · Optimización con IA</p>
          </div>
        </div>
        <span className="pill">
          <span className="dot" /> Sistema en línea · {new Date().toLocaleDateString("es-ES")}
        </span>
      </div>

      <div className="grid">
        {/* Columna izquierda: 3D */}
        <div className="card">
          <h2>Modelo 3D de la planta (gemelo digital)</h2>
          <div className="scene">
            <PlantScene />
            <div className="hint">Arrastra para rotar · rueda para zoom</div>
          </div>
        </div>

        {/* Columna derecha: coste + métricas */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card">
            <h2>Coste del metro cúbico (m³)</h2>
            {err && <p className="muted">Error cargando datos: {err}</p>}
            {!cost && !err && <p className="muted">Cargando tarifa…</p>}
            {cost && (
              <>
                <div className="cost">
                  <span className="value">
                    {cost.pricePerCubicMeter.toFixed(3)}
                  </span>
                  <span className="unit">
                    {cost.currency} / m³
                    <br />
                    <span className={`change ${up ? "up" : "down"}`}>
                      {up ? "▲" : "▼"} {Math.abs(cost.changePct)}% vs. ayer
                    </span>
                  </span>
                </div>
                <Sparkline data={cost.history} />
                <div style={{ marginTop: 12 }}>
                  <div className="kv">
                    <span>Región</span>
                    <span>{cost.region}</span>
                  </div>
                  <div className="kv">
                    <span>Actualizado</span>
                    <span>{new Date(cost.updatedAt).toLocaleString("es-ES")}</span>
                  </div>
                  <div className="kv">
                    <span>Fuente</span>
                    <span>{cost.source}</span>
                  </div>
                  <div className="kv">
                    <span>Coste estimado / día ({Math.round(twin.flow * 24)} m³)</span>
                    <span>
                      {(cost.pricePerCubicMeter * twin.flow * 24).toLocaleString("es-ES", {
                        maximumFractionDigits: 0,
                      })}{" "}
                      {cost.currency}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <h2>Sensores en vivo</h2>
            <div className="twin-grid">
              <Metric label="Caudal" value={`${twin.flow.toFixed(0)} m³/h`} pct={(twin.flow - 380) / 1.8} />
              <Metric label="Turbidez entrada" value={`${twin.turbidityIn.toFixed(1)} NTU`} pct={(twin.turbidityIn / 18) * 100} />
              <Metric label="Turbidez salida" value={`${twin.turbidityOut.toFixed(2)} NTU`} pct={(twin.turbidityOut / 0.9) * 100} />
              <Metric label="pH" value={twin.ph.toFixed(2)} pct={((twin.ph - 6.6) / 1.2) * 100} />
              <Metric label="Cloro libre" value={`${twin.chlorine.toFixed(2)} mg/L`} pct={((twin.chlorine - 0.6) / 1.2) * 100} />
              <Metric label="Energía" value={`${twin.energy.toFixed(2)} kWh/m³`} pct={((twin.energy - 0.3) / 0.3) * 100} />
            </div>
          </div>
        </div>
      </div>

      {/* Optimización IA a ancho completo */}
      <div className="card" style={{ marginTop: 20 }}>
        <h2>Interfaz optimizada con IA</h2>
        <div className="twin-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <Metric label="Coagulante recomendado" value={`${ai.recommendedCoagulant} mg/L`} pct={ai.recommendedCoagulant * 3} />
          <Metric label="Setpoint energía objetivo" value={`${ai.targetEnergy} kWh/m³`} pct={((ai.targetEnergy - 0.3) / 0.3) * 100} />
          <Metric label="Ahorro proyectado / día" value={`${ai.dailySaving} ${cost?.currency ?? "USD"}`} pct={Math.min(100, ai.dailySaving / 20)} />
          <Metric label="Cumplimiento normativo" value={ai.complianceOk ? "OK ✓" : "Revisar ⚠"} pct={ai.complianceOk ? 100 : 40} />
        </div>

        <div className="ai-box">
          <div className="head">🤖 Recomendación del motor de optimización</div>
          <p>
            Con una turbidez de entrada de <b>{twin.turbidityIn.toFixed(1)} NTU</b> y un precio
            actual de <b>{(cost?.pricePerCubicMeter ?? 0.62).toFixed(3)} {cost?.currency ?? "USD"}/m³</b>,
            el gemelo digital sugiere ajustar la dosis de coagulante a{" "}
            <b>{ai.recommendedCoagulant} mg/L</b> y bajar el setpoint de energía a{" "}
            <b>{ai.targetEnergy} kWh/m³</b>
            {ai.energyGap > 0 ? (
              <>
                {" "}(actualmente <b>{twin.energy.toFixed(2)}</b>, margen de mejora de{" "}
                <b>{(ai.energyGap * 1000).toFixed(0)} Wh/m³</b>).
              </>
            ) : (
              <> (operación ya dentro del óptimo energético).</>
            )}{" "}
            Impacto estimado: <b>−{ai.priceImpact}%</b> sobre el coste del m³.
          </p>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          El modelo de optimización corre sobre el estado del gemelo digital (sensores simulados
          en <code>useDigitalTwin</code>). Sustituye la fuente por tu SCADA/PLC vía WebSocket o MQTT
          para producción.
        </p>
      </div>

      <div className="footer">made by FTUB</div>
    </div>
  );
}

function Metric({ label, value, pct = 0 }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="num">{value}</div>
      <div className="bar">
        <i style={{ width: `${clamp(pct, 4, 100)}%` }} />
      </div>
    </div>
  );
}
