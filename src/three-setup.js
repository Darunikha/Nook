// The scene code talks to a single global THREE namespace (core plus the few example add-ons it uses),
// so build that namespace from the npm package and expose it before main.js runs.
import * as core from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

window.THREE = { ...core, RoundedBoxGeometry, EffectComposer, RenderPass, ShaderPass, UnrealBloomPass };
