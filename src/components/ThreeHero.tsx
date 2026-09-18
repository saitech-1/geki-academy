import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

/* ─────────────────────────────────────────────
   GEKI SPHERE
───────────────────────────────────────────── */

function GekiSphere() {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!groupRef.current) return

    groupRef.current.rotation.y += delta * 0.12

    groupRef.current.rotation.x =
      Math.sin(performance.now() * 0.00035) * 0.025
  })

  return (
    <group
      ref={groupRef}
      position={[1.45, 0, 0]}
      rotation={[0.05, -0.2, 0]}
      scale={0.95}
    >
      {/* ───────── RED SPHERE ───────── */}

      <mesh>
        <sphereGeometry args={[1.55, 48, 32]} />

        <meshStandardMaterial
          color="#e30613"
          metalness={0.35}
          roughness={0.28}
        />
      </mesh>

      {/* ───────── SUBTLE INNER DEPTH ───────── */}

      <mesh scale={0.96}>
        <sphereGeometry args={[1.55, 32, 24]} />

        <meshStandardMaterial
          color="#b8000d"
          metalness={0.2}
          roughness={0.4}
        />
      </mesh>

      {/* ───────── CURVED GEKI MARK ───────── */}

      <GekiSurface />
    </group>
  )
}

/* ─────────────────────────────────────────────
   CURVED SPHERE PATCH
───────────────────────────────────────────── */

function SpherePatch({
  x,
  y,
  width,
  height,
  radius = 1.55,
  segmentsX = 10,
  segmentsY = 5,
  curve = 0,
}: {
  x: number
  y: number
  width: number
  height: number
  radius?: number
  segmentsX?: number
  segmentsY?: number
  curve?: number
}) {
  const geometry = useMemo(() => {
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    /*
      Tiny offset from the sphere surface.

      This prevents z-fighting while still making
      the white piece look physically attached.
    */

    const surfaceOffset = 0.012

    for (let iy = 0; iy <= segmentsY; iy++) {
      const v = iy / segmentsY

      for (let ix = 0; ix <= segmentsX; ix++) {
        const u = ix / segmentsX

        /*
          X position across the patch
        */

        const localX =
          x + (u - 0.5) * width

        /*
          ─────────────────────────────
          CURVE THE WHITE LINE
          ─────────────────────────────

          normalizedX:
            -1 = left
             0 = center
             1 = right

          The center gets the maximum
          upward curve while the edges
          remain at their original height.
        */

        const normalizedX =
          u * 2 - 1

        const curveOffset =
          curve *
          (1 - normalizedX * normalizedX)

        const localY =
          y +
          (v - 0.5) * height +
          curveOffset

        /*
          ─────────────────────────────
          PROJECT FRONT SURFACE
          ONTO SPHERE
          ─────────────────────────────

          x² + y² + z² = r²
        */

        const distanceSquared =
          localX * localX +
          localY * localY

        const safeZ = Math.max(
          0.001,
          radius * radius -
            distanceSquared
        )

        const localZ =
          Math.sqrt(safeZ) +
          surfaceOffset

        positions.push(
          localX,
          localY,
          localZ
        )

        uvs.push(u, 1 - v)
      }
    }

    /*
      ─────────────────────────────
      CONNECT VERTICES
      ─────────────────────────────
    */

    for (let iy = 0; iy < segmentsY; iy++) {
      for (let ix = 0; ix < segmentsX; ix++) {
        const a =
          iy * (segmentsX + 1) + ix

        const b = a + 1

        const c =
          a + (segmentsX + 1)

        const d = c + 1

        indices.push(
          a,
          b,
          d,

          a,
          d,
          c
        )
      }
    }

    /*
      ─────────────────────────────
      CREATE GEOMETRY
      ─────────────────────────────
    */

    const geo =
      new THREE.BufferGeometry()

    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        positions,
        3
      )
    )

    geo.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute(
        uvs,
        2
      )
    )

    geo.setIndex(indices)

    /*
      Calculate proper normals so
      the white surface receives
      lighting naturally.
    */

    geo.computeVertexNormals()

    return geo
  }, [
    x,
    y,
    width,
    height,
    radius,
    segmentsX,
    segmentsY,
    curve,
  ])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color="#ffffff"
        roughness={0.32}
        metalness={0.02}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}

/* ─────────────────────────────────────────────
   GEKI SURFACE MARK
───────────────────────────────────────────── */

function GekiSurface() {
  return (
    <group>
      {/* ═══════════════════════════════════════
          TOP TORII BEAM
          
          CURVED UPWARD IN THE CENTER
      ═══════════════════════════════════════ */}

      <SpherePatch
        x={0}
        y={0.60}
        width={1.85}
        height={0.16}
        segmentsX={20}
        segmentsY={5}
        curve={0.14}
      />

      {/* ═══════════════════════════════════════
          LEFT ROOF EXTENSION
      ═══════════════════════════════════════ */}

      <SpherePatch
        x={-0.98}
        y={0.69}
        width={0.42}
        height={0.14}
        segmentsX={6}
        segmentsY={4}
      />

      {/* ═══════════════════════════════════════
          RIGHT ROOF EXTENSION
      ═══════════════════════════════════════ */}

      <SpherePatch
        x={0.98}
        y={0.69}
        width={0.42}
        height={0.14}
        segmentsX={6}
        segmentsY={4}
      />

      {/* ═══════════════════════════════════════
          SECOND TORII BEAM
      ═══════════════════════════════════════ */}

      <SpherePatch
        x={0}
        y={0.30}
        width={1.40}
        height={0.15}
        segmentsX={12}
        segmentsY={4}
      />

      {/* ═══════════════════════════════════════
          LEFT PILLAR
      ═══════════════════════════════════════ */}

      <SpherePatch
        x={-0.57}
        y={-0.28}
        width={0.17}
        height={1.68}
        segmentsX={4}
        segmentsY={12}
      />

      {/* ═══════════════════════════════════════
          RIGHT PILLAR
      ═══════════════════════════════════════ */}

      <SpherePatch
        x={0.57}
        y={-0.28}
        width={0.17}
        height={1.68}
        segmentsX={4}
        segmentsY={12}
      />
    </group>
  )
}

/* ─────────────────────────────────────────────
   LIGHT ORBITS
───────────────────────────────────────────── */

function ScienceOrbit() {
  const ref = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!ref.current) return

    ref.current.rotation.z += delta * 0.035
  })

  return (
    <group
      ref={ref}
      position={[1.45, 0, 0]}
    >
      {/* ───────── MAIN ORBIT ───────── */}

      <mesh
        rotation={[
          Math.PI / 2.3,
          0.15,
          0,
        ]}
      >
        <torusGeometry
          args={[
            2.05,
            0.012,
            8,
            64,
          ]}
        />

        <meshBasicMaterial
          color="#e30613"
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* ───────── SECONDARY ORBIT ───────── */}

      <mesh
        rotation={[
          1.15,
          -0.5,
          0,
        ]}
      >
        <torusGeometry
          args={[
            2.3,
            0.009,
            8,
            64,
          ]}
        />

        <meshBasicMaterial
          color="#888888"
          transparent
          opacity={0.18}
        />
      </mesh>

      {/* ───────── DATA NODES ───────── */}

      <mesh position={[2, 0, 0]}>
        <sphereGeometry
          args={[0.035, 8, 8]}
        />

        <meshBasicMaterial
          color="#e30613"
        />
      </mesh>

      <mesh
        position={[
          -1.7,
          0.45,
          0,
        ]}
      >
        <sphereGeometry
          args={[0.025, 8, 8]}
        />

        <meshBasicMaterial
          color="#e30613"
        />
      </mesh>
    </group>
  )
}

/* ─────────────────────────────────────────────
   LOW GPU PARTICLES
───────────────────────────────────────────── */

function ScienceParticles() {
  const pointsRef =
    useRef<THREE.Points>(null)

  const particles = useMemo(() => {
    const count = 45

    const positions =
      new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const radius =
        2.8 + Math.random() * 1.8

      const angle =
        Math.random() *
        Math.PI *
        2

      positions[i * 3] =
        Math.cos(angle) *
        radius

      positions[i * 3 + 1] =
        (Math.random() - 0.5) *
        3.5

      positions[i * 3 + 2] =
        Math.sin(angle) *
        radius
    }

    return positions
  }, [])

  useFrame((_, delta) => {
    if (!pointsRef.current) return

    pointsRef.current.rotation.y +=
      delta * 0.008
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[particles, 3]}
        />
      </bufferGeometry>

      <pointsMaterial
        size={0.018}
        color="#e30613"
        transparent
        opacity={0.25}
        sizeAttenuation
      />
    </points>
  )
}

/* ─────────────────────────────────────────────
   SCENE
───────────────────────────────────────────── */

function Scene() {
  return (
    <>
      {/* ───────── LIGHTING ───────── */}

      <ambientLight
        intensity={1.8}
      />

      <directionalLight
        position={[3, 4, 5]}
        intensity={1.8}
      />

      <pointLight
        position={[3, 1, 3]}
        intensity={2}
        distance={7}
        color="#e30613"
      />

      {/* ───────── FLOATING GEKI SPHERE ───────── */}

      <Float
        speed={0.55}
        rotationIntensity={0.04}
        floatIntensity={0.18}
      >
        <GekiSphere />
      </Float>

      {/* ───────── ORBITS ───────── */}

      <ScienceOrbit />

      {/* ───────── PARTICLES ───────── */}

      <ScienceParticles />
    </>
  )
}

/* ─────────────────────────────────────────────
   HERO
───────────────────────────────────────────── */

export default function ThreeHero() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas
        camera={{
          position: [0, 0, 6],
          fov: 42,
        }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference:
            'high-performance',
        }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
