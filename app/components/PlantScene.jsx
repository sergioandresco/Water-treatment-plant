"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Html } from "@react-three/drei";
import { Suspense, useRef, useMemo } from "react";
import * as THREE from "three";

function WaterCircle({ radius = 1.7, y = 0.62, color = "#2ec5e8" }) {
  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ref.current) {
      ref.current.material.opacity = 0.55 + Math.sin(t * 1.5) * 0.06;
      ref.current.position.y = y + Math.sin(t * 2) * 0.01;
    }
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <circleGeometry args={[radius, 48]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.6}
        roughness={0.1}
        metalness={0.2}
        emissive={color}
        emissiveIntensity={0.25}
      />
    </mesh>
  );
}

// Clarificador circular con brazo giratorio
function Clarifier({ position = [0, 0, 0], radius = 1.8 }) {
  const arm = useRef();
  useFrame((_, delta) => {
    if (arm.current) arm.current.rotation.y += delta * 0.35;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, 0.7, 48]} />
        <meshStandardMaterial color="#3c5866" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[radius - 0.05, radius - 0.05, 0.05, 48]} />
        <meshStandardMaterial color="#25404c" />
      </mesh>
      <WaterCircle radius={radius - 0.12} y={0.64} />
      <group ref={arm} position={[0, 0.7, 0]}>
        <mesh position={[0, 0.35, 0]}>
          <boxGeometry args={[0.12, 0.7, 0.12]} />
          <meshStandardMaterial color="#dfe9ee" />
        </mesh>
        <mesh position={[radius / 2 - 0.1, 0.7, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.08, radius - 0.2, 0.08]} />
          <meshStandardMaterial color="#dfe9ee" />
        </mesh>
      </group>
    </group>
  );
}

// Balsa rectangular de sedimentación / filtrado
function Basin({ position = [0, 0, 0], size = [4.4, 0.8, 2.2], color = "#2ec5e8" }) {
  const water = useRef();
  useFrame((state) => {
    if (water.current) {
      water.current.material.emissiveIntensity =
        0.2 + Math.abs(Math.sin(state.clock.elapsedTime * 1.2)) * 0.25;
    }
  });
  const [w, h, d] = size;
  return (
    <group position={position}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#37525f" roughness={0.75} />
      </mesh>
      <mesh ref={water} position={[0, h - 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 0.25, d - 0.25]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.75}
          roughness={0.15}
        />
      </mesh>
    </group>
  );
}

function Pipe({ from, to, radius = 0.09, color = "#9fb3bd" }) {
  const { pos, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize()
    );
    return { pos: mid, quat, len };
  }, [from, to]);
  return (
    <mesh position={pos} quaternion={quat} castShadow>
      <cylinderGeometry args={[radius, radius, len, 16]} />
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.35} />
    </mesh>
  );
}

function PumpHouse({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 1.2, 1.4]} />
        <meshStandardMaterial color="#5b7683" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.32, 0]} castShadow>
        <boxGeometry args={[2, 0.14, 1.6]} />
        <meshStandardMaterial color="#2b414c" />
      </mesh>
      <Html position={[0, 1.7, 0]} center distanceFactor={10}>
        <div
          style={{
            fontSize: 10,
            padding: "2px 6px",
            borderRadius: 6,
            background: "rgba(0,0,0,0.55)",
            color: "#bfe9f2",
            whiteSpace: "nowrap",
          }}
        >
          Bombeo / Dosificación
        </div>
      </Html>
    </group>
  );
}

function Plant() {
  return (
    <group position={[0, -0.4, 0]}>
      {/* Suelo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[26, 26]} />
        <meshStandardMaterial color="#0c2230" roughness={1} />
      </mesh>

      {/* Línea de proceso */}
      <PumpHouse position={[-6.2, 0, 1.5]} />
      <Basin position={[-2.6, 0, 1.4]} size={[3.6, 0.8, 2.4]} color="#4a9db0" />
      <Clarifier position={[2.2, 0, 1.2]} radius={1.9} />
      <Clarifier position={[6.4, 0, 1.6]} radius={1.5} />
      <Basin position={[2.5, 0, -2.6]} size={[6.5, 0.7, 2]} color="#2ec5e8" />

      {/* Tuberías del flujo */}
      <Pipe from={[-5.3, 0.5, 1.5]} to={[-4.4, 0.5, 1.4]} />
      <Pipe from={[-0.8, 0.5, 1.4]} to={[0.3, 0.5, 1.2]} />
      <Pipe from={[4.1, 0.5, 1.3]} to={[4.9, 0.5, 1.5]} />
      <Pipe from={[6.4, 0.4, 0.1]} to={[6.4, 0.4, -1.6]} />
      <Pipe from={[6.4, 0.4, -1.6]} to={[5.7, 0.4, -2.6]} />
    </group>
  );
}

export default function PlantScene() {
  return (
    <Canvas shadows camera={{ position: [10, 8, 12], fov: 42 }} dpr={[1, 1.8]}>
      <color attach="background" args={["#04121b"]} />
      <fog attach="fog" args={["#04121b", 18, 40]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Suspense fallback={null}>
        <Plant />
        <Environment preset="city" />
        <ContactShadows
          position={[0, -0.39, 0]}
          opacity={0.5}
          scale={30}
          blur={2.4}
          far={10}
        />
      </Suspense>
      <OrbitControls
        enablePan={false}
        minDistance={8}
        maxDistance={26}
        maxPolarAngle={Math.PI / 2.15}
        autoRotate
        autoRotateSpeed={0.4}
      />
    </Canvas>
  );
}
