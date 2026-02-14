# Comic Book Shader

A real-time post-processing shader that transforms any 3D scene into comic book art. Combines cel shading, Ben-Day halftone, CMYK misregistration, Sobel outlines, hand-drawn line wobble, and paper texture — all in a single GLSL pass.

Built with [Three.js](https://threejs.org/) and WebGL 2.

[Live Demo](https://comic-book-shader.netlify.app)

## Features

- **6 composable effects** in one fragment shader pass
- **6 style presets**: Comic Book, Pop Art, Noir, Manga, Vintage Print, Clean
- **Interactive lens**: click-and-hold reveals a contrasting style with organic blob physics
- **Two demo scenes**: geometric shapes and a DamagedHelmet GLB model
- **Fully responsive** with mobile/tablet support and Safari safe area handling

## Installation

```bash
npm install
npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173). Requires Node.js 18+.

## Project Structure

```
src/
  comic/
    ComicShader.ts   — GLSL fragment shader (all 6 effects + lens modes)
    ComicPass.ts     — Three.js post-processing pass (normal buffer + uniform wiring)
    ComicScene.ts    — Demo scene: geometric shapes
    HelmetScene.ts   — Demo scene: DamagedHelmet GLB model
  engine/
    Engine.ts        — Renderer, camera, controls, composer, resize handling
  main.ts            — Entry point: presets, UI, animations, render loop
  style.css          — Styling + responsive breakpoints
```

## How It Works

The shader runs as a single post-processing pass after the 3D scene renders:

1. **RenderPass** renders the scene into a color buffer + depth texture
2. **ComicPass** renders the scene again with `MeshNormalMaterial` into a normal buffer
3. The fragment shader reads all three buffers (color, normals, depth) and applies effects in sequence: wobble → cel shading → halftone → saturation → outlines → CMYK → paper

Each effect can be toggled and tuned independently via uniforms. Presets animate smoothly between configurations.

## Credits

- [Three.js](https://threejs.org/)
- [DamagedHelmet](https://github.com/KhronosGroup/glTF-Sample-Models) by KhronosGroup (CC BY 4.0)
- [lil-gui](https://lil-gui.georgealways.com/)

## License

[MIT](LICENSE)
