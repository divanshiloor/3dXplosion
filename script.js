import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { extendMaterial } from '@callumacrae/utils/three-extend-material';
import { easePolyInOut } from 'd3-ease';
import { toVanillaCanvas } from '@callumacrae/utils/renderers/vanilla.js';
const glsl = String.raw;
const sketchConfig = {};
const sketchbookConfig = {
    type: 'threejs',
    sketchConfig,
};
function initCamera(scene, { width, height }) {
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 300;
    camera.position.y = 120;
    scene.add(camera);
    return camera;
}
function initLighting(scene) {
    const pos = new THREE.Vector3(100, 150, 100);
    const pointLight = new THREE.PointLight(0xffffff, 0.25);
    pointLight.position.set(pos.x, pos.y, pos.z);
    pointLight.castShadow = true;
    pointLight.shadow.camera.far = 1500;
    pointLight.shadow.radius = 20;
    pointLight.shadow.blurSamples = 16;
    scene.add(pointLight);
    // Duplicate the light so that the shadow is less intense
    const pointLightWithoutShadow = pointLight.clone();
    pointLightWithoutShadow.intensity = 0.4;
    pointLightWithoutShadow.castShadow = false;
    scene.add(pointLightWithoutShadow);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const easeFnZ = easePolyInOut.exponent(7);
    const easeFnX = easePolyInOut.exponent(3);
    const frame = ({ timestamp }) => {
        const tz = (timestamp / 1500 + 0.5) % 1;
        const z = (-tz + easeFnZ(tz)) * 300 + pos.z;
        pointLight.position.setZ(z);
        pointLightWithoutShadow.position.setZ(z);
        const tx = Math.abs(((timestamp / 1500 + 0.5) % 2) - 1);
        const x = (easeFnX(tx) * 2 - 1) * pos.x;
        pointLight.position.setX(x);
        pointLightWithoutShadow.position.setX(x);
    };
    return { frame };
}
function initFloor(scene) {
    const geometry = new THREE.PlaneGeometry(4000, 4000);
    geometry.rotateX(Math.PI / -2);
    geometry.translate(0, -10, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0x0178ae });
    const floor = new THREE.Mesh(geometry, material);
    floor.receiveShadow = true;
    scene.add(floor);
    scene.background = new THREE.Color(0x04537a);
    scene.fog = new THREE.Fog(0x04537a, 300, 500);
}
/**
 * Converts geometry to non-indexed and orders the triangles based on their
 * x position for a more graceful transition.
 */
function initGeometry(geometry) {
    const g = geometry.toNonIndexed();
    const triangleCount = g.attributes.position.count / 3;
    const triangles = new Array(triangleCount);
    for (let i = 0; i < triangleCount; i++) {
        triangles[i] = { index: i };
    }
    const posAry = g.attributes.position.array;
    function getCenter(cache) {
        if (!cache.center) {
            const i = cache.index;
            cache.center = [
                (posAry[i * 9] + posAry[i * 9 + 3] + posAry[i * 9 + 6]) / 3,
                (posAry[i * 9 + 1] + posAry[i * 9 + 4] + posAry[i * 9 + 7]) / 3,
                (posAry[i * 9 + 2] + posAry[i * 9 + 5] + posAry[i * 9 + 8]) / 3,
            ];
        }
        return cache.center;
    }
    triangles.sort((a, b) => {
        const aCenter = getCenter(a);
        const bCenter = getCenter(b);
        return aCenter[0] - bCenter[0];
    });
    const orderedPositions = new Float32Array(g.attributes.position.count * 3);
    const orderedNormals = new Float32Array(g.attributes.normal.count * 3);
    for (let i = 0; i < triangleCount; i++) {
        const fromI = triangles[i].index;
        for (let j = 0; j < 9; j++) {
            orderedPositions[i * 9 + j] = g.attributes.position.array[fromI * 9 + j];
            orderedNormals[i * 9 + j] = g.attributes.normal.array[fromI * 9 + j];
        }
    }
    g.attributes.position = new THREE.BufferAttribute(orderedPositions, 3);
    g.attributes.normal = new THREE.BufferAttribute(orderedNormals, 3);
    return g;
}
async function initLetters(scene, _props) {
    var _a, _b;
    const loader = new GLTFLoader();
    const textScene = await loader.loadAsync('https://sketchbook-2.macr.ae/exploding-text/hello-world.glb');
    const helloMesh = textScene.scene.getObjectByName('Hello_mesh');
    if (!(helloMesh instanceof THREE.Mesh))
        throw new Error('???');
    helloMesh.rotateX(Math.PI);
    helloMesh.translateY(-10);
    // helloMesh.receiveShadow = true;
    helloMesh.castShadow = true;
    scene.add(helloMesh);
    const worldMesh = textScene.scene.getObjectByName('World_mesh');
    if (!(worldMesh instanceof THREE.Mesh))
        throw new Error('???');
    const helloGeo = initGeometry(helloMesh.geometry);
    helloMesh.geometry = helloGeo;
    const worldGeo = initGeometry(worldMesh.geometry);
    worldGeo.translate(0.8, 0, 0);
    const aWorldPosition = new Float32Array(helloGeo.attributes.position.count * 3);
    for (let i = 0; i < aWorldPosition.length / 3; i++) {
        for (let j = 0; j < 3; j++) {
            aWorldPosition[i * 3 + j] =
                (_a = worldGeo.attributes.position.array[i * 3 + j]) !== null && _a !== void 0 ? _a : worldGeo.attributes.position.array[worldGeo.attributes.position.count * 3 - 3 + j];
        }
    }
    const aWorldNormal = new Float32Array(helloGeo.attributes.normal.count * 3);
    for (let i = 0; i < aWorldNormal.length; i++) {
        aWorldNormal[i] = (_b = worldGeo.attributes.normal.array[i]) !== null && _b !== void 0 ? _b : 0;
    }
    helloMesh.geometry.setAttribute('aWorldPosition', new THREE.BufferAttribute(aWorldPosition, 3));
    helloMesh.geometry.setAttribute('aWorldNormal', new THREE.BufferAttribute(aWorldNormal, 3));
    helloMesh.material = extendMaterial(THREE.MeshPhongMaterial, {
        class: THREE.ShaderMaterial,
        vertexHeader: glsl `
      uniform float uTime;
      attribute vec3 aWorldPosition;
      attribute vec3 aWorldNormal;

      float easeInOut(float x, float ease) {
        return x < 0.5 ?
          pow(2.0, ease - 1.0) * pow(x, ease) :
          1.0 - pow(-2.0 * x + 2.0, ease) / 2.0;
      }
    `,
        vertex: {
            'void main() {': glsl `
        float timeWithOffset = uTime - aWorldPosition.x / 50.0;
        float mixVal = easeInOut(abs(mod(timeWithOffset, 2.0) - 1.0), 7.0);
      `,
            '#include <beginnormal_vertex>': glsl `
        objectNormal = mix(objectNormal, aWorldNormal, mixVal);
      `,
            transformEnd: glsl `
        transformed = mix(transformed, aWorldPosition, mixVal);
        float modTime = mod(timeWithOffset, 1.0);
        transformed.y += (-modTime + easeInOut(modTime, 7.0)) * -3.0;
      `,
        },
        material: {
            side: THREE.DoubleSide,
        },
        uniforms: {
            uTime: {
                mixed: true,
                linked: true,
                value: 0,
            },
            diffuse: {
                value: new THREE.Color(0xefd152),
            },
        },
    });
    helloMesh.material.customDepthMaterial = extendMaterial(THREE.MeshDepthMaterial, { template: helloMesh.material });
    helloMesh.material.customDistanceMaterial = extendMaterial(THREE.MeshDistanceMaterial, { template: helloMesh.material });
    const frame = ({ timestamp }) => {
        helloMesh.material.uniforms.uTime.value = timestamp / 1500 + 0.5;
    };
    return { frame };
}
const init = async (props) => {
    if (!props.renderer)
        throw new Error('???');
    props.renderer.shadowMap.enabled = true;
    // props.initControls(({ pane, config }) => {});
    const scene = new THREE.Scene();
    const camera = initCamera(scene, props);
    const controls = new OrbitControls(camera, props.renderer.domElement);
    controls.maxPolarAngle = Math.PI / 2.05;
    const lighting = initLighting(scene);
    initFloor(scene);
    const letters = await initLetters(scene, props);
    return { scene, camera, lighting, letters };
};
const frame = (props) => {
    const { renderer, config, state } = props;
    if (!renderer || !config)
        throw new Error('???');
    state.lighting.frame(props);
    state.letters.frame(props);
    renderer.render(state.scene, state.camera);
};
const canvasEl = document.querySelector('#canvas');
export default toVanillaCanvas(canvasEl, init, frame, sketchbookConfig);