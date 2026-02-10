# Comic Book Shader — Codrops Publication Plan

## Current State Assessment

### What's Working
- **Shader technique is strong**: 6 composable print/comic effects in a single fullscreen pass (wobble, cel shading, halftone, outlines, CMYK misregistration, paper texture)
- **Presets are well-tuned**: Comic Book, Pop Art, Noir, Manga, Vintage Print, Clean — each feels distinct
- **Animated transitions**: Smooth 600ms cubic ease-out interpolation between presets
- **Performance**: Single-pass post-processing, procedural noise (no texture lookups), efficient pipeline
- **Educational value**: The composable multi-effect approach is genuinely teachable
- **Hover lens effect**: Wobbly blob follows cursor, revealing an alternate rendering mode inside — 3 modes available (Pencil Sketch, X-Ray normals, Void). Blob has organic wobble, meteor-like directional deformation on fast moves, and dynamic sizing (big at rest, shrinks on movement). Ink border ring with variable thickness.
- **Touch support**: Lens appears on press, follows finger, disappears on lift
- **Reveal animation**: Scene starts raw, flash-reveals with Comic Book preset after 1.2s

### What's Not Working
- **Scene could be stronger**: Geometric primitives work but aren't the most compelling subject — potential to upgrade later
- **Developer UI**: lil-gui control panel is a dev tool, not a designed experience
- **No mobile layout**: No responsive layout, no touch-specific UI arrangement
- **No preloader**: Codrops requires a loading state
- **Missing Codrops template integration**: No frame links, no meta tags

---

## How Codrops Selects Content

### The Process
1. **Pitch via email** to `contact@codrops.com` with a working prototype
2. **Editor is Manoela Ilic** (@crnacura) — she personally curates all content
3. They publish **~1 tutorial/week** (51 in 2025). High bar.
4. If accepted, you get a WordPress contributor account and pick a publish date
5. You write the article in their CMS following their structure
6. Demo code goes on a **private GitHub repo** shared with `crnacura`, set to public before publish
7. **All code is MIT licensed**

### What They Value
- **Smoothness**: Manoela has said demos stay unpublished because "they don't feel smooth enough" — cross-browser, cross-OS performance is the #1 technical filter
- **Creative vision**: Novel techniques applied to compelling subjects
- **Educational depth**: Reasoning and process, not just code dumps
- **Authenticity**: Your voice, your story. AI assistance for polishing only, must be disclosed
- **Exclusivity**: Content cannot be republished elsewhere in similar form
- **Accessibility**: prefers-reduced-motion, semantic markup, keyboard navigation

### Tutorial Article Structure (Required)
1. **Introduction** — What readers learn, why it matters, tools used
2. **Concept** — Design inspiration, creative reasoning before code
3. **Implementation** — Focused code snippets with explanations of underlying logic
4. **Refinement** — Responsive design, performance optimization
5. **Accessibility** — Motion preferences, contrast, input alternatives
6. **Wrap-Up** — Summary, final results, resource links, credits

### Recent Comparable Publications
- "WebGPU Gommage Effect: Dissolving MSDF Text into Dust and Petals" (Jan 2026)
- "Building an Endless Procedural Snake with Three.js" (Feb 2026)
- "Pixel-to-Voxel Video Drop Effect" (Jan 2026)
- "Interactive Droplet-like Metaballs with Three.js and GLSL" (Jun 2025)
- "Animating Letters with Shaders: Interactive Text Effect" (Mar 2025)

All have: a clear creative concept, mouse/scroll interactivity, polished presentation, and compelling subject matter.

---

## The Plan

### Phase 1: Scene Upgrade (Consider Later)

Current geometric primitives scene works well enough — the shader effects are the star. Typography scene was tried and abandoned (didn't look good). Scene upgrade is lower priority now that the lens interaction adds visual interest.

Options if revisited:
- Single hero model (character bust, retro car) from Sketchfab CC0
- Comic panel layout with mini-scenes
- Keep current scene but add more interesting geometry

### Phase 2: Mouse Interactivity — DONE

**Hover Lens Effect** (implemented):
- Wobbly organic blob follows cursor with smooth lerp (0.15)
- 3 rendering modes inside the lens, toggled via click or keyboard 1/2/3:
  - **Pencil Sketch**: Cross-hatched graphite on paper with wobbly pencil outlines
  - **X-Ray (Normals)**: Rainbow normal map with scanlines
  - **Void**: Dark void with glowing cyan/blue edges, grid, floating particles
- Meteor deformation: blob stretches into a comet shape on fast cursor movement (directional dot product with velocity)
- Dynamic sizing: big blob at rest (0.14), shrinks on movement (down to 0.045)
- All deformation scales with radius so shrinking blob stays proportional
- Ink border ring with noise-driven variable thickness
- Touch support: appears on press, follows finger, disappears on lift

**Tried and rejected**:
- Ink ripple on click — looked like a generic sun effect, no story
- Wobble follows cursor — animation without meaning
- Lens showing contrasting preset — not impressive enough

### Phase 3: UI Redesign

**Kill lil-gui. Build custom minimal UI.**

Layout:
```
┌─────────────────────────────────────────────┐
│ [Comic Book Logo/Title]          [⚙ toggle] │
│ [subtitle]                                   │
│                                              │
│              [3D SCENE]                      │
│                                              │
│                                              │
│ [COMIC] [POP ART] [NOIR] [MANGA] [VINTAGE]  │
│                              [CLEAN]         │
└─────────────────────────────────────────────┘
```

- Preset buttons stay (they're good) but restyle to feel more comic-book: bold borders, skewed/rotated slightly, comic font
- The gear icon toggles an advanced panel that slides in from the right (replaces lil-gui)
- Custom sliders styled with comic aesthetics (thick borders, flat colors, Bangers font for labels)
- Add a subtle "CLICK ANYWHERE" prompt that fades after first interaction

### Phase 4: Loading & Reveal Experience

1. **Preloader**: Show a comic-style loading animation
   - "LOADING..." in Bangers font with animated halftone dots expanding
   - Or a progress bar styled as a comic panel border being drawn
   - Add `loading` class to body, remove when ready (Codrops requirement)

2. **Enhanced reveal sequence**:
   - Scene starts as plain 3D (raw geometry, no shader effects)
   - After load: panels/text "draw themselves" — outlines sweep across the scene from left to right
   - Then cel shading fades in, then halftone, then paper texture
   - Each effect activates with a comic-style sound word ("KAPOW!" flash as outlines appear)
   - Total duration: ~2.5s

### Phase 5: Responsive & Mobile

1. **Responsive layout**: Stack preset buttons vertically on mobile, move title to top-center
2. **Touch interaction**: Tap = click ripple effect, two-finger pinch = zoom
3. **Performance tier detection**: On mobile/low-end, reduce halftone sampling, disable paper FBM (use 2 octaves instead of 4), reduce shadow map to 1024
4. **Viewport meta tag** already present — ensure canvas renders at correct DPR on mobile (already capped at 2)

### Phase 6: Polish & Codrops Compliance

1. **Integrate CodropsTemplate**: Add frame links (demo source, article link, back-to-article)
2. **Add OG meta tags**: Title, description, preview image (screenshot of Pop Art preset)
3. **prefers-reduced-motion**: Already added CSS. Also skip the reveal animation and preset transitions for reduced-motion users (instant apply)
4. **Keyboard navigation**: Tab through presets, Enter to activate, Escape to close settings panel
5. **Semantic HTML**: Use `<nav>` for presets, `<aside>` for controls, `<main>` for canvas wrapper
6. **Performance audit**: Test on Chrome, Firefox, Safari. Test on iPhone Safari and Android Chrome. Target 60fps on 2-year-old hardware.
7. **Relative paths in build**: Vite base config for Codrops deployment
8. **Clean up dead code**: Remove `shaders/` directory (legacy GLSL1 files not used at runtime)

### Phase 7: Write the Tutorial Article

Structure following Codrops' required format:

**Title**: "Creating a Comic Book Post-Processing Shader with Three.js and GLSL"

**1. Introduction**
- What we're building: a composable post-processing pipeline that transforms any 3D scene into comic book art
- Why this approach: single-pass, real-time, 6 independent effects that can be mixed
- Tools: Three.js, GLSL 3.0 ES, EffectComposer, custom Pass

**2. Concept**
- Comic book visual language: outlines, flat color, halftone, paper texture, printing artifacts
- Reference images from actual comics (golden age, manga, pop art, noir)
- The idea of decomposing a visual style into independent, composable layers

**3. Implementation** (the bulk — teach each effect)
- Setting up the render pipeline (normal buffer + depth buffer)
- Effect 1: Sobel edge detection on normals + depth
- Effect 2: Cel shading with luminance quantization
- Effect 3: Halftone dot pattern with rotation
- Effect 4: Hand-drawn wobble via procedural noise
- Effect 5: CMYK misregistration (printing plate offsets)
- Effect 6: Paper texture with FBM
- Composing effects: order matters (wobble first because it perturbs UVs)
- Adding mouse interactivity to the shader

**4. Refinement**
- Performance: single-pass efficiency, texture read budgeting
- Preset system: interpolating uniforms with easing
- Mobile: adaptive quality, touch handling

**5. Accessibility**
- prefers-reduced-motion: skip animations, instant preset application
- Keyboard navigation for all controls
- Sufficient contrast on UI elements
- Screen reader labels for controls

**6. Wrap-Up**
- Summary of techniques
- Ideas for extension (speech bubbles, panel layouts, speed lines)
- Links to resources (Three.js docs, GLSL references, comic art history)

---

## Implementation Priority & Timeline

| Priority | Task | Impact | Effort | Status |
|----------|------|--------|--------|--------|
| **P0** | ~~Add mouse interactivity (Phase 2)~~ | High | Medium | **DONE** |
| **P0** | Finalize lens mode (pick best of 3) | High | Low | **Testing** |
| **P1** | Custom UI replacing lil-gui (Phase 3) | High | Medium | Pending |
| **P1** | Loading + reveal sequence (Phase 4) | Medium | Low | Pending |
| **P1** | Mobile responsive (Phase 5) | Medium | Medium | Pending |
| **P1** | Scene upgrade (Phase 1) | Medium | Medium | Deferred |
| **P2** | Codrops template + meta + a11y (Phase 6) | Required | Low | Pending |
| **P2** | Write the tutorial article (Phase 7) | Required | High | Pending |

**Estimated probability after all phases: ~65-70%** for a tutorial article acceptance.

The technique is genuinely educational and novel enough. The key is transforming the presentation from "developer sandbox" to "designed creative experience."

---

## Submission Strategy

1. Complete Phases 1-6
2. Deploy to a public URL (Vercel/Netlify)
3. Email `contact@codrops.com` with:
   - Link to live demo
   - 2-3 sentence pitch: "Composable comic book post-processing shader — 6 print techniques in one GLSL pass, with interactive mouse effects and preset system. Would love to write a tutorial breaking down each technique."
   - Mention you'd write the article following their tutorial structure
4. If accepted, follow their contributor workflow (WordPress, GitHub repo shared with crnacura, pick publish date)
5. Write article, submit 7 days before publish date
