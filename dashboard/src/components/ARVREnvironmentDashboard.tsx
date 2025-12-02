import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Html, Line } from '@react-three/drei';
import * as THREE from 'three';

// Component for a rotating box (representing data/modules)
interface SpinningBoxProps {
  position?: [number, number, number];
}
const SpinningBox: React.FC<SpinningBoxProps> = ({ position = [0,0,0] }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.01;
      meshRef.current.rotation.y += 0.01;
    }
  });
  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  );
};

// Component for a "cyber-grid" floor
const CyberGrid: React.FC = () => {
  return (
    <gridHelper args={[100, 100, 0x888888, 0x444444]} />
  );
};

// Component to represent a "data stream" or connection
const DataStream: React.FC<{ start: THREE.Vector3; end: THREE.Vector3 }> = ({ start, end }) => {
  const [lineColor, setLineColor] = useState('cyan'); // State for dynamic color
  const [linePoints] = useState(() => [start.toArray(), end.toArray()]);

  useFrame(({ clock }) => {
    const t = (clock.getElapsedTime() * 0.5) % 1; // Animation progress
    const color = new THREE.Color().lerpColors(new THREE.Color('cyan'), new THREE.Color('magenta'), t);
    setLineColor(`#${color.getHexString()}`); // Update state with new color
  });

  return (
    <Line
      points={linePoints} // Pass the linePoints state variable
      color={lineColor} // Use dynamic color
      lineWidth={1}
    />
  );
};

// Main AR/VR Environment Component
const ARVREnvironmentDashboard: React.FC = () => {
  const [envStatus, setEnvStatus] = useState<'Stable' | 'Warning' | 'Critical'>('Stable');

  useEffect(() => {
    const interval = setInterval(() => {
      const statuses = ['Stable', 'Warning', 'Critical'];
      setEnvStatus(statuses[Math.floor(Math.random() * statuses.length)] as typeof envStatus);
    }, 5000); // Change status every 5 seconds
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="w-full h-full" style={{ height: 'calc(100vh - 80px)' }}> {/* Adjust height as needed */}
      <Canvas camera={{ position: [0, 5, 10], fov: 75 }}>
        <color attach="background" args={['#1a1a2e']} /> {/* Dark blue background */}
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />

        <CyberGrid />
        <SpinningBox />
        <SpinningBox position={[-3, 2, -2]} />
        <SpinningBox position={[4, -1, 3]} />

        {/* Example Data Streams */}
        <DataStream start={new THREE.Vector3(0, 0.5, 0)} end={new THREE.Vector3(-3, 2, -2)} />
        <DataStream start={new THREE.Vector3(0, 0.5, 0)} end={new THREE.Vector3(4, -1, 3)} />

        {/* Text labels in 3D space */}
        <Text
          position={[0, 3, 0]}
          fontSize={0.8}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          Cyber Core
        </Text>
        <Text
          position={[-3, 3, -2]}
          fontSize={0.5}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          Module A
        </Text>
        <Text
          position={[4, 0, 3]}
          fontSize={0.5}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          Module B
        </Text>

        {/* HTML elements overlaid (for UI within 3D) */}
        <Html position={[0, -5, 0]} transform>
            <div style={{ background: 'rgba(255,255,255,0.7)', padding: '10px', borderRadius: '5px' }}>
                <h3 style={{ color: 'black' }}>Environment Status: {envStatus}</h3>
            </div>
        </Html>

        <OrbitControls />
      </Canvas>
    </div>
  );
};

export default ARVREnvironmentDashboard;
