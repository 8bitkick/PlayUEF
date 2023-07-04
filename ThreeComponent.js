import React, { Suspense } from "react";
import { Canvas, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls, Html, Loader } from "@react-three/drei";
import cassetteGLB from "./cassette.glb";

const Model = ({ url }) => {
    const gltf = useLoader(GLTFLoader, url);

    // Set rotation values for x, y, and z axis.
    const rotation = [ Math.PI / 2,  -Math.PI / 2,0]; // Rotate 90 degrees around Y axis
    const position = [ -2,0,0];
    return <primitive object={gltf.scene} rotation={rotation} position={position} />;
};

const ThreeComponent = () => (
  <div style={{ width: '100%', height: '640px' }}> {/* Set the size of the div */}
      <Canvas
      style={{ background: 'blue' }}
       gl={{ alpha: true, antialias: true, logarithmicDepthBuffer: true, bgColor: 'blue' }}
      camera={{ fov: 35, position: [-2,0,12]  }} style={{ width: '100%', height: '100%' }}>

          <ambientLight intensity={0.5} /> {/* Base light */}
  <directionalLight position={[0, 10, 0]} intensity={1}/> {/* Simulate sun light */}
  <spotLight position={[10, 15, 10]} angle={0.3} intensity={3}/> {/* Highlight specific areas */}
          <Suspense fallback={<Html><Loader /></Html>}>
              <Model url={cassetteGLB} />
          </Suspense>
          <OrbitControls />
      </Canvas>
  </div>
);

export default ThreeComponent;
