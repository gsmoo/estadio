import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const SEAT_STATES = {
  FREE: 0,
  RESERVED: 1,
  OCCUPIED: 2,
};

const SEAT_COLORS = {
  [SEAT_STATES.FREE]: new THREE.Color('#55c271'),
  [SEAT_STATES.RESERVED]: new THREE.Color('#f0b43c'),
  [SEAT_STATES.OCCUPIED]: new THREE.Color('#d95c5c'),
  hover: new THREE.Color('#f8f4ee'),
  selected: new THREE.Color('#69b7ff'),
};

const STADIUM_CONFIG = {
  targetSeatCount: 80000,
  bowlSections: [
    { key: 'NORTE-A', type: 'straight', startAngle: -0.39, endAngle: -0.13, minSeats: 23, maxSeats: 29 },
    { key: 'NORTE-B', type: 'straight', startAngle: -0.13, endAngle: 0.13, minSeats: 23, maxSeats: 29 },
    { key: 'NORTE-C', type: 'straight', startAngle: 0.13, endAngle: 0.39, minSeats: 23, maxSeats: 29 },
    { key: 'NORESTE-A', type: 'curve', startAngle: 0.39, endAngle: 0.78, minSeats: 20, maxSeats: 36 },
    { key: 'ESTE-A', type: 'straight', startAngle: 0.78, endAngle: 1.06, minSeats: 23, maxSeats: 29 },
    { key: 'ESTE-B', type: 'straight', startAngle: 1.06, endAngle: 1.34, minSeats: 23, maxSeats: 29 },
    { key: 'ESTE-C', type: 'straight', startAngle: 1.34, endAngle: 1.62, minSeats: 24, maxSeats: 30 },
    { key: 'SURESTE-A', type: 'curve', startAngle: 1.62, endAngle: 2.01, minSeats: 20, maxSeats: 36 },
    { key: 'SUR-A', type: 'straight', startAngle: 2.01, endAngle: 2.27, minSeats: 23, maxSeats: 29 },
    { key: 'SUR-B', type: 'straight', startAngle: 2.27, endAngle: 2.53, minSeats: 23, maxSeats: 29 },
    { key: 'SUR-C', type: 'straight', startAngle: 2.53, endAngle: 2.79, minSeats: 23, maxSeats: 29 },
    { key: 'SUROESTE-A', type: 'curve', startAngle: 2.79, endAngle: 3.18, minSeats: 20, maxSeats: 36 },
    { key: 'OESTE-A', type: 'straight', startAngle: 3.18, endAngle: 3.46, minSeats: 24, maxSeats: 30 },
    { key: 'OESTE-B', type: 'straight', startAngle: 3.46, endAngle: 3.74, minSeats: 24, maxSeats: 30 },
    { key: 'OESTE-C', type: 'straight', startAngle: 3.74, endAngle: 4.02, minSeats: 24, maxSeats: 30 },
    { key: 'NOROESTE-A', type: 'curve', startAngle: 4.02, endAngle: 4.41, minSeats: 20, maxSeats: 36 },
    { key: 'NORTE-D', type: 'straight', startAngle: 4.41, endAngle: 4.67, minSeats: 24, maxSeats: 30 },
    { key: 'NORTE-E', type: 'straight', startAngle: 4.67, endAngle: 4.93, minSeats: 24, maxSeats: 30 },
    { key: 'NORTE-F', type: 'straight', startAngle: 4.93, endAngle: 5.19, minSeats: 24, maxSeats: 30 },
    { key: 'NORESTE-B', type: 'curve', startAngle: 5.19, endAngle: 5.58, minSeats: 20, maxSeats: 36 },
    { key: 'ESTE-D', type: 'straight', startAngle: 5.58, endAngle: 5.82, minSeats: 24, maxSeats: 30 },
    { key: 'ESTE-E', type: 'straight', startAngle: 5.82, endAngle: 6.043185307179586, minSeats: 24, maxSeats: 30 },
  ],
  ringCount: 4,
  rowsPerRing: 40,
  ringGapDepth: 5.4,
  rowDepth: 0.92,
  rowRise: 0.2,
  aisleEvery: 20,
  aisleWidth: 1.45,
  sectionGap: 2.4,
  innerRadius: 30,
  fieldWidth: 42,
  fieldHeight: 28,
};

const DEBUG_RENDER = {
  showCenterProbe: false,
};

class SeatRepository {
  constructor(layout) {
    this.layout = layout;
    this.states = new Uint8Array(layout.length);

    for (let index = 0; index < layout.length; index += 1) {
      if (index % 11 === 0) {
        this.states[index] = SEAT_STATES.OCCUPIED;
      } else if (index % 5 === 0) {
        this.states[index] = SEAT_STATES.RESERVED;
      }
    }
  }

  get count() {
    return this.layout.length;
  }

  getSeat(instanceId) {
    return this.layout[instanceId];
  }

  getState(instanceId) {
    return this.states[instanceId];
  }

  setState(instanceId, state) {
    this.states[instanceId] = state;
  }
}

function pad(value, size) {
  return String(value).padStart(size, '0');
}

function buildSeatId(sectionName, rowIndex, seatNumber) {
  return `${sectionName}-R${pad(rowIndex + 1, 3)}-S${pad(seatNumber, 3)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createRowPlans(config) {
  const {
    bowlSections,
    ringCount,
    rowsPerRing,
    ringGapDepth,
    rowDepth,
    rowRise,
    innerRadius,
  } = config;

  const rowPlans = [];

  for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
    const ringRowOffset = ringIndex * rowsPerRing;
    const ringRadiusOffset = ringIndex * (rowsPerRing * rowDepth + ringGapDepth);

    for (const section of bowlSections) {
      const sectionCenter = (section.startAngle + section.endAngle) * 0.5;
      const sectionArc = section.endAngle - section.startAngle;
      const sectionName = `${section.key}-ANF${ringIndex + 1}`;

      for (let localRowIndex = 0; localRowIndex < rowsPerRing; localRowIndex += 1) {
        const rowIndex = ringRowOffset + localRowIndex;
        const rowRadius = innerRadius + ringRadiusOffset + localRowIndex * rowDepth;
        const rowProgress =
          rowsPerRing === 1 ? 0 : localRowIndex / (rowsPerRing - 1);
        const baseSeats = Math.round(
          section.minSeats + (section.maxSeats - section.minSeats) * rowProgress,
        );

        rowPlans.push({
          sectionName,
          sectionCenter,
          sectionArc,
          rowIndex,
          rowRadius,
          rowY: rowIndex * rowRise,
          seatsPerRow: baseSeats,
          minSeats: section.minSeats,
          maxSeats: section.maxSeats,
          type: section.type,
        });
      }
    }
  }

  return rowPlans;
}

function fitRowPlansToTarget(rowPlans, targetSeatCount) {
  let currentSeatCount = rowPlans.reduce((sum, rowPlan) => sum + rowPlan.seatsPerRow, 0);

  if (currentSeatCount === targetSeatCount) {
    return rowPlans;
  }

  const priorities = [...rowPlans].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'curve' ? -1 : 1;
    }

    return right.rowIndex - left.rowIndex;
  });

  while (currentSeatCount < targetSeatCount) {
    let changed = false;

    for (const rowPlan of priorities) {
      const additionalCapacity = rowPlan.type === 'curve' ? 16 : 8;
      const rowMax = rowPlan.maxSeats + additionalCapacity;

      if (rowPlan.seatsPerRow >= rowMax) {
        continue;
      }

      rowPlan.seatsPerRow += 1;
      currentSeatCount += 1;
      changed = true;

      if (currentSeatCount === targetSeatCount) {
        break;
      }
    }

    if (!changed) {
      break;
    }
  }

  while (currentSeatCount > targetSeatCount) {
    let changed = false;

    for (let index = priorities.length - 1; index >= 0; index -= 1) {
      const rowPlan = priorities[index];

      if (rowPlan.seatsPerRow <= rowPlan.minSeats) {
        continue;
      }

      rowPlan.seatsPerRow -= 1;
      currentSeatCount -= 1;
      changed = true;

      if (currentSeatCount === targetSeatCount) {
        break;
      }
    }

    if (!changed) {
      break;
    }
  }

  return rowPlans;
}

function generateStadiumLayout(config) {
  const {
    targetSeatCount,
    aisleEvery,
    aisleWidth,
    sectionGap,
  } = config;

  const rowPlans = fitRowPlansToTarget(createRowPlans(config), targetSeatCount);
  const layout = [];
  let instanceId = 0;

  for (const rowPlan of rowPlans) {
    const seatArcLength = rowPlan.rowRadius * rowPlan.sectionArc - sectionGap * 2;
    const blockCount = Math.ceil(rowPlan.seatsPerRow / aisleEvery);
    const aisleCount = Math.max(0, blockCount - 1);
    const usableArcLength = seatArcLength - aisleCount * aisleWidth;
    const actualSeatWidth = usableArcLength / rowPlan.seatsPerRow;
    const seatOffsetStart =
      -((usableArcLength + aisleCount * aisleWidth) * 0.5);

    for (let seatIndex = 0; seatIndex < rowPlan.seatsPerRow; seatIndex += 1) {
      const aisleIndex = Math.floor(seatIndex / aisleEvery);
      const aisleOffset = aisleIndex * aisleWidth;
      const seatOffset =
        seatOffsetStart + aisleOffset + actualSeatWidth * (seatIndex + 0.5);
      const theta = rowPlan.sectionCenter + seatOffset / rowPlan.rowRadius;
      const x = Math.cos(theta) * rowPlan.rowRadius;
      const z = Math.sin(theta) * rowPlan.rowRadius;

      layout.push({
        instanceId,
        seatId: buildSeatId(rowPlan.sectionName, rowPlan.rowIndex, seatIndex + 1),
        section: rowPlan.sectionName,
        row: rowPlan.rowIndex + 1,
        number: seatIndex + 1,
        position: new THREE.Vector3(x, rowPlan.rowY, z),
        rotationY: -theta + Math.PI * 0.5,
      });

      instanceId += 1;
    }
  }

  return layout;
}

async function loadSeatTemplate() {
  const loader = new GLTFLoader();
  const useDebugSeat = false;

  if (useDebugSeat) {
    const geometry = new THREE.BoxGeometry(0.56, 0.92, 0.62);
    geometry.translate(0, 0.46, 0);

    return [
      {
        geometry,
        material: new THREE.MeshBasicMaterial({
          color: '#ffffff',
          vertexColors: false,
          toneMapped: false,
        }),
      },
    ];
  }

  const gltf = await loader.loadAsync('/models/seat.glb');
  const templateMeshes = [];
  const bounds = new THREE.Box3();

  gltf.scene.updateMatrixWorld(true);

  gltf.scene.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    const geometry = child.geometry.clone();
    geometry.applyMatrix4(child.matrixWorld);
    geometry.deleteAttribute('color');
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    bounds.union(geometry.boundingBox);
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      vertexColors: false,
      toneMapped: false,
    });

    templateMeshes.push({
      geometry,
      material,
    });
  });

  if (templateMeshes.length === 0) {
    throw new Error('El modelo no contiene meshes renderizables.');
  }

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  const maxDimension = Math.max(size.x, size.y, size.z);
  const targetHeight = 0.95;
  const scale = maxDimension > 0 ? targetHeight / maxDimension : 1;
  const normalizeMatrix = new THREE.Matrix4()
    .makeTranslation(-center.x, -bounds.min.y, -center.z)
    .multiply(new THREE.Matrix4().makeScale(scale, scale, scale));

  for (const template of templateMeshes) {
    template.geometry.applyMatrix4(normalizeMatrix);
    template.geometry.computeBoundingBox();
    template.geometry.computeBoundingSphere();
    template.geometry.computeVertexNormals();
  }

  return templateMeshes;
}

class SeatInstancedMap {
  constructor(scene, repository, templateMeshes) {
    this.scene = scene;
    this.repository = repository;
    this.templateMeshes = templateMeshes;
    this.stateMeshes = new Map();
    this.dummy = new THREE.Object3D();
    this.hoveredId = -1;
    this.selectedId = -1;
    this.hoverMarker = null;
    this.selectedMarker = null;
  }

  build() {
    this.rebuildStateMeshes();
    this.createMarkers();
  }

  pick(raycaster) {
    const meshes = [...this.stateMeshes.values()].flat();
    const intersections = raycaster.intersectObjects(meshes, false);

    if (intersections.length === 0) {
      return -1;
    }

    const hit = intersections[0];
    return hit.object.userData.globalIds[hit.instanceId] ?? -1;
  }

  setHovered(instanceId) {
    if (this.hoveredId !== -1 && this.hoveredId !== this.selectedId) {
      this.hoverMarker.visible = false;
    }

    this.hoveredId = instanceId;

    if (this.hoveredId !== -1 && this.hoveredId !== this.selectedId) {
      this.placeMarker(this.hoverMarker, instanceId, 1.08);
    }
  }

  setSelected(instanceId) {
    this.selectedId = instanceId;

    if (this.selectedId === -1) {
      this.selectedMarker.visible = false;
      return;
    }

    this.placeMarker(this.selectedMarker, instanceId, 1.14);
  }

  cycleSeatState(instanceId) {
    const nextState = (this.repository.getState(instanceId) + 1) % 3;
    this.repository.setState(instanceId, nextState);
    this.rebuildStateMeshes();

    if (this.hoveredId !== -1 && this.hoveredId !== this.selectedId) {
      this.placeMarker(this.hoverMarker, this.hoveredId, 1.08);
    }

    if (this.selectedId !== -1) {
      this.placeMarker(this.selectedMarker, this.selectedId, 1.14);
    }

    return nextState;
  }

  rebuildStateMeshes() {
    for (const meshes of this.stateMeshes.values()) {
      for (const mesh of meshes) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }

    this.stateMeshes.clear();

    const seatIdsByState = {
      [SEAT_STATES.FREE]: [],
      [SEAT_STATES.RESERVED]: [],
      [SEAT_STATES.OCCUPIED]: [],
    };

    for (let index = 0; index < this.repository.count; index += 1) {
      seatIdsByState[this.repository.getState(index)].push(index);
    }

    for (const [stateKey, globalIds] of Object.entries(seatIdsByState)) {
      const state = Number(stateKey);
      const meshes = [];

      for (const template of this.templateMeshes) {
        const material = template.material.clone();
        material.color.copy(SEAT_COLORS[state]);

        const mesh = new THREE.InstancedMesh(
          template.geometry.clone(),
          material,
          globalIds.length,
        );
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        mesh.userData.globalIds = globalIds;

        for (let localIndex = 0; localIndex < globalIds.length; localIndex += 1) {
          const globalId = globalIds[localIndex];
          const seat = this.repository.getSeat(globalId);
          this.dummy.position.copy(seat.position);
          this.dummy.rotation.set(0, seat.rotationY, 0);
          this.dummy.updateMatrix();
          mesh.setMatrixAt(localIndex, this.dummy.matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(mesh);
        meshes.push(mesh);
      }

      this.stateMeshes.set(state, meshes);
    }
  }

  createMarkers() {
    const markerGeometry = this.templateMeshes[0].geometry.clone();

    this.hoverMarker = new THREE.Mesh(
      markerGeometry,
      new THREE.MeshBasicMaterial({
        color: SEAT_COLORS.hover,
        wireframe: true,
        toneMapped: false,
      }),
    );
    this.hoverMarker.visible = false;
    this.scene.add(this.hoverMarker);

    this.selectedMarker = new THREE.Mesh(
      markerGeometry.clone(),
      new THREE.MeshBasicMaterial({
        color: SEAT_COLORS.selected,
        wireframe: true,
        toneMapped: false,
      }),
    );
    this.selectedMarker.visible = false;
    this.scene.add(this.selectedMarker);
  }

  placeMarker(marker, instanceId, scale) {
    const seat = this.repository.getSeat(instanceId);
    marker.visible = true;
    marker.position.copy(seat.position);
    marker.rotation.set(0, seat.rotationY, 0);
    marker.scale.setScalar(scale);
    marker.updateMatrix();
  }

  dispose() {
    for (const meshes of this.stateMeshes.values()) {
      for (const mesh of meshes) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
  }
}

function createRenderer() {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor('#d7e3f4', 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  return renderer;
}

function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d7e3f4');
  scene.fog = new THREE.Fog('#d7e3f4', 90, 250);
  return scene;
}

function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    500,
  );
  camera.position.set(0, 34, 110);
  return camera;
}

function addEnvironment(scene) {
  const hemiLight = new THREE.HemisphereLight('#f6fbff', '#8f9aa8', 1.65);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight('#fff7df', 1.4);
  sunLight.position.set(40, 55, 20);
  sunLight.castShadow = true;
  scene.add(sunLight);

  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(STADIUM_CONFIG.fieldWidth, STADIUM_CONFIG.fieldHeight),
    new THREE.MeshStandardMaterial({
      color: '#2d9a52',
      roughness: 0.94,
      metalness: 0.02,
    }),
  );
  field.rotation.x = -Math.PI * 0.5;
  field.position.y = -0.02;
  scene.add(field);

  const fieldBorder = new THREE.Mesh(
    new THREE.RingGeometry(26, 92, 128),
    new THREE.MeshStandardMaterial({
      color: '#c5ccd8',
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
  );
  fieldBorder.rotation.x = -Math.PI * 0.5;
  scene.add(fieldBorder);

  if (DEBUG_RENDER.showCenterProbe) {
    const centerMarker = new THREE.Mesh(
      new THREE.BoxGeometry(4, 4, 4),
      new THREE.MeshBasicMaterial({
        color: '#00e5ff',
        toneMapped: false,
      }),
    );
    centerMarker.position.set(0, 2, 0);
    scene.add(centerMarker);
  }
}

function formatStateLabel(state) {
  switch (state) {
    case SEAT_STATES.FREE:
      return 'Libre';
    case SEAT_STATES.RESERVED:
      return 'Reservado';
    case SEAT_STATES.OCCUPIED:
      return 'Ocupado';
    default:
      return 'Desconocido';
  }
}

function createUi() {
  const app = document.querySelector('#app');
  app.innerHTML = `
    <div class="hud">
      <div class="hud__panel hud__panel--title">
        <p class="eyebrow">Seat Map Engine</p>
        <h1>Estadio instanciado para ticketing</h1>
        <p class="summary">
          Un asiento 3D, 80.000 instancias y seleccion por raycast con estados listos
          para integracion.
        </p>
      </div>
      <div class="hud__panel hud__panel--status">
        <p class="panel-label">Asiento activo</p>
        <h2 id="seat-label">Ninguno</h2>
        <dl class="seat-meta">
          <div>
            <dt>Sector</dt>
            <dd id="seat-section">-</dd>
          </div>
          <div>
            <dt>Fila</dt>
            <dd id="seat-row">-</dd>
          </div>
          <div>
            <dt>Numero</dt>
            <dd id="seat-number">-</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd id="seat-state">-</dd>
          </div>
        </dl>
      </div>
      <div class="hud__panel hud__panel--legend">
        <p class="panel-label">Estados</p>
        <ul class="legend">
          <li><span class="swatch swatch--free"></span>Libre</li>
          <li><span class="swatch swatch--reserved"></span>Reservado</li>
          <li><span class="swatch swatch--occupied"></span>Ocupado</li>
        </ul>
        <p class="hint">Click para seleccionar. Doble click para cambiar el estado.</p>
      </div>
      <div class="hud__panel hud__panel--metrics">
        <p class="panel-label">Escena</p>
        <p id="seat-count">Cargando asientos...</p>
      </div>
    </div>
  `;

  return {
    label: document.querySelector('#seat-label'),
    section: document.querySelector('#seat-section'),
    row: document.querySelector('#seat-row'),
    number: document.querySelector('#seat-number'),
    state: document.querySelector('#seat-state'),
    count: document.querySelector('#seat-count'),
  };
}

function updateSeatUi(ui, seat, state) {
  if (!seat) {
    ui.label.textContent = 'Ninguno';
    ui.section.textContent = '-';
    ui.row.textContent = '-';
    ui.number.textContent = '-';
    ui.state.textContent = '-';
    return;
  }

  ui.label.textContent = seat.seatId;
  ui.section.textContent = seat.section;
  ui.row.textContent = String(seat.row);
  ui.number.textContent = String(seat.number);
  ui.state.textContent = formatStateLabel(state);
}

async function bootstrap() {
  const app = document.querySelector('#app');
  const ui = createUi();
  const scene = createScene();
  const camera = createCamera();
  const renderer = createRenderer();
  app.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 12, 0);
  controls.minDistance = 30;
  controls.maxDistance = 180;
  controls.maxPolarAngle = Math.PI * 0.47;

  addEnvironment(scene);

  const layout = generateStadiumLayout(STADIUM_CONFIG);
  const repository = new SeatRepository(layout);
  const templateMeshes = await loadSeatTemplate();
  const seatMap = new SeatInstancedMap(scene, repository, templateMeshes);
  seatMap.build();

  ui.count.textContent = `${repository.count.toLocaleString('es-ES')} asientos instanciados`;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function updatePointer(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  }

  function pickSeat(event) {
    updatePointer(event);
    return seatMap.pick(raycaster);
  }

  renderer.domElement.addEventListener('pointermove', (event) => {
    const instanceId = pickSeat(event);
    seatMap.setHovered(instanceId);
  });

  renderer.domElement.addEventListener('pointerleave', () => {
    seatMap.setHovered(-1);
  });

  renderer.domElement.addEventListener('click', (event) => {
    const instanceId = pickSeat(event);
    seatMap.setSelected(instanceId);
    updateSeatUi(
      ui,
      instanceId === -1 ? null : repository.getSeat(instanceId),
      instanceId === -1 ? null : repository.getState(instanceId),
    );
  });

  renderer.domElement.addEventListener('dblclick', (event) => {
    const instanceId = pickSeat(event);

    if (instanceId === -1) {
      return;
    }

    const nextState = seatMap.cycleSeatState(instanceId);
    updateSeatUi(ui, repository.getSeat(instanceId), nextState);
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  const app = document.querySelector('#app');
  app.innerHTML = `
    <div class="error-panel">
      <h1>No se pudo iniciar la escena</h1>
      <p>Revisa la consola para ver el detalle del error.</p>
    </div>
  `;
});
