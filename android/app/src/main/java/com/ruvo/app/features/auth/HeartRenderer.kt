package com.ruvo.app.features.auth

import android.content.Context
import android.view.TextureView
import com.google.android.filament.Camera
import com.google.android.filament.ColorGrading
import com.google.android.filament.Engine
import com.google.android.filament.EntityManager
import com.google.android.filament.Filament
import com.google.android.filament.IndirectLight
import com.google.android.filament.LightManager
import com.google.android.filament.MaterialInstance
import com.google.android.filament.Renderer
import com.google.android.filament.Scene
import com.google.android.filament.SwapChain
import com.google.android.filament.ToneMapper
import com.google.android.filament.View
import com.google.android.filament.Viewport
import com.google.android.filament.android.UiHelper
import com.google.android.filament.gltfio.AssetLoader
import com.google.android.filament.gltfio.FilamentAsset
import com.google.android.filament.gltfio.Gltfio
import com.google.android.filament.gltfio.ResourceLoader
import com.google.android.filament.gltfio.UbershaderProvider
import com.ruvo.app.R
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import kotlinx.coroutines.delay
import java.nio.ByteBuffer
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin

/**
 * Renders the anatomical heart (res/raw/heart_model.glb) into a transparent TextureView with
 * Filament. Port of the web design's three.js scene: same camera, same three-point lighting
 * plus an accent light whose colour and strength follow the fitness level.
 *
 * All calls must be made on the main thread. Load it early with [HeartHolder] (onboarding does
 * so during step 1) and [attach] it to a view when step 2 shows. [create] returns null if the device cannot
 * create a GL context or the model fails to load, so the caller can show a static heart.
 */
internal class HeartRenderer private constructor(
    private val engine: Engine,
) {
    private var textureView: TextureView? = null
    // Per-frame inputs, written by the composable's frame loop.
    var yaw = -0.25f
    var pitch = 0.06f
    var beat = 0f          // smoothed 0..1 heartbeat envelope
    var heat = 0f          // 0 (Beginner) .. 1 (Elite)
    var rigScale = 1f      // intro grow-in
    var accentR = 0.29f
    var accentG = 0.87f
    var accentB = 0.5f     // sRGB 0..1

    private val renderer: Renderer = engine.createRenderer()
    private val scene: Scene = engine.createScene()
    private val view: View = engine.createView()
    private val cameraEntity = EntityManager.get().create()
    private val camera: Camera = engine.createCamera(cameraEntity)
    private val uiHelper = UiHelper(UiHelper.ContextErrorPolicy.DONT_CHECK)
    private var swapChain: SwapChain? = null

    private val materialProvider = UbershaderProvider(engine)
    private val assetLoader = AssetLoader(engine, materialProvider, EntityManager.get())
    private val resourceLoader = ResourceLoader(engine)
    private var asset: FilamentAsset? = null
    private val materialInstances = ArrayList<MaterialInstance>()

    private val indirectLight: IndirectLight
    private val colorGrading: ColorGrading
    private val rimLight = EntityManager.get().create()
    private val accentLight = EntityManager.get().create()
    private val lightEntities = ArrayList<Int>()

    private var aspect = 327f / 300f
    private var destroyed = false

    val isLoaded get() = asset != null

    init {
        // Same framing as the web scene: 26deg vertical FOV, camera on +Z looking slightly down.
        camera.lookAt(0.0, 0.1, 12.2, 0.0, -0.05, 0.0, 0.0, 1.0, 0.0)
        camera.setProjection(26.0, aspect.toDouble(), 0.1, 100.0, Camera.Fov.VERTICAL)

        view.scene = scene
        view.camera = camera
        view.blendMode = View.BlendMode.TRANSLUCENT
        view.multiSampleAntiAliasingOptions = View.MultiSampleAntiAliasingOptions().also { it.enabled = true }
        colorGrading = ColorGrading.Builder().toneMapper(ToneMapper.ACES()).build(engine)
        view.colorGrading = colorGrading
        renderer.clearOptions = renderer.clearOptions.also { it.clear = true }

        // Soft ambient fill, like the web's ambient + hemisphere lights.
        indirectLight = IndirectLight.Builder()
            .irradiance(1, floatArrayOf(1f, 0.97f, 0.93f))
            .intensity(AMBIENT_LUX)
            .build(engine)
        scene.indirectLight = indirectLight

        // three.js light positions become directions toward the origin.
        addDirectional(1.0f, 0.95f, 0.91f, KEY_LUX, -3f, -4f, -5f)      // key
        addDirectional(0.9f, 0.93f, 1.0f, FILL_LUX, 4f, -1f, -3f)       // fill
        addDirectional(1f, 1f, 1f, 0f, 4f, -2f, 4f, rimLight)           // rim (tinted by level)
        addDirectional(1f, 1f, 1f, 0f, -0.6f, 0.4f, -2.2f, accentLight) // accent glow from the front

        uiHelper.isOpaque = false
        uiHelper.renderCallback = object : UiHelper.RendererCallback {
            override fun onNativeWindowChanged(surface: android.view.Surface) {
                swapChain?.let { engine.destroySwapChain(it) }
                swapChain = engine.createSwapChain(surface)
            }

            override fun onDetachedFromSurface() {
                swapChain?.let {
                    engine.destroySwapChain(it)
                    engine.flushAndWait()
                    swapChain = null
                }
            }

            override fun onResized(width: Int, height: Int) {
                if (width <= 0 || height <= 0) return
                view.viewport = Viewport(0, 0, width, height)
                aspect = width.toFloat() / height
                camera.setProjection(26.0, aspect.toDouble(), 0.1, 100.0, Camera.Fov.VERTICAL)
            }
        }
    }

    /** Show the heart in [view]. Cheap once the model is loaded, so step 2 appears immediately. */
    fun attach(view: TextureView) {
        textureView = view
        vpW = 0; vpH = 0
        uiHelper.attachTo(view)
    }

    /** Stop drawing into the current view but keep the engine and model for the next attach. */
    fun detach() {
        uiHelper.detach()
        textureView = null
    }

    private fun addDirectional(
        r: Float, g: Float, b: Float, lux: Float, dx: Float, dy: Float, dz: Float,
        entity: Int = EntityManager.get().create(),
    ) {
        LightManager.Builder(LightManager.Type.DIRECTIONAL)
            .color(r, g, b)
            .intensity(lux)
            .direction(dx, dy, dz)
            .castShadows(false)
            .build(engine, entity)
        scene.addEntity(entity)
        lightEntities.add(entity)
    }

    private suspend fun loadModel(context: Context): Boolean {
        val bytes = context.resources.openRawResource(R.raw.heart_model).use { it.readBytes() }
        val buffer = ByteBuffer.allocateDirect(bytes.size).put(bytes).also { it.rewind() }
        val loaded = assetLoader.createAsset(buffer) ?: return false
        // Texture decoding runs on worker threads; we only pump it, so the UI never stalls on it.
        resourceLoader.asyncBeginLoad(loaded)
        while (resourceLoader.asyncGetLoadProgress() < 1f) {
            resourceLoader.asyncUpdateLoad()
            delay(8)
        }
        loaded.releaseSourceData()
        scene.addEntities(loaded.entities)
        asset = loaded
        for (mi in loaded.instance.materialInstances) {
            materialInstances.add(mi)
            // Like the web scene: a non-metal, moderately glossy organ.
            if (mi.material.hasParameter("metallicFactor")) mi.setParameter("metallicFactor", 0f)
        }
        return true
    }

    fun render(frameTimeNanos: Long) {
        val chain = swapChain ?: return
        val a = asset ?: return
        val tv = textureView ?: return
        if (destroyed || !uiHelper.isReadyToRender) return

        // Map the beat/level onto the lights and the material's emissive glow.
        val lr = srgbToLinear(accentR); val lg = srgbToLinear(accentG); val lb = srgbToLinear(accentB)
        val lm = engine.lightManager
        lm.setColor(lm.getInstance(rimLight), lr, lg, lb)
        lm.setIntensity(lm.getInstance(rimLight), RIM_LUX)
        lm.setColor(lm.getInstance(accentLight), lr, lg, lb)
        lm.setIntensity(lm.getInstance(accentLight), ACCENT_LUX * (0.5f + 1.1f * heat + (0.5f + 1.0f * heat) * beat))
        val emissive = 0.03f + 0.1f * heat + (0.12f + 0.25f * heat) * beat
        for (mi in materialInstances) {
            if (mi.material.hasParameter("emissiveFactor")) {
                mi.setParameter("emissiveFactor", lr * emissive, lg * emissive, lb * emissive, 1f)
            }
        }

        val tm = engine.transformManager
        tm.setTransform(tm.getInstance(a.root), rigMatrix())

        syncViewport()
        val began = renderer.beginFrame(chain, frameTimeNanos)
        if (began) {
            renderer.render(view)
            renderer.endFrame()
        }
    }

    // The TextureView already has its surface by the time we attach (the model loads after the
    // step transition), so don't rely on UiHelper's resize callback alone.
    private var vpW = 0
    private var vpH = 0
    private fun syncViewport() {
        val tv = textureView ?: return
        val w = tv.width
        val h = tv.height
        if (w <= 0 || h <= 0 || (w == vpW && h == vpH)) return
        vpW = w; vpH = h
        view.viewport = Viewport(0, 0, w, h)
        aspect = w.toFloat() / h
        camera.setProjection(26.0, aspect.toDouble(), 0.1, 100.0, Camera.Fov.VERTICAL)
    }

    /** M = Rx(pitch) * Ry(yaw) * Scale(u) * Translate(-center), column-major. */
    private fun rigMatrix(): FloatArray {
        val u = MODEL_SCALE * rigScale * (1f + (0.03f + 0.05f * heat) * beat)
        val cp = cos(pitch); val sp = sin(pitch); val cy = cos(yaw); val sy = sin(yaw)
        // R = Rx * Ry
        val r00 = cy;        val r01 = 0f; val r02 = sy
        val r10 = sp * sy;   val r11 = cp; val r12 = -sp * cy
        val r20 = -cp * sy;  val r21 = sp; val r22 = cp * cy
        val tx = -MODEL_CENTER_Y * u * r01
        val ty = -MODEL_CENTER_Y * u * r11
        val tz = -MODEL_CENTER_Y * u * r21
        return floatArrayOf(
            r00 * u, r10 * u, r20 * u, 0f,
            r01 * u, r11 * u, r21 * u, 0f,
            r02 * u, r12 * u, r22 * u, 0f,
            tx, ty, tz, 1f,
        )
    }

    fun destroy() {
        if (destroyed) return
        destroyed = true
        uiHelper.detach()
        asset?.let {
            scene.removeEntities(it.entities)
            assetLoader.destroyAsset(it)
        }
        materialProvider.destroyMaterials()
        materialProvider.destroy()
        resourceLoader.destroy()
        assetLoader.destroy()

        val em = EntityManager.get()
        for (e in lightEntities) { scene.removeEntity(e); engine.lightManager.destroy(e); em.destroy(e) }
        engine.destroyIndirectLight(indirectLight)
        engine.destroyColorGrading(colorGrading)
        engine.destroyRenderer(renderer)
        engine.destroyView(view)
        engine.destroyScene(scene)
        engine.destroyCameraComponent(cameraEntity)
        em.destroy(cameraEntity)
        engine.destroy()
    }

    companion object {
        // The GLB's node sits at y=0.49 with height 0.98; the web scene scales it to 3.8 units
        // tall and re-centres it on the origin, so the pivot for rotation/beat is the heart itself.
        private const val MODEL_CENTER_Y = 0.49f
        private const val MODEL_SCALE = 3.8f / 0.98f

        // Filament uses physical light units, so these differ from the web's arbitrary intensities.
        private const val AMBIENT_LUX = 22000f
        private const val KEY_LUX = 60000f
        private const val FILL_LUX = 16000f
        private const val RIM_LUX = 45000f
        private const val ACCENT_LUX = 30000f

        private fun srgbToLinear(c: Float) = c.pow(2.2f)

        suspend fun create(context: Context): HeartRenderer? = try {
            Filament.init()
            Gltfio.init()
            val engine = Engine.create()
            val r = HeartRenderer(engine)
            if (r.loadModel(context)) r else { r.destroy(); null }
        } catch (t: kotlinx.coroutines.CancellationException) {
            throw t
        } catch (t: Throwable) {
            android.util.Log.w("HeartRenderer", "3D heart unavailable, using static fallback", t)
            null
        }
    }
}

/**
 * Owns the heart for the whole onboarding flow so the model is already loaded when step 2 opens.
 * [load] is safe to call more than once; the result lands in [renderer] / [failed].
 */
internal class HeartHolder {
    var renderer by androidx.compose.runtime.mutableStateOf<HeartRenderer?>(null)
        private set
    var failed by androidx.compose.runtime.mutableStateOf(false)
        private set
    private var loading = false

    suspend fun load(context: Context) {
        if (renderer != null || failed || loading) return
        loading = true
        try {
            val r = HeartRenderer.create(context)
            if (r == null) failed = true else renderer = r
        } finally {
            loading = false
        }
    }

    fun destroy() {
        renderer?.destroy()
        renderer = null
    }
}
