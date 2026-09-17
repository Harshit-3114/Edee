'use client';

import { useEffect, useState } from 'react';
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react';

export default function HeroGradient() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setIsDark(media.matches || document.documentElement.classList.contains('dark'));
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  // Colors per spec
  const primary = isDark ? '#D9475C' : '#8B1E2E'; // maroon
  const secondary = isDark ? '#F2BB5D' : '#E8A93A'; // gold
  const background = isDark ? '#121212' : '#FFFFFF';

  return (
    <ShaderGradientCanvas
      style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      pixelDensity={1.5}
      fov={45}
    >
      <ShaderGradient
        type="plane"
        animate="on"
        uSpeed={0.15}
        uStrength={0.6}
        uFrequency={3.5}
        uAmplitude={1}
        color1={primary}
        color2={secondary}
        color3={background}
        grain="on"
        grainBlending={0.08}
        cDistance={30}
        cPolarAngle={110}
        lightType="3d"
        brightness={1}
        enableTransition={true}
        smoothTime={2}
      />
    </ShaderGradientCanvas>
  );
}