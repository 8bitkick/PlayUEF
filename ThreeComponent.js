import React, { Suspense } from "react";
import { Canvas, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls, Html, Loader } from "@react-three/drei";
import  cassetteGLB  from "./cassette.glb";

// GLTF Model component
const Model = ({ url }) => {
    const gltf = useLoader(GLTFLoader, url);

    return <primitive object={gltf.scene} />;
}

// Main 3D component
const ThreeComponent = () => (
    <Canvas>
        <ambientLight />
        <Suspense fallback={<Html><Loader /></Html>}>
            <Model url={cassetteGLB} />
        </Suspense>
        <OrbitControls />
    </Canvas>
);

export default ThreeComponent;
