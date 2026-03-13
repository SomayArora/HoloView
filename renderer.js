const THREE = require('three')
const { OBJLoader, MTLLoader } = require('three-stdlib')
const axios = require('axios')

const canvas = document.getElementById('glcanvas')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x000000)
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.physicallyCorrectLights = true
renderer.outputEncoding = THREE.sRGBEncoding

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 1.5, 3)

const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2)
scene.add(hemi)
const dir = new THREE.DirectionalLight(0xffffff, 0.8)
dir.position.set(5,10,7)
scene.add(dir)

let modelGroup = new THREE.Group()
scene.add(modelGroup)

let isAutoRotate = false
let isHolo = false
let ssaa = 1

function fitCameraToObject(camera, object, offset=1.25) {
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  const fov = camera.fov * (Math.PI/180)
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * offset
  // keep existing camera orientation but move to fit
  const dir = camera.getWorldDirection(new THREE.Vector3()).normalize()
  camera.position.copy(center).addScaledVector(dir.negate(), cameraZ)
  camera.lookAt(center)
}

let state = {
  dragging: false,
  button: 0,
  lastX: 0,
  lastY: 0,
  zoom: 1
}

function onPointerDown(e) {
  state.dragging = true
  state.button = e.button
  state.lastX = e.clientX
  state.lastY = e.clientY
}
function onPointerUp(e) { state.dragging = false }
function onPointerMove(e) {
  if(!state.dragging) return
  const dx = (e.clientX - state.lastX) / window.innerWidth
  const dy = (e.clientY - state.lastY) / window.innerHeight
  state.lastX = e.clientX
  state.lastY = e.clientY
  if(state.button === 0) { // left drag rotate
    modelGroup.rotation.y -= dx * Math.PI * 2
    modelGroup.rotation.x -= dy * Math.PI
  } else if(state.button === 2) { // right drag pan
    const pan = new THREE.Vector3(-dx*5, dy*5, 0)
    modelGroup.position.add(pan)
  }
}

function onWheel(e) {
  e.preventDefault()
  const delta = e.deltaY * 0.002
  // move camera along its forward vector
  camera.position.addScaledVector(camera.getWorldDirection(new THREE.Vector3()), delta * 6)
}

canvas.addEventListener('pointerdown', onPointerDown)
window.addEventListener('pointerup', onPointerUp)
window.addEventListener('pointermove', onPointerMove)
canvas.addEventListener('wheel', onWheel, { passive: false })
canvas.addEventListener('contextmenu', e => e.preventDefault())

function animate() {
  requestAnimationFrame(animate)
  if(isAutoRotate) modelGroup.rotation.y += 0.005
  renderer.render(scene, camera)
}
animate()

async function listModels() {
  try {
    const res = await axios.get('http://127.0.0.1:5000/models')
    return res.data
  } catch (err) {
    console.error('failed to get models', err)
    return []
  }
}

let currentCancelSource = null
async function loadOBJ(url) {
  clearModel()
  // cancel previous
  if (currentCancelSource) { try { currentCancelSource.cancel('new load') } catch(e){} }
  currentCancelSource = axios.CancelToken.source()
  showLoading('Downloading model...')
  loadingProgress.value = 0
  const loader = new OBJLoader()
  // attempt to load MTL if present
  let mtlUrl = url.replace(/\.obj$/i, '.mtl')
  try {
    // fetch OBJ text with progress and cancel
    const objResp = await axios.get(url, { responseType: 'text', cancelToken: currentCancelSource.token, onDownloadProgress: p => {
      if (p.lengthComputable) loadingProgress.value = Math.floor((p.loaded / p.total) * 100)
    }})
    // attempt to fetch MTL too
    let mtlText = null
    try {
      const mtlResp = await axios.get(mtlUrl, { responseType: 'text', cancelToken: currentCancelSource.token, onDownloadProgress: p => {
        if (p.lengthComputable) loadingProgress.value = Math.floor((p.loaded / p.total) * 100)
      }})
      mtlText = mtlResp.data
    } catch (mtlErr) {
      // no mtl, continue
    }

    // parse MTL if present
    if (mtlText) {
      const mtlLoader = new MTLLoader()
      const materialsCreator = mtlLoader.parse(mtlText)
      materialsCreator.preload()
      loader.setMaterials(materialsCreator)
    }

    // parse OBJ
    const obj = loader.parse(objResp.data)
    // apply texture improvements
    obj.traverse(child => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        mats.forEach(mat => {
          ['map','aoMap','emissiveMap','metalnessMap','roughnessMap','normalMap'].forEach(k => {
            if (mat[k]) {
              try { mat[k].encoding = THREE.sRGBEncoding } catch(e){}
              try { mat[k].anisotropy = renderer.capabilities.getMaxAnisotropy() } catch(e){}
              mat[k].needsUpdate = true
            }
          })
          mat.needsUpdate = true
        })
      }
    })
    modelGroup.add(obj)
    fitCameraToObject(camera, modelGroup)
    hideLoading()
    currentCancelSource = null
    return obj
  } catch (err) {
    hideLoading()
    currentCancelSource = null
    if (axios.isCancel && axios.isCancel(err)) { 
      console.log('load cancelled')
      throw new Error('cancelled')
    }
    console.error('load failed', err)
    throw err
  }
}

function clearModel() {
  while(modelGroup.children.length) modelGroup.remove(modelGroup.children[0])
  modelGroup.position.set(0,0,0)
  modelGroup.rotation.set(0,0,0)
}

// UI wiring
document.getElementById('resetBtn').addEventListener('click', () => { clearModel(); camera.position.set(0,1.5,3); camera.lookAt(new THREE.Vector3(0,0,0)) })
document.getElementById('exitBtn').addEventListener('click', () => window.electronAPI.exitApp())
document.getElementById('autoRotateBtn').addEventListener('click', (e) => { isAutoRotate = !isAutoRotate; e.target.textContent = isAutoRotate ? 'Stop' : 'Auto Rotate' })
document.getElementById('holoBtn').addEventListener('click', (e) => { isHolo = !isHolo; renderer.getContext().canvas.style.mixBlendMode = isHolo ? 'screen' : 'normal'; e.target.textContent = isHolo ? 'Holo On' : 'Holo Mode' })

const loadModal = document.getElementById('loadModal')
document.getElementById('loadBtn').addEventListener('click', async () => {
  loadModal.classList.remove('hidden')
  const ul = document.getElementById('modelList')
  ul.innerHTML = '<li>Loading...</li>'
  const models = await listModels()
  ul.innerHTML = ''
  // flat list: show only the filename (last segment) but keep mapping to full path
  for (const m of models) {
    const filename = m.split('/').pop()
    const li = document.createElement('li')
    li.className = 'tree-file'
    li.textContent = filename
    li.title = m
    li.addEventListener('click', async () => {
      const pathParts = m.split('/').map(p => encodeURIComponent(p)).join('/')
      const modelUrl = `http://127.0.0.1:5000/models/${pathParts}`
      try {
        li.textContent = `${filename} (loading...)`
        showLoading('Downloading model...')
        await loadOBJ(modelUrl)
        hideLoading()
        loadModal.classList.add('hidden')
      } catch (err) {
        console.error('failed to load model', err)
        li.textContent = `${filename} (failed)`
        hideLoading()
      }
    })
    ul.appendChild(li)
  }
})
document.getElementById('closeLoad').addEventListener('click', () => loadModal.classList.add('hidden'))

  // SSAA select
  const ssaaSelect = document.getElementById('ssaaSelect')
  ssaaSelect.addEventListener('change', (e) => {
    ssaa = parseInt(e.target.value) || 1
    ensureRenderTarget()
  })

  // loading overlay
  const loadingOverlay = document.getElementById('loadingOverlay')
  const loadingText = document.getElementById('loadingText')
  const loadingProgress = document.getElementById('loadingProgress')
  const cancelLoadBtn = document.getElementById('cancelLoad')
  function showLoading(text) {
    loadingText.textContent = text || 'Loading model...'
    loadingProgress.value = 0
    loadingOverlay.classList.remove('hidden')
  }
  function hideLoading() { loadingOverlay.classList.add('hidden') }
  cancelLoadBtn.addEventListener('click', () => {
    if (currentCancelSource) {
      try { currentCancelSource.cancel('user cancelled') } catch(e){}
      currentCancelSource = null
    }
    hideLoading()
  })


// expose stt hooks
window.sttControl = {
  reset: () => { clearModel(); camera.position.set(0,1.5,3) },
  exit: () => window.electronAPI.exitApp(),
  autoRotate: () => { isAutoRotate = !isAutoRotate },
  holo: () => { isHolo = !isHolo },
  listModels: listModels,
  loadModelByName: async (name) => await loadOBJ(`http://127.0.0.1:5000/models/${encodeURIComponent(name)}`)
}

// responsive
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight
  renderer.setSize(w,h)
  camera.aspect = w/h
  camera.updateProjectionMatrix()
})
