import React, { Suspense, useRef, useEffect, useState } from "react";
import { Canvas, useLoader, useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls, Html, Loader } from "@react-three/drei";
import cassetteGLB from "./cassette.glb";

const Model = ({ url, currentTime, playerState}) => {
  const gltf = useLoader(GLTFLoader, url);
  const sprocket1 = useRef();
  const [sprocket2, setSprocket2] = useState(null);

  // Only clone the sprocket after the component has been mounted and glTF has been loaded
  useEffect(() => {
    setSprocket2(gltf.scene.getObjectByName('Sproket').clone(true));
  }, [gltf]);

  useFrame(() => {
    if (playerState=='playing'){
      if (sprocket1.current) {
        sprocket1.current.rotation.y += 0.03;
      }
      if (sprocket2) {
        sprocket2.rotation.y += 0.03;
      }
    }
  });

  const rotation = [Math.PI / 2, -Math.PI / 2, 0];
  const position = [-2, 0, 0];

  return (
    <>
    <primitive object={gltf.scene} rotation={rotation} position={position} />
    <primitive object={gltf.scene.getObjectByName('Sproket')} ref={sprocket1} rotation={rotation} position={[-1.9, 0.2, 0.5]} />
    {sprocket2 && <primitive object={sprocket2} rotation={rotation} position={[2.4, 0.2, 0.5]} />}
    </>
  );
};

const ThreeComponent = ({ currentTime, totalLength, playerState }) => (
  <div style={{ width: '100%', height: '320px' }}>
  <Canvas gl={{ alpha: true, antialias: true, logarithmicDepthBuffer: true }} camera={{ fov: 35, position: [-2, 0, 12] }}>
  <ambientLight intensity={0.9} />
  <directionalLight position={[0, 10, 0]} intensity={1} />
  <spotLight position={[10, 15, 10]} angle={0.3} intensity={3} />
  <Suspense fallback={<Html><Loader /></Html>}>
  <Model url={cassetteGLB} currentTime={currentTime} playerState={playerState}/>
  </Suspense>
  <OrbitControls />
  </Canvas>
  </div>
);

export default ThreeComponent;
