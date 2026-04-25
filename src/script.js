import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as dat from 'dat.gui'
import gsap from 'gsap'
import 'animate.css'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import fontData from '../static/helvetiker_regular.typeface.json'

import vertexShader from './shaders/ocean/shader.vert'
import fragmentShader from './shaders/ocean/shader.frag'
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass.js'

import Stats from 'three/examples/jsm/libs/stats.module';


/**
 * Base
 */

// Debug init
const gui = new dat.GUI({ width: 340})
gui.closed = true;
const debugObject = {};
debugObject.depthColor = '#124b72';
debugObject.surfaceColor = '#85a5ff';

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0x000000, 0.25);

// Loading screen

const loadingPlaneUniforms = {
    uAlpha: {value: 1.0}
};

const loadingPlaneGeom = new THREE.PlaneGeometry(2,2,1,1);
const loadingPlaneShader = new THREE.MeshBasicMaterial({color: 0xf00});
const loadingPlaneCustomShader = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
        uAlpha: {value: loadingPlaneUniforms.uAlpha}
    },
    vertexShader: `
    void main(){
        gl_Position = vec4(position, 1.0);
    }
    `,
    fragmentShader: `
    uniform float uAlpha;
    void main(){
        gl_FragColor = vec4(0.0, 0.0, 0.0, uAlpha);
    }
    `
})

const loadingPlaneMesh = new THREE.Mesh(loadingPlaneGeom, loadingPlaneCustomShader);
scene.add(loadingPlaneMesh);

/**
 * Water
 */
// Geometry
const waterGeometry = new THREE.PlaneGeometry(2, 2, 512, 512)

// Material
const waterMaterial = new THREE.MeshStandardMaterial({wireframe: false})


/**
 * Shader Injection
 */

const customUniforms = {
    
    uBigWaveElevation: {value: 0.112},
    uBigWaveFrequency: {value: new THREE.Vector2(4, 1.5)},
    uTime: {value: 0},
    uBigWaveSpeed: {value: new THREE.Vector2(1.46, 0.48)},
    uDepthColor: {value: new THREE.Color(debugObject.depthColor)},
    uSurfaceColor: {value: new THREE.Color(debugObject.surfaceColor)},
    uColorOffset: {value: 0.12},
    uColorMultiplier: {value: 10},
    uDarker: {value: 0.61},

    uSmallWaveElevation: {value: 0.043},
    uSmallWaveFrequency: {value: 6.6},
    uSmallWaveSpeed: {value: 0.54},
    uSmallWaveIterations: {value: 3}   
}

const waterDepthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking
})

waterDepthMaterial.onBeforeCompile = (shader) =>{
    shader.uniforms.uTime = customUniforms.uTime;
    shader.uniforms.uBigWaveElevation = customUniforms.uBigWaveElevation;
    shader.uniforms.uBigWaveFrequency = customUniforms.uBigWaveFrequency;
    shader.uniforms.uBigWaveSpeed = customUniforms.uBigWaveSpeed;
    shader.uniforms.uSmallWaveElevation = customUniforms.uSmallWaveElevation;
    shader.uniforms.uSmallWaveFrequency = customUniforms.uSmallWaveFrequency;
    shader.uniforms.uSmallWaveSpeed = customUniforms.uSmallWaveSpeed;
    shader.uniforms.uSmallWaveIterations = customUniforms.uSmallWaveIterations;

    shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        
    vec4 permute(vec4 x)
    {
        return mod(((x*34.0)+1.0)*x, 289.0);
    }
    vec4 taylorInvSqrt(vec4 r)
    {
        return 1.79284291400159 - 0.85373472095314 * r;
    }
    vec3 fade(vec3 t)
    {
        return t*t*t*(t*(t*6.0-15.0)+10.0);
    }

    float cnoise(vec3 P)
    {
        vec3 Pi0 = floor(P); // Integer part for indexing
        vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
        Pi0 = mod(Pi0, 289.0);
        Pi1 = mod(Pi1, 289.0);
        vec3 Pf0 = fract(P); // Fractional part for interpolation
        vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
        vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
        vec4 iy = vec4(Pi0.yy, Pi1.yy);
        vec4 iz0 = Pi0.zzzz;
        vec4 iz1 = Pi1.zzzz;

        vec4 ixy = permute(permute(ix) + iy);
        vec4 ixy0 = permute(ixy + iz0);
        vec4 ixy1 = permute(ixy + iz1);

        vec4 gx0 = ixy0 / 7.0;
        vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
        gx0 = fract(gx0);
        vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
        vec4 sz0 = step(gz0, vec4(0.0));
        gx0 -= sz0 * (step(0.0, gx0) - 0.5);
        gy0 -= sz0 * (step(0.0, gy0) - 0.5);

        vec4 gx1 = ixy1 / 7.0;
        vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
        gx1 = fract(gx1);
        vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
        vec4 sz1 = step(gz1, vec4(0.0));
        gx1 -= sz1 * (step(0.0, gx1) - 0.5);
        gy1 -= sz1 * (step(0.0, gy1) - 0.5);

        vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
        vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
        vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
        vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
        vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
        vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
        vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
        vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

        vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
        g000 *= norm0.x;
        g010 *= norm0.y;
        g100 *= norm0.z;
        g110 *= norm0.w;
        vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
        g001 *= norm1.x;
        g011 *= norm1.y;
        g101 *= norm1.z;
        g111 *= norm1.w;

        float n000 = dot(g000, Pf0);
        float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
        float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
        float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
        float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
        float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
        float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
        float n111 = dot(g111, Pf1);

        vec3 fade_xyz = fade(Pf0);
        vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
        vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
        float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
        return 2.2 * n_xyz;
    }

    uniform float uBigWaveElevation;
    uniform vec2 uBigWaveFrequency;
    uniform vec2 uBigWaveSpeed;
    uniform float uSmallWaveIterations;
    uniform float uSmallWaveFrequency;
    uniform float uSmallWaveSpeed;
    uniform float uSmallWaveElevation;
    uniform float uTime;

        `
    )

    shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
    #include <begin_vertex>

    float elevation = sin(transformed.x * uBigWaveFrequency.x + (uTime * uBigWaveSpeed.x)) *
                      sin(transformed.y * uBigWaveFrequency.y + (uTime * uBigWaveSpeed.y)) *
                      uBigWaveElevation;

    for(float i = 1.0; i <= 10.0; i++){
        if(i > uSmallWaveIterations) break;
        elevation -= abs(cnoise(vec3(transformed.xy * uSmallWaveFrequency * i, uTime * uSmallWaveSpeed)) * uSmallWaveElevation / i);
    }

    transformed.z += elevation;
        `
    )
}

waterMaterial.onBeforeCompile = (shader) =>{

    shader.uniforms.uTime = customUniforms.uTime;
    shader.uniforms.uBigWaveElevation = customUniforms.uBigWaveElevation;
    shader.uniforms.uBigWaveFrequency = customUniforms.uBigWaveFrequency;
    shader.uniforms.uBigWaveSpeed = customUniforms.uBigWaveSpeed;
    shader.uniforms.uDepthColor = customUniforms.uDepthColor;
    shader.uniforms.uSurfaceColor = customUniforms.uSurfaceColor;
    shader.uniforms.uColorOffset = customUniforms.uColorOffset;
    shader.uniforms.uColorMultiplier = customUniforms.uColorMultiplier;
    shader.uniforms.uDarker = customUniforms.uDarker;
    shader.uniforms.uSmallWaveElevation = customUniforms.uSmallWaveElevation;
    shader.uniforms.uSmallWaveFrequency = customUniforms.uSmallWaveFrequency;
    shader.uniforms.uSmallWaveSpeed = customUniforms.uSmallWaveSpeed;
    shader.uniforms.uSmallWaveIterations = customUniforms.uSmallWaveIterations;



    shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        
    vec4 permute(vec4 x)
    {
        return mod(((x*34.0)+1.0)*x, 289.0);
    }
    vec4 taylorInvSqrt(vec4 r)
    {
        return 1.79284291400159 - 0.85373472095314 * r;
    }
    vec3 fade(vec3 t)
    {
        return t*t*t*(t*(t*6.0-15.0)+10.0);
    }

    float cnoise(vec3 P)
    {
        vec3 Pi0 = floor(P); // Integer part for indexing
        vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
        Pi0 = mod(Pi0, 289.0);
        Pi1 = mod(Pi1, 289.0);
        vec3 Pf0 = fract(P); // Fractional part for interpolation
        vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
        vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
        vec4 iy = vec4(Pi0.yy, Pi1.yy);
        vec4 iz0 = Pi0.zzzz;
        vec4 iz1 = Pi1.zzzz;

        vec4 ixy = permute(permute(ix) + iy);
        vec4 ixy0 = permute(ixy + iz0);
        vec4 ixy1 = permute(ixy + iz1);

        vec4 gx0 = ixy0 / 7.0;
        vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
        gx0 = fract(gx0);
        vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
        vec4 sz0 = step(gz0, vec4(0.0));
        gx0 -= sz0 * (step(0.0, gx0) - 0.5);
        gy0 -= sz0 * (step(0.0, gy0) - 0.5);

        vec4 gx1 = ixy1 / 7.0;
        vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
        gx1 = fract(gx1);
        vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
        vec4 sz1 = step(gz1, vec4(0.0));
        gx1 -= sz1 * (step(0.0, gx1) - 0.5);
        gy1 -= sz1 * (step(0.0, gy1) - 0.5);

        vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
        vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
        vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
        vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
        vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
        vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
        vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
        vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

        vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
        g000 *= norm0.x;
        g010 *= norm0.y;
        g100 *= norm0.z;
        g110 *= norm0.w;
        vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
        g001 *= norm1.x;
        g011 *= norm1.y;
        g101 *= norm1.z;
        g111 *= norm1.w;

        float n000 = dot(g000, Pf0);
        float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
        float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
        float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
        float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
        float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
        float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
        float n111 = dot(g111, Pf1);

        vec3 fade_xyz = fade(Pf0);
        vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
        vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
        float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
        return 2.2 * n_xyz;
    }

    uniform float uBigWaveElevation;
    uniform vec2 uBigWaveFrequency;
    uniform vec2 uBigWaveSpeed;
    uniform float uSmallWaveIterations;
    uniform float uSmallWaveFrequency;
    uniform float uSmallWaveSpeed;
    uniform float uSmallWaveElevation;
    uniform float uTime;

    varying float vElevation;

        `
    )

    shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
    #include <begin_vertex>

    float elevation = sin(transformed.x * uBigWaveFrequency.x + (uTime * uBigWaveSpeed.x)) *
                      sin(transformed.y * uBigWaveFrequency.y + (uTime * uBigWaveSpeed.y)) *
                      uBigWaveElevation;

    for(float i = 1.0; i <= 10.0; i++){
        if(i > uSmallWaveIterations) break;
        elevation -= abs(cnoise(vec3(transformed.xy * uSmallWaveFrequency * i, uTime * uSmallWaveSpeed)) * uSmallWaveElevation / i);
    }

    transformed.z += elevation;
    vElevation = elevation;
        `
    )

    shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>

        varying float vElevation;

        uniform vec3 uDepthColor;
        uniform vec3 uSurfaceColor;
        uniform float uColorOffset;
        uniform float uColorMultiplier;
        uniform float uDarker;
        `
    )

    shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        #include <dithering_fragment>
        float mixStrenth = ((vElevation + uColorOffset) * uColorMultiplier) - uDarker;
        
        vec3 oceanColor = mix(uDepthColor, uSurfaceColor, mixStrenth);
        gl_FragColor *= vec4(oceanColor, opacity);
        // gl_FragColor = vec4(oceanColor, 1.0);
        `
    )
}

waterMaterial.metalness = 0.0;
waterMaterial.roughness = 0;

// Mesh
const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial)
waterMesh.customDepthMaterial = waterDepthMaterial;
waterMesh.rotation.x = - Math.PI * 0.5
// waterMesh.castShadow = true;
waterMesh.receiveShadow = true;

scene.add(waterMesh)

// Lights
const newLight = new THREE.SpotLight('#fff', 6, 12, Math.PI * 0.18, 0.35, 2);
newLight.position.set(2, 1.5, 1.5);
const lightTarget = new THREE.Object3D();
lightTarget.position.set(0, 0.05, 0);
scene.add(lightTarget);
newLight.target = lightTarget;
const lightHelper = new THREE.SpotLightHelper(newLight, 0.5);
newLight.castShadow = true;
newLight.shadow.mapSize.width = 1024;
newLight.shadow.mapSize.height = 1024;
newLight.shadow.radius = 1;
newLight.shadow.bias = -0.001;
newLight.shadow.camera.near = 0.5;
newLight.shadow.camera.far = 15;
scene.add(newLight);

const ambiLight = new THREE.AmbientLight('#fff', 0.3);
scene.add(ambiLight);

// Font stuff

const textureLoader = new THREE.TextureLoader();

// Parse the bundled font directly — no XHR, works in file:// and HTTP.
const fontLoader = new FontLoader();
const font = fontLoader.parse(fontData);
loadingPlaneUniforms.uAlpha.value = 0.0;

let textMesh = null;
{
    const textGeom = new TextGeometry('SLHM', {
        font: font, 
        size: 0.2,
        depth: 0.05,
        height: 0.05,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.01,
        bevelOffset: 0,
        bevelSegments: 5
    });

    const textMaterial = new THREE.MeshStandardMaterial({
        color: '#fff'
    });
    textMesh = new THREE.Mesh(textGeom, textMaterial);
    textMesh.position.y = 0.05;
    textMesh.position.x = 0;
    textMesh.position.z = 0;

    // textMesh.position.set(0,0,0);
    // textMesh.computeBoundingBox();
    textMesh.castShadow = true;
    textMesh.receiveShadow = true;
    scene.add(textMesh);
}

let textCodeMesh = null;
{
    const textGeom = new TextGeometry('Code', {
        font: font, 
        size: 0.07,
        depth: 0.05,
        height: 0.0005,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.005,
        bevelOffset: 0.0,
        bevelSegments: 5
    });

    const textMaterial = new THREE.MeshStandardMaterial({
        color: '#fff'
    });
    textCodeMesh = new THREE.Mesh(textGeom, textMaterial);
    textCodeMesh.position.x = -0.3;
    textCodeMesh.position.y = 0.05;
    textCodeMesh.position.z = 0.4;
    textCodeMesh.rotation.y = 0.3;

    textCodeMesh.castShadow = true;
    textCodeMesh.receiveShadow = true;
    scene.add(textCodeMesh);
}

let textMusicMesh = null;
{
    const textGeom = new TextGeometry('Music', {
        font: font, 
        size: 0.07, 
        depth: 0.05,
        height: 0.0005,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.005,
        bevelOffset: 0,
        bevelSegments: 5
    });

    const textMaterial = new THREE.MeshStandardMaterial({
        color: '#fff'
    });
    textMusicMesh = new THREE.Mesh(textGeom, textMaterial);
    textMusicMesh.position.x = -0.4;
    textMusicMesh.position.y = 0.1;
    textMusicMesh.position.z = -0.1;
    textMusicMesh.rotation.y = 0.3;

    textMusicMesh.castShadow = true;
    textMusicMesh.receiveShadow = true;
    scene.add(textMusicMesh);
}





/**
 * Infobox
 */

// plane approach
const infoPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4,0.5,1),
    new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fff')
    })
);
infoPlane.position.x = -0.6;
infoPlane.position.y = 0.3;
infoPlane.position.z = 0.4;
infoPlane.rotateY(0.35);
infoPlane.receiveShadow = true;
//scene.add(infoPlane);

// 3D Position vectors for clickable objects.
const points = [
    {
        // Code info box
        position: new THREE.Vector3(-0.5, 0.65, 0.4),
        element: document.getElementById('codeInfobox')
    },
    {
        // Music info box
        position: new THREE.Vector3(-0.62, 0.7, -0.1),
        element: document.getElementById('musicInfobox')
    }
]


// Debug parameters

// Bigwave parameters
gui.add(customUniforms.uBigWaveElevation, 'value').min(0).max(1).step(0.001).name('uBigWaveElevation');
gui.add(customUniforms.uBigWaveFrequency.value, 'x').min(0).max(10).step(0.001).name('uBigWaveFrequencyX');
gui.add(customUniforms.uBigWaveFrequency.value, 'y').min(0).max(10).step(0.001).name('uBigWaveFrequencyY');
gui.add(customUniforms.uBigWaveSpeed.value, 'x').min(0).max(4).step(0.001).name('uBigWaveSpeedX');
gui.add(customUniforms.uBigWaveSpeed.value, 'y').min(0).max(4).step(0.001).name('uBigWaveSpeedY');

// Smallwave parameters
gui.add(customUniforms.uSmallWaveElevation, 'value').min(0).max(1).step(0.001).name('uSmallWaveElevation');
gui.add(customUniforms.uSmallWaveFrequency, 'value').min(0).max(30).step(0.001).name('uSmallWaveFrequency');
gui.add(customUniforms.uSmallWaveSpeed, 'value').min(0).max(4).step(0.001).name('uSmallWaveSpeed');
gui.add(customUniforms.uSmallWaveIterations, 'value').min(0).max(10).step(1).name('uSmallWaveIterations');


// Color parameters
gui.add(customUniforms.uColorOffset, 'value').min(0).max(1).step(0.001).name('uColorOffset');
gui.add(customUniforms.uColorMultiplier, 'value').min(0).max(10).step(0.001).name('uColorMultiplier');
gui.add(customUniforms.uDarker, 'value').min(0).max(1).step(0.001).name('uDarker');
gui.addColor(debugObject, 'depthColor').onChange(() => {
    customUniforms.uDepthColor.value.set(debugObject.depthColor)
})
gui.addColor(debugObject, 'surfaceColor').onChange(() => {
    customUniforms.uSurfaceColor.value.set(debugObject.surfaceColor)
})

// Keep controls visible so shader uniforms can be tuned live.
gui.show();


/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
    vertical: window.innerWidth / window.innerHeight > 1.0
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight
    sizes.vertical = sizes.width / sizes.height < 1.0;

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.fov = sizes.vertical ? 90 : 75;
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

function adjustSceneToMobile(){
    if(sizes.vertical){
        points.forEach((el, i) =>{
            el.element.style.fontSize = 12;
        })
    }
}

/**
 * Camera
 */
// Base camera
let camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.set(0.8, 0.5,1.35);
camera.fov = sizes.vertical ? 90 : 75;
camera.up = new THREE.Vector3(0,1,0);
camera.lookAt(0.0, 0.0, 0.0);
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.target = new THREE.Vector3(0.3, 0.2, 0.0);


/**
 * Handle vertical screens
 */
// TPDP: this
// camera.fov = sizes.vertical ? 90 : 75;
// document.getElementsByClassName('text').style.fontSize = 

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true;


/**
 * Intersects
 */

 const mouse = new THREE.Vector2();
 let mouseIntersect = null;
 window.addEventListener('mousemove', (event) =>{
     mouse.x = event.clientX / sizes.width * 2 - 1;
     mouse.y = - (event.clientY / sizes.height) * 2 + 1;
 })

 const raycaster = new THREE.Raycaster();

function focusCamera(mObject, cpox = 0.0, cpoy = 0.1, cpoz = 0.3){
    gsap.to(controls.target, {
        duration: 1, 
        x: mObject.position.x,
        y: mObject.position.y,
        z: mObject.position.z
    });

    gsap.to(camera.position, {
        duration: 1, 
        x: mObject.position.x + cpox,
        y: mObject.position.y + cpoy,
        z: mObject.position.z + cpoz
    });
}


// oh, boy. this is a mess. TODO: generalize into functions somehow.
window.addEventListener('click', ()=>{
    if(mouseIntersect){
        let codeList = document.getElementById('codeInfobox');
        let codeListElements = codeList.getElementsByTagName('li');
        let musicList = document.getElementById('musicInfobox');
        let musicListElements = musicList.getElementsByTagName('li');

        switch(mouseIntersect.object){
        
            // Code object clicked. Changes camera position and target. Adds/removes CSS animation from relevant objects.
            case textCodeMesh:
                for(let i = 0; i < codeListElements.length; i++)  codeListElements[i].classList.add('l' + i);
                for(let i = 0; i < musicListElements.length; i++) musicListElements[i].classList.remove('l' + i);
                codeList.classList.add('scale-up');
                musicList.classList.add('scale-down');
                focusCamera(textCodeMesh, 0.3, 0.1, 0.7);
                document.getElementById("codeInfobox").style.opacity = 0.5;
                document.getElementById("musicInfobox").style.opacity = 0.0;
                break;   

            // Music object clicked. Changes camera position and target. Adds/removes CSS animation from relevant objects.
            case textMusicMesh:
                codeList.classList.add('scale-down');
                musicList.classList.add('scale-up');
                for(let i = 0; i < codeListElements.length; i++)  codeListElements[i].classList.remove('l' + i);
                for(let i = 0; i < musicListElements.length; i++) musicListElements[i].classList.add('l' + i);
                focusCamera(textMusicMesh, 0.3, 0.1, 0.7);
                document.getElementById("codeInfobox").style.opacity = 0.0;
                document.getElementById("musicInfobox").style.opacity = 0.5;
                break;   

            // Title object clicked. Changes camera position and target. Adds/removes CSS animation from relevant objects.
            default:
                codeList.classList.add('scale-down');
                musicList.classList.add('scale-down');
                for(let i = 0; i < codeListElements.length; i++) codeListElements[i].classList.remove('l' + i);
                for(let i = 0; i < musicListElements.length; i++) musicListElements[i].classList.remove('l' + i);
                focusCamera(textMesh, 0.5, 0.3, 1.6);
                document.getElementById("codeInfobox").style.opacity = 0.0;
                document.getElementById("musicInfobox").style.opacity = 0.0;
                break;
            }
        }
})


/**
 * Post-Processing
 */

//  const effectComposer = new EffectComposer(renderer);


/**
 * Animate
 */
const clock = new THREE.Clock()
// const stats = Stats();
// document.body.append(stats.dom);

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()

    // Update controls
    controls.update();


    customUniforms.uTime.value = elapsedTime;

    lightTarget.position.copy(textMesh.position);


    const objectsToTest = [textMesh, textCodeMesh, textMusicMesh];
    if(objectsToTest[0] && objectsToTest[1] && objectsToTest[2]){
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(objectsToTest);

        if(intersects.length){
            mouseIntersect = intersects[0];
        }else{
            mouseIntersect = null;
        }

        for(const inter of intersects) if(inter.object !== textMesh) inter.object.material.color.set('#aaa');
        for(const obj of objectsToTest){
            if(!intersects.find(intersect => intersect.object === obj)){
                obj.material.color.set('#fff');
            }
        }
    }

    for(const point of points){
        const screenPos = point.position.clone();
        screenPos.project(camera);

        const translateX = screenPos.x * sizes.width * 0.5;
        const translateY = -screenPos.y * sizes.height * 0.5;
        point.element.style.transform = `translateX(${translateX}px) translateY(${translateY}px)`;
    }
    // Render
    renderer.render(scene, camera)

    // stats.update();

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()