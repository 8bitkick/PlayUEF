import React, { Suspense, useRef } from "react";
import { Canvas, useLoader, useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls, Html, Loader } from "@react-three/drei";
import cassetteGLB from "./cassette.glb";

const Model = ({ url, currentTime }) => {
  const gltf = useLoader(GLTFLoader, url);

  // Get the 'sprocket' object
  const sprocket1 = useRef();
  const sprocket2 = useRef();

  useFrame(() => {
    if (sprocket1.current) {
      sprocket1.current.rotation.y += 0.01;
    }
    if (sprocket2.current) {
      sprocket2.current.rotation.y += 0.01;
    }
  });

  const rotation = [Math.PI / 2, -Math.PI / 2, 0];
  const position = [-2, 0, 0];

  return (
    <>
      <primitive object={gltf.scene} rotation={rotation} position={position} />
      <primitive object={gltf.scene.getObjectByName('Sproket')} ref={sprocket1} rotation={rotation} position={[-1.9, 0.2, 0.5]} />
      <primitive object={gltf.scene.getObjectByName('Sproket').clone(true)} ref={sprocket2} rotation={rotation} position={[2.4, 0.2, 0.5]} />
    </>
  );
};

const ThreeComponent = ({ currentTime }) => (
  <div style={{ width: '100%', height: '640px' }}> {/* Set the size of the div */}
    <Canvas

      gl={{ alpha: true, antialias: true, logarithmicDepthBuffer: true }}
      camera={{ fov: 35, position: [-2, 0, 12] }}>

      <ambientLight intensity={0.5} /> {/* Base light */}
      <directionalLight position={[0, 10, 0]} intensity={1} /> {/* Simulate sun light */}
      <spotLight position={[10, 15, 10]} angle={0.3} intensity={3} /> {/* Highlight specific areas */}
      <Suspense fallback={<Html><Loader /></Html>}>
        <Model url={cassetteGLB} currentTime={currentTime} />
      </Suspense>
      <OrbitControls />
    </Canvas>
  </div>
);

export default ThreeComponent;
