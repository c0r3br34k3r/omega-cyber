import React, { useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
// @ts-ignore
import { generateMockNetworkTopology, NetworkNode, type NetworkEdge, subscribeToNetworkUpdates } from '../data/networkData';

// Component for a single network node
interface NodeProps {
  node: NetworkNode;
  position: [number, number, number];
}

const Node: React.FC<NodeProps> = ({ node, position }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHover] = useState(false);
  const [active, setActive] = useState(false);

  // Determine color based on status and hover state
  let color = 'blue';
  if (node.status === 'compromised') color = 'red';
  else if (node.status === 'offline') color = 'gray';
  else if (hovered) color = 'yellow';
  else if (active) color = 'lime';

  return (
    <mesh
      position={position}
      ref={meshRef}
      scale={node.status === 'compromised' ? 1.5 : 1}
      onClick={() => setActive(!active)}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial color={color} />
      {hovered && (
        <Html position={[0, 0.7, 0]}>
          <div style={{ background: 'rgba(0,0,0,0.7)', color: 'white', padding: '5px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
            {node.name}<br />Status: {node.status}
          </div>
        </Html>
      )}
    </mesh>
  );
};


// Component for the entire network graph
const NetworkGraph: React.FC = () => {
  const [network, setNetwork] = useState(generateMockNetworkTopology(30));
  const nodesMap = useRef<Map<string, [number, number, number]>>(new Map());

  // Initialize node positions randomly in a 3D space
  useEffect(() => {
    network.nodes.forEach(node => {
      nodesMap.current.set(node.id, [
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
      ]);
    });
  }, [network.nodes]);

  // Simulate network updates
  useEffect(() => {
    const { start, stop } = subscribeToNetworkUpdates(
      (updatedNode) => {
        setNetwork((prevNetwork) => ({
          ...prevNetwork,
          nodes: prevNetwork.nodes.map((node) =>
            node.id === updatedNode.id ? { ...node, ...updatedNode } : node
          ),
        }));
      },
      network.nodes,
      5000 // Update every 5 seconds
    );

    start();
    return () => stop();
  }, [network.nodes]);

  return (
    <>
      {network.nodes.map((node) => {
        const position = nodesMap.current.get(node.id);
        return position ? <Node key={node.id} node={node} position={position} /> : null;
      })}
      {network.edges.map((edge) => {
        const sourcePos = nodesMap.current.get(edge.source);
        const targetPos = nodesMap.current.get(edge.target);
        if (sourcePos && targetPos) {
          return (
            <Line
              key={edge.id}
              points={[sourcePos, targetPos]}
              color="grey"
              lineWidth={1}
            />
          );
        }
        return null;
      })}
    </>
  );
};

const NetworkTopologyDashboard: React.FC = () => {
  return (
    <div className="w-full h-full" style={{ height: 'calc(100vh - 80px)' }}> {/* Adjust height as needed */}
      <Canvas camera={{ position: [0, 0, 30] }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <NetworkGraph />
        <OrbitControls />
      </Canvas>
    </div>
  );
};

export default NetworkTopologyDashboard;
