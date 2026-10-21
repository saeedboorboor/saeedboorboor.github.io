// Interactive 3D team photo.
// The splat (images/team2026.spz) was reconstructed from images/team2026.jpg with
// Apple's SHARP (https://github.com/apple/ml-sharp) and is rendered with Spark.
// The flat photo stays underneath as the poster and as the fallback.
// Loaded as a classic script (so file:// previews don't hit the module CORS block);
// three.js and Spark come in via import() using the import map in index.html.

(() => {
const stage = document.querySelector('.team-3d-stage');

// SHARP output: OpenCV axes, camera at the origin, 3840x2160 image with fy = 3054.9 px.
const FOV_Y = 2 * Math.atan(1080 / 3054.9) * 180 / Math.PI;
const FOCUS_DEPTH = 3.6;           // metres to the people; the orbit pivots here
const MAX_YAW = 0.32;              // radians either side of the original view
const MAX_PITCH = 0.14;

function hasWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); }
  catch (e) { return false; }
}

async function start() {
  const THREE = await import('three');
  const { SparkRenderer, SplatMesh } = await import('@sparkjsdev/spark');

  const canvas = stage.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0b0f17);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV_Y, 16 / 9, 0.05, 100);
  scene.add(new SparkRenderer({ renderer }));

  const splat = new SplatMesh({ url: stage.dataset.splat });
  splat.quaternion.set(1, 0, 0, 0);  // OpenCV (y down, z forward) -> three.js (y up, z back)
  scene.add(splat);

  const target = new THREE.Vector3(0, 0, -FOCUS_DEPTH);
  let yaw = 0, pitch = 0, goalYaw = 0, goalPitch = 0;
  let touched = false;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // Drag to look around. touch-action: pan-y keeps vertical swipes scrolling the page.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw: goalYaw, pitch: goalPitch };
    touched = true;
    stage.classList.add('is-touched');
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const s = 2.2 / stage.clientWidth;
    goalYaw = THREE.MathUtils.clamp(drag.yaw - (e.clientX - drag.x) * s, -MAX_YAW, MAX_YAW);
    goalPitch = THREE.MathUtils.clamp(drag.pitch + (e.clientY - drag.y) * s, -MAX_PITCH, MAX_PITCH);
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('dblclick', () => { goalYaw = 0; goalPitch = 0; });

  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; })
    .observe(stage);

  renderer.setAnimationLoop((time) => {
    if (!visible) return;
    if (!touched && !reduceMotion) {
      // Gentle sway until the visitor grabs it, so it reads as 3D.
      goalYaw = Math.sin(time / 2600) * 0.16;
      goalPitch = Math.sin(time / 3700) * 0.04;
    }
    yaw += (goalYaw - yaw) * 0.12;
    pitch += (goalPitch - pitch) * 0.12;
    camera.position.set(
      target.x + FOCUS_DEPTH * Math.sin(yaw) * Math.cos(pitch),
      target.y + FOCUS_DEPTH * Math.sin(pitch),
      target.z + FOCUS_DEPTH * Math.cos(yaw) * Math.cos(pitch),
    );
    camera.lookAt(target);
    renderer.render(scene, camera);
  });

  await splat.initialized;
  stage.classList.add('is-3d');
}

if (stage && location.protocol === 'file:') {
  // Browsers can't fetch the .spz from disk; the flat photo stays. Serve the site over http to see it in 3D.
  console.info('3D team photo needs http(s); showing the flat photo.');
} else if (stage && hasWebGL2()) {
  // Only fetch the 17 MB splat once the photo is close to the viewport.
  const io = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    start().catch((err) => console.warn('3D team photo unavailable:', err));
  }, { rootMargin: '400px' });
  io.observe(stage);
}
})();
