"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics, RigidBody, useSpringJoint, CuboidCollider } from "@react-three/rapier";
import { Environment, Text } from "@react-three/drei";
import { useRef, useState, useMemo, Suspense } from "react";
import * as THREE from "three";

function Badge() {
  const badgeRef = useRef<any>(null);
  const anchorRef = useRef<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPoint, setDragPoint] = useState<THREE.Vector3 | null>(null);
  
  const { camera, pointer } = useThree();
  const targetPos = new THREE.Vector3();

  // 1. LESS SPRINGY JOINT
  useSpringJoint(anchorRef, badgeRef, [
    [0, 0, 0],         // Point on the anchor
    [0, 1.8, -0.2],    // Point on the badge (Moved to Z: -0.2 to attach to the BACK)
    5,                 // Rest length
    60,                // LOWER Stiffness (was 120) so it doesn't snap back violently
    35                 // HIGHER Damping (was 8) so it loses energy quickly like real fabric
  ]);

  useFrame(() => {
    if (isDragging && badgeRef.current && dragPoint) {
      targetPos.set(pointer.x, pointer.y, 0.5);
      targetPos.unproject(camera);
      targetPos.sub(camera.position).normalize();
      const distance = -camera.position.z / targetPos.z;
      const mouseWorldPos = new THREE.Vector3().copy(camera.position).add(targetPos.multiplyScalar(distance));

      const badgeTranslation = badgeRef.current.translation();
      const badgeRotation = badgeRef.current.rotation();
      const worldDragPoint = dragPoint.clone().applyQuaternion(badgeRotation).add(badgeTranslation);

      badgeRef.current.applyImpulseAtPoint({
        x: (mouseWorldPos.x - worldDragPoint.x) * 4,
        y: (mouseWorldPos.y - worldDragPoint.y) * 4,
        z: (mouseWorldPos.z - worldDragPoint.z) * 4,
      }, worldDragPoint, true);
    }
  });

  return (
    <>
      {/* Anchor pushed slightly back on the Z axis (Z: -0.5) */}
      <RigidBody ref={anchorRef} type="fixed" position={[4, 8, -0.5]} />

      <RigidBody 
        ref={badgeRef} 
        type="dynamic" 
        position={[4, 2, 0]} 
        colliders="cuboid"
        linearDamping={2.5}  // Increased air friction
        angularDamping={2.5} // Increased spin friction
        enabledRotations={[false, false, true]} 
      >
        <group 
          onPointerDown={(e) => {
            e.stopPropagation();
            e.target.setPointerCapture(e.pointerId);
            setIsDragging(true);
            if (badgeRef.current) {
              badgeRef.current.wakeUp();
              setDragPoint(e.point.clone().sub(badgeRef.current.translation()));
            }
          }}
          onPointerUp={(e) => {
            e.target.releasePointerCapture(e.pointerId);
            setIsDragging(false);
            setDragPoint(null);
          }}
          onPointerOver={() => document.body.style.cursor = 'grab'}
          onPointerOut={() => document.body.style.cursor = 'auto'}
        >
          {/* THE CARD CASE */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[3.2, 4.2, 0.2]} />
            <meshStandardMaterial color="#1D1D1F" />
          </mesh>

          {/* THE INNER CARD */}
          <mesh position={[0, 0, 0.11]}>
            <planeGeometry args={[2.8, 3.8]} />
            <meshStandardMaterial color="#FFFFFF" />
          </mesh>

          {/* FRONT TEXT */}
          <Text position={[0, 0.5, 0.12]} fontSize={0.3} color="black" anchorY="top">
            AEROSENSE
          </Text>
          <Text position={[0, -0.5, 0.12]} fontSize={0.18} color="gray" maxWidth={2.5} textAlign="center">
            contact@aerosense.com
          </Text>
        </group>
      </RigidBody>

      <LanyardTube badgeRef={badgeRef} />
    </>
  );
}

function LanyardTube({ badgeRef }: { badgeRef: any }) {
  const meshRef = useRef<any>(null);

  const textTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#1D1D1F"; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#FFFFFF"; 
      ctx.font = "bold 60px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("AEROSENSE • AEROSENSE • AEROSENSE • AEROSENSE", canvas.width / 2, canvas.height / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 1); 
    return texture;
  }, []);

  useFrame(() => {
    if (badgeRef.current && meshRef.current && badgeRef.current.translation) {
      const badgePos = badgeRef.current.translation();
      
      if (badgePos && typeof badgePos.x === 'number') {
        // 2. STRING ATTACHED BEHIND
        const anchorPoint = new THREE.Vector3(4, 8, -0.5); 
        // End point connects to the negative Z space so it visibly sits behind the black casing
        const endPoint = new THREE.Vector3(badgePos.x, badgePos.y + 1.8, badgePos.z - 0.2); 
        
        const midPoint = new THREE.Vector3().lerpVectors(anchorPoint, endPoint, 0.5);
        midPoint.y -= 0.5;

        const curve = new THREE.QuadraticBezierCurve3(anchorPoint, midPoint, endPoint);
        
        meshRef.current.geometry.dispose();
        meshRef.current.geometry = new THREE.TubeGeometry(curve, 32, 0.15, 12, false);

        textTexture.offset.x -= 0.005;
      }
    }
  });

  return (
    <mesh ref={meshRef}>
      <tubeGeometry args={[new THREE.LineCurve3(new THREE.Vector3(4,8,-0.5), new THREE.Vector3(4,0,0)), 32, 0.15, 12, false]} />
      <meshStandardMaterial map={textTexture} roughness={0.9} />
    </mesh>
  );
}

// --- THE INVISIBLE CAGE ---
function ScreenBoundaries() {
  return (
    <>
      {/* Right Wall */}
      <RigidBody type="fixed" position={[10, 0, 0]}>
        <CuboidCollider args={[1, 15, 5]} />
      </RigidBody>
      {/* Left Wall */}
      <RigidBody type="fixed" position={[-10, 0, 0]}>
        <CuboidCollider args={[1, 15, 5]} />
      </RigidBody>
      {/* Floor */}
      <RigidBody type="fixed" position={[0, -6, 0]}>
        <CuboidCollider args={[15, 1, 5]} />
      </RigidBody>
      {/* Ceiling */}
      <RigidBody type="fixed" position={[0, 10, 0]}>
        <CuboidCollider args={[15, 1, 5]} />
      </RigidBody>
      {/* Back Wall (Prevents it from swinging away into the background) */}
      <RigidBody type="fixed" position={[0, 0, -3]}>
        <CuboidCollider args={[15, 15, 1]} />
      </RigidBody>
      {/* Front Wall (Prevents it from hitting the camera) */}
      <RigidBody type="fixed" position={[0, 0, 3]}>
        <CuboidCollider args={[15, 15, 1]} />
      </RigidBody>
    </>
  );
}

export default function LanyardScene() {
  return (
    <Canvas shadows camera={{ position: [0, 0, 12], fov: 45 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
      <Suspense fallback={null}>
        <Environment preset="city" />
        <Physics gravity={[0, -20, 0]}>
          <Badge />
          {/* 3. ADD BOUNDARIES TO PHYSICS WORLD */}
          <ScreenBoundaries /> 
        </Physics>
      </Suspense>
    </Canvas>
  );
}