"use client";
/**
 * Stylised 3D travel-consultant avatar built from procedural Three.js geometry
 * (no model files, no network assets). Load it only via next/dynamic with
 * { ssr: false } — see AvatarStage.tsx.
 */
import { Float, RoundedBox, Sparkles } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Expression } from "@/lib/types";
import { POSES } from "./expressions";
import type { LipSync } from "./useLipSync";

const SKIN = "#d39a6e";
const SKIN_SHADE = "#c48558";
const HAIR = "#1c120d";
const LIP = "#a63d4a";
const KURTA = "#0f766e";
const GOLD = "#e0a82e";

interface Props {
  expression: Expression;
  lip: LipSync;
}

const damp = THREE.MathUtils.damp;

function auraTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Eye({ side, eyeRef, irisRef }: { side: 1 | -1; eyeRef: React.RefObject<THREE.Group | null>; irisRef: React.RefObject<THREE.Group | null> }) {
  return (
    <group position={[0.33 * side, 0.1, 0.82]} rotation={[0, 0.18 * side, 0]}>
      <group ref={eyeRef}>
        <mesh scale={[1, 0.8, 0.55]}>
          <sphereGeometry args={[0.17, 32, 32]} />
          <meshStandardMaterial color="#fbf8f3" roughness={0.25} />
        </mesh>
        <group ref={irisRef} position={[0, 0, 0.07]}>
          <mesh scale={[1, 1, 0.35]}>
            <sphereGeometry args={[0.095, 32, 32]} />
            <meshStandardMaterial color="#4a2a17" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.022]} scale={[1, 1, 0.3]}>
            <sphereGeometry args={[0.048, 24, 24]} />
            <meshStandardMaterial color="#0c0705" roughness={0.1} />
          </mesh>
          <mesh position={[0.03, 0.035, 0.04]}>
            <sphereGeometry args={[0.018, 12, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
        {/* Upper lash line */}
        <mesh position={[0, 0.035, 0.035]} rotation={[0, 0, 0]} scale={[1, 0.85, 1]}>
          <torusGeometry args={[0.165, 0.016, 8, 32, Math.PI]} />
          <meshStandardMaterial color="#120a06" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

function Character({ expression, lip }: Props) {
  const head = useRef<THREE.Group>(null);
  const browL = useRef<THREE.Mesh>(null);
  const browR = useRef<THREE.Mesh>(null);
  const eyeL = useRef<THREE.Group>(null);
  const eyeR = useRef<THREE.Group>(null);
  const irisL = useRef<THREE.Group>(null);
  const irisR = useRef<THREE.Group>(null);
  const upperLip = useRef<THREE.Mesh>(null);
  const lowerLip = useRef<THREE.Mesh>(null);
  const mouthInner = useRef<THREE.Mesh>(null);
  const teeth = useRef<THREE.Mesh>(null);
  const aura = useRef<THREE.Mesh>(null);
  const rimL = useRef<THREE.PointLight>(null);
  const rimR = useRef<THREE.PointLight>(null);
  const sparkleColor = useRef(new THREE.Color(POSES.idle.halo));

  const auraMap = useMemo(() => auraTexture(), []);
  const cur = useRef({ ...POSES.idle, open: 0, width: 1, blinkAt: 2, blink: 1 });
  const tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const pose = POSES[expression];
    const c = cur.current;
    const k = 6;
    c.browY = damp(c.browY, pose.browY, k, delta);
    c.browTilt = damp(c.browTilt, pose.browTilt, k, delta);
    c.smile = damp(c.smile, pose.smile, k, delta);
    c.headTilt = damp(c.headTilt, pose.headTilt, 4, delta);
    c.eyeOpen = damp(c.eyeOpen, pose.eyeOpen, k, delta);
    c.gazeX = damp(c.gazeX, pose.gazeX, 4, delta);
    c.gazeY = damp(c.gazeY, pose.gazeY, 4, delta);

    // Natural blinking: every 2.5–6 s, occasionally a double blink.
    if (t > c.blinkAt) {
      c.blink = 0;
      c.blinkAt = t + 2.5 + Math.random() * 3.5;
      if (Math.random() < 0.15) c.blinkAt = t + 0.25;
    }
    c.blink = damp(c.blink, 1, 18, delta);
    const lidY = Math.max(0.06, c.eyeOpen * (c.blink < 0.5 ? c.blink * 0.2 : c.blink));
    eyeL.current?.scale.set(1, lidY, 1);
    eyeR.current?.scale.set(1, lidY, 1);

    // Head: mouse-follow + expression tilt + speaking nods.
    const px = state.pointer.x;
    const py = state.pointer.y;
    if (head.current) {
      const nod = lip.active ? Math.sin(t * 7) * 0.025 : 0;
      head.current.rotation.y = damp(head.current.rotation.y, px * 0.35 + c.gazeX * 0.04, 3, delta);
      head.current.rotation.x = damp(head.current.rotation.x, -py * 0.18 - c.gazeY * 0.03 + nod, 3, delta);
      head.current.rotation.z = damp(head.current.rotation.z, THREE.MathUtils.degToRad(-c.headTilt), 3, delta);
    }
    for (const iris of [irisL.current, irisR.current]) {
      if (!iris) continue;
      iris.position.x = damp(iris.position.x, px * 0.035 + c.gazeX * 0.012, 8, delta);
      iris.position.y = damp(iris.position.y, py * 0.025 - c.gazeY * 0.012, 8, delta);
    }

    // Brows: raise + worried/focused tilt.
    const by = 0.4 - c.browY * 0.012;
    const tilt = THREE.MathUtils.degToRad(c.browTilt);
    // Capsules are vertical by default: rotate a quarter turn, then tilt (+ = inner ends up = worried).
    if (browL.current) {
      browL.current.position.y = by;
      browL.current.rotation.z = Math.PI / 2 - 0.1 + tilt;
    }
    if (browR.current) {
      browR.current.position.y = by;
      browR.current.rotation.z = Math.PI / 2 + 0.1 - tilt;
    }

    // Mouth: visemes from speech/text/audio drive the jaw opening and width.
    const m = lip.frame(performance.now());
    c.open = damp(c.open, m.open, 22, delta);
    const targetW = m.shape === "E" ? 1.18 : m.shape === "O" ? 0.72 : m.shape === "M" ? 1.04 : 1;
    c.width = damp(c.width, targetW, 16, delta);
    const smile = c.smile / 4; // -1..1
    const open = c.open;
    upperLip.current?.scale.set(c.width, 0.28 + open * 0.25 + Math.max(0, -smile) * 0.35, 1);
    lowerLip.current?.scale.set(c.width, 0.22 + open * 1.05 + Math.max(0, smile) * 0.35, 1);
    if (mouthInner.current) {
      mouthInner.current.visible = open > 0.06;
      mouthInner.current.scale.set(c.width * 0.86, 0.05 + open * 0.95, 0.5);
    }
    if (teeth.current) {
      teeth.current.visible = open > 0.3;
      teeth.current.scale.set(c.width * 0.8, Math.min(1, open), 1);
    }

    // Aura + rim lights follow the emotional state.
    tmpColor.set(pose.halo);
    sparkleColor.current.lerp(tmpColor, 1 - Math.exp(-3 * delta));
    if (aura.current) {
      const mat = aura.current.material as THREE.MeshBasicMaterial;
      mat.color.copy(sparkleColor.current);
      const pulse = expression === "speaking" || expression === "listening" ? 0.08 * Math.sin(t * 4) : 0;
      aura.current.scale.setScalar(4.4 + pulse);
      mat.opacity = expression === "concerned" ? 0.5 : 0.38 + pulse;
    }
    rimL.current?.color.copy(sparkleColor.current);
    rimR.current?.color.copy(sparkleColor.current);
  });

  return (
    <>
      <mesh ref={aura} position={[0, 0.1, -1.6]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={auraMap} transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} color={POSES.idle.halo} />
      </mesh>
      <Sparkles count={40} scale={[3.6, 3.6, 1.5]} position={[0, 0.2, -0.8]} size={2.2} speed={0.35} opacity={0.6} color={POSES[expression].halo} />

      <ambientLight intensity={0.55} />
      <directionalLight position={[2.5, 3, 4]} intensity={1.6} color="#fff4e6" />
      <directionalLight position={[-3, 1, 2]} intensity={0.45} color="#dbeafe" />
      <pointLight ref={rimL} position={[-2.4, 1.2, -1.5]} intensity={18} distance={7} />
      <pointLight ref={rimR} position={[2.4, 1.6, -1.5]} intensity={18} distance={7} />

      <Float speed={1.6} rotationIntensity={0.12} floatIntensity={0.35} floatingRange={[-0.04, 0.06]}>
        {/* Shoulders, kurta and dupatta */}
        <group position={[0, -1.95, 0]}>
          <mesh scale={[1.75, 0.75, 0.95]}>
            <sphereGeometry args={[1, 48, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={KURTA} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.6, 0.18]} rotation={[Math.PI / 2 + 0.25, 0, 0]}>
            <torusGeometry args={[0.36, 0.035, 12, 40]} />
            <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.35} />
          </mesh>
          {/* Saffron dupatta draped over the right shoulder */}
          <mesh position={[0.95, 0.2, 0.05]} rotation={[0, 0, 0.55]} scale={[0.6, 1, 1.02]}>
            <torusGeometry args={[0.55, 0.12, 12, 40, Math.PI]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.6} />
          </mesh>
          <RoundedBox args={[0.42, 0.16, 0.04]} radius={0.03} position={[-0.75, 0.25, 0.62]} rotation={[-0.35, 0.35, 0.1]}>
            <meshStandardMaterial color="#ffffff" roughness={0.4} />
          </RoundedBox>
          <mesh position={[-0.75, 0.25, 0.645]} rotation={[-0.35, 0.35, 0.1]}>
            <boxGeometry args={[0.3, 0.05, 0.01]} />
            <meshStandardMaterial color={KURTA} />
          </mesh>
        </group>
        {/* Neck */}
        <mesh position={[0, -1.18, -0.05]}>
          <cylinderGeometry args={[0.3, 0.36, 0.75, 32]} />
          <meshStandardMaterial color={SKIN_SHADE} roughness={0.6} />
        </mesh>

        <group ref={head} position={[0, 0, 0]}>
          {/* Hair back + bun */}
          <mesh position={[0, 0.12, -0.14]} scale={[1.02, 1.1, 1]}>
            <sphereGeometry args={[1.02, 48, 48]} />
            <meshStandardMaterial color={HAIR} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.98, -0.58]}>
            <sphereGeometry args={[0.38, 32, 32]} />
            <meshStandardMaterial color={HAIR} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.82, -0.5]} rotation={[1.1, 0, 0]}>
            <torusGeometry args={[0.3, 0.035, 10, 32]} />
            <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Face */}
          <mesh scale={[0.9, 1.1, 0.92]}>
            <sphereGeometry args={[1, 64, 64]} />
            <meshStandardMaterial color={SKIN} roughness={0.55} />
          </mesh>
          {/* Front hair with centre parting */}
          <mesh position={[-0.02, 0.1, 0.02]} rotation={[-0.32, 0.12, 0.08]} scale={[0.95, 1.12, 0.99]}>
            <sphereGeometry args={[1, 48, 48, Math.PI, Math.PI, 0, Math.PI * 0.36]} />
            <meshStandardMaterial color={HAIR} roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0.02, 0.1, 0.02]} rotation={[-0.32, -0.12, -0.08]} scale={[0.95, 1.12, 0.99]}>
            <sphereGeometry args={[1, 48, 48, 0, Math.PI, 0, Math.PI * 0.36]} />
            <meshStandardMaterial color={HAIR} roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
          {/* Ears + jhumkas */}
          {([-1, 1] as const).map((s) => (
            <group key={s} position={[0.88 * s, 0.02, -0.05]}>
              <mesh scale={[0.12, 0.22, 0.14]}>
                <sphereGeometry args={[1, 24, 24]} />
                <meshStandardMaterial color={SKIN_SHADE} roughness={0.6} />
              </mesh>
              <mesh position={[0.02 * s, -0.27, 0.02]}>
                <sphereGeometry args={[0.05, 16, 16]} />
                <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.25} />
              </mesh>
              <mesh position={[0.02 * s, -0.4, 0.02]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.08, 0.14, 24]} />
                <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.25} />
              </mesh>
            </group>
          ))}
          {/* Eyes */}
          <Eye side={-1} eyeRef={eyeL} irisRef={irisL} />
          <Eye side={1} eyeRef={eyeR} irisRef={irisR} />
          {/* Brows */}
          <mesh ref={browL} position={[-0.34, 0.4, 0.86]}>
            <capsuleGeometry args={[0.032, 0.24, 6, 12]} />
            <meshStandardMaterial color={HAIR} roughness={0.7} />
          </mesh>
          <mesh ref={browR} position={[0.34, 0.4, 0.86]}>
            <capsuleGeometry args={[0.032, 0.24, 6, 12]} />
            <meshStandardMaterial color={HAIR} roughness={0.7} />
          </mesh>
          {/* Bindi, nose, nose-pin, cheeks */}
          <mesh position={[0, 0.55, 0.93]} scale={[1, 1, 0.4]}>
            <sphereGeometry args={[0.045, 16, 16]} />
            <meshStandardMaterial color="#be123c" roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.12, 0.98]} scale={[0.7, 0.8, 0.9]}>
            <sphereGeometry args={[0.095, 24, 24]} />
            <meshStandardMaterial color={SKIN_SHADE} roughness={0.5} />
          </mesh>
          <mesh position={[0.08, -0.16, 1.0]}>
            <sphereGeometry args={[0.014, 10, 10]} />
            <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.2} />
          </mesh>
          {([-1, 1] as const).map((s) => (
            <mesh key={s} position={[0.52 * s, -0.22, 0.78]} rotation={[0, 0.55 * s, 0]}>
              <circleGeometry args={[0.15, 24]} />
              <meshBasicMaterial color="#f08a8a" transparent opacity={0.28} depthWrite={false} />
            </mesh>
          ))}
          {/* Mouth: torus arcs as lips + inner cavity + teeth */}
          <group position={[0, -0.43, 0.9]}>
            <mesh ref={mouthInner} position={[0, -0.02, -0.02]}>
              <sphereGeometry args={[0.17, 24, 24]} />
              <meshStandardMaterial color="#3b0d14" roughness={0.9} />
            </mesh>
            <mesh ref={teeth} position={[0, 0.02, 0.02]}>
              <boxGeometry args={[0.2, 0.05, 0.04]} />
              <meshStandardMaterial color="#fbfbf7" roughness={0.3} />
            </mesh>
            <mesh ref={upperLip}>
              <torusGeometry args={[0.17, 0.035, 12, 32, Math.PI]} />
              <meshStandardMaterial color={LIP} roughness={0.35} />
            </mesh>
            <mesh ref={lowerLip} rotation={[0, 0, Math.PI]}>
              <torusGeometry args={[0.17, 0.042, 12, 32, Math.PI]} />
              <meshStandardMaterial color={LIP} roughness={0.35} />
            </mesh>
          </group>
        </group>
      </Float>
    </>
  );
}

export default function Avatar3D({ expression, lip }: Props) {
  return (
    <Canvas
      camera={{ position: [0, -0.35, 5.6], fov: 32 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      aria-label={`Saathi 3D avatar, ${expression}`}
      role="img"
    >
      <Character expression={expression} lip={lip} />
    </Canvas>
  );
}
