'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

// Vertex Shader pour effet liquide métallique
const vertexShader = `
    uniform float u_time;
    uniform float u_thinking_strength;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    
    // Fonctions utilitaires pour le bruit
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    
    // Fonction de bruit 2D
    float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m;
        m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }
    
    // Fonction de bruit 3D
    float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        
        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        
        i = mod289(i);
        vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0))
                                       + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                                       + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        
        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        
        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
        
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        
        vec4 norm = 1.79284291400159 - 0.85373472095314 * vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        
        vec3 newPosition = position;
        float timeFactor = u_time * 0.15;
        
        // Aucune déformation - sphère parfaitement ronde
        float deformation = 0.0;
        
        // Légère pulsation uniquement quand en mode thinking
        if (u_thinking_strength > 0.1) {
            float pulse = sin(timeFactor * 4.0) * 0.01;
            deformation = pulse * u_thinking_strength;
        }
        
        newPosition += normal * deformation;
        
        vec4 worldPos = modelMatrix * vec4(newPosition, 1.0);
        vWorldPosition = worldPos.xyz;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
`;

// Fragment Shader pour effet métallique liquide avec couleurs attractives
const fragmentShader = `
    uniform float u_time;
    uniform vec2 u_resolution;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    // Fonction de bruit simplifiée et optimisée
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        vec2 freq = p;
        for (int i = 0; i < 4; i++) {
            value += amplitude * noise(freq);
            freq *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }

    // Fonction pour créer des boules liquides simplifiée
    float liquidBall(vec2 pos, vec2 center, float strength, float time) {
        vec2 offset = pos - center;
        float dist = length(offset);
        
        // Ondulations liquides simplifiées
        float wave = sin(dist * 10.0 - time * 5.0) * 0.1 + cos(dist * 8.0 - time * 3.0) * 0.08;
        float liquidDist = dist + wave;
        
        return strength / (liquidDist * liquidDist + 0.01);
    }
    
    // Fusion liquide simplifiée
    float smoothUnion(float d1, float d2, float k) {
        float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
        return mix(d2, d1, h) - k * h * (1.0 - h);
    }

    void main() {
        vec2 st = vUv;
        vec3 color = vec3(0.0);
        
        // Animation temporelle
        float time = u_time * 0.3;
        
        // Sphère centrale avec ondulations subtiles
        vec2 center = vec2(0.5);
        float dist = distance(st, center);
        
        // Ondulations concentriques pour effet glassmorphisme
        float ripple1 = sin(dist * 20.0 - time * 3.0) * 0.02;
        float ripple2 = cos(dist * 15.0 - time * 2.0) * 0.015;
        float ripple3 = sin(dist * 25.0 + time * 1.5) * 0.01;
        
        float totalRipple = ripple1 + ripple2 + ripple3;
        float sphereField = 1.0 / (dist + totalRipple + 0.3);
        
        // Champ principal de la sphère
        float field = smoothstep(0.4, 2.0, sphereField);
        
        // Palette glassmorphisme enrichie
        vec3 primaryBlue = vec3(0.23, 0.51, 0.96);    // #3b82f6
        vec3 lightBlue = vec3(0.58, 0.77, 0.99);      // #93c5fd
        vec3 darkBlue = vec3(0.06, 0.18, 0.44);       // #0f2d70
        vec3 accentPurple = vec3(0.55, 0.36, 0.96);   // #8b5cf6
        vec3 accentYellow = vec3(0.98, 0.75, 0.14);   // #fbbf24
        vec3 glassWhite = vec3(0.95, 0.98, 1.0);      // Blanc translucide
        
        // Mélange dynamique des couleurs basé sur la position et le temps
        float colorMix1 = fbm(st * 3.0 + time);
        float colorMix2 = fbm(st * 2.5 + time * 1.3);
        float colorMix3 = fbm(st * 4.0 + time * 0.8);
        
        // Gradient glassmorphisme avec touches violet/jaune
        float radial = distance(st, vec2(0.5)) * 2.0;
        float angular = atan(st.y - 0.5, st.x - 0.5) + time * 0.1;
        
        // Base bleu glassmorphisme
        color = mix(primaryBlue, lightBlue, smoothstep(0.0, 0.7, radial));
        
        // Touches subtiles de violet et jaune
        float purpleZone = sin(angular * 2.0 + time * 0.5) * 0.5 + 0.5;
        float yellowZone = cos(angular * 1.5 - time * 0.3) * 0.5 + 0.5;
        
        color = mix(color, accentPurple, purpleZone * 0.15 * (1.0 - radial * 0.8));
        color = mix(color, accentYellow, yellowZone * 0.1 * (1.0 - radial * 0.9));
        
        // Reflets subtils
        float highlight = sin(angular * 3.0 + time) * 0.5 + 0.5;
        color = mix(color, glassWhite, highlight * 0.3 * (1.0 - radial));
        
        // Zones plus sombres pour profondeur
        color = mix(color, darkBlue, smoothstep(0.8, 1.2, radial) * 0.4);
        
        // Effet glassmorphisme avec reflets réalistes
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 1.8);
        vec3 fresnelColor = mix(lightBlue, glassWhite, 0.6);
        color += fresnelColor * fresnel * 0.5;
        
        // Intensité avec bords doux glassmorphisme
        float intensity = smoothstep(0.2, 0.8, field);
        
        // Brillance subtile au centre
        float centerGlow = 1.0 - distance(st, vec2(0.5)) * 1.5;
        centerGlow = pow(max(centerGlow, 0.0), 2.0);
        color += glassWhite * centerGlow * 0.3;
        
        // Saturation réduite pour effet glass
        color = mix(vec3(dot(color, vec3(0.299, 0.587, 0.114))), color, 0.8);
        
        // Pulsation très subtile
        float pulse = sin(time * 1.5) * 0.05 + 0.95;
        color *= pulse;
        
        // Alpha pour transparence glassmorphisme
        float alpha = intensity * 0.4 + centerGlow * 0.3;
        alpha = clamp(alpha, 0.1, 0.7);
        
        gl_FragColor = vec4(color, alpha);
    }
`;

// Matériau avancé pour effet liquide métallique
const AdvancedShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
        u_time: { value: 0.0 },
        u_thinking_strength: { value: 0.0 },
        u_resolution: { value: new THREE.Vector2(512, 512) }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
});

function AnimatedOrb({ isThinking }) {
    const meshRef = useRef();
    const groupRef = useRef();

    useFrame((state) => {
        if (meshRef.current) {
            const material = meshRef.current.material;
            material.uniforms.u_resolution.value.set(state.size.width, state.size.height);
            material.uniforms.u_time.value = state.clock.getElapsedTime();
            material.uniforms.u_thinking_strength.value = THREE.MathUtils.lerp(
                material.uniforms.u_thinking_strength.value,
                isThinking ? 1.5 : 0.3,
                0.05
            );
        }
        
        // Rotation très subtile pour glassmorphisme
        if (groupRef.current) {
            groupRef.current.rotation.y += 0.003;
            groupRef.current.rotation.x += 0.002;
            
            // Légère flottaison
            groupRef.current.position.y = Math.sin(state.clock.getElapsedTime() * 0.5) * 0.1;
        }
    });

    return (
        <group ref={groupRef}>
            {/* Sphère glassmorphisme principale */}
            <mesh ref={meshRef} material={AdvancedShaderMaterial} position={[0, 0, 0]}>
                <sphereGeometry args={[4.0, 64, 64]} />
            </mesh>
        </group>
    );
}

export default function OrbComponent({ isThinking }) {
    return (
        <Canvas 
            camera={{ position: [0, 0, 18], fov: 45 }}
            gl={{ 
                alpha: true, 
                antialias: true,
                powerPreference: "high-performance"
            }}
        >
            <ambientLight intensity={0.6} color="#f8fafc" />
            <directionalLight position={[5, 5, 5]} intensity={1.2} color="#3b82f6" />
            <pointLight position={[-5, -5, 5]} intensity={0.8} color="#8b5cf6" />
            <pointLight position={[0, 0, 10]} intensity={0.5} color="#fbbf24" />
            <pointLight position={[3, -3, -3]} intensity={0.4} color="#93c5fd" />
            <AnimatedOrb isThinking={isThinking} />
        </Canvas>
    );
}