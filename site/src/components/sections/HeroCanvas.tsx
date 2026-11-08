import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

function Particles({
  count,
  color,
  size,
  spread,
  speed,
  animate,
}: {
  count: number;
  color: string;
  size: number;
  spread: number;
  speed: number;
  animate: boolean;
}) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const random = seededRandom(count * 17 + 3);
    const array = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      array[index * 3] = (random() - 0.5) * spread;
      array[index * 3 + 1] = (random() - 0.5) * spread * 0.62;
      array[index * 3 + 2] = (random() - 0.5) * spread * 0.55;
    }
    return array;
  }, [count, spread]);

  useFrame((state) => {
    if (!animate || !points.current) return;
    points.current.rotation.y = state.clock.elapsedTime * speed;
    points.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.11) * 0.05;
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        sizeAttenuation
        transparent
        opacity={0.75}
        depthWrite={false}
      />
    </points>
  );
}

function ParticleScene({ animate }: { animate: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!animate || !group.current) return;
    group.current.rotation.y += (state.pointer.x * 0.1 - group.current.rotation.y) * 0.03;
    group.current.rotation.x += (-state.pointer.y * 0.06 - group.current.rotation.x) * 0.03;
  });

  return (
    <group ref={group}>
      <Particles
        count={520}
        color="#3ED6B5"
        size={0.018}
        spread={9}
        speed={0.018}
        animate={animate}
      />
      <Particles
        count={180}
        color="#FF8C42"
        size={0.026}
        spread={7}
        speed={-0.012}
        animate={animate}
      />
    </group>
  );
}

export default function HeroCanvas({ animate }: { animate: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.2], fov: 58 }}
      dpr={[1, 1.5]}
      frameloop={animate ? "always" : "demand"}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
      className="opacity-80"
    >
      <ParticleScene animate={animate} />
    </Canvas>
  );
}
