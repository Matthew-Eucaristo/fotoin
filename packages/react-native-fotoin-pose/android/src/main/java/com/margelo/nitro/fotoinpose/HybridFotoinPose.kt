package com.margelo.nitro.fotoinpose

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import androidx.annotation.Keep
import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalGetImage
import com.facebook.proguard.annotations.DoNotStrip
import com.google.android.gms.tasks.Tasks
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.ImageProcessingOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceLandmark
import com.margelo.nitro.NitroModules
import com.margelo.nitro.camera.HybridFrameSpec
import com.margelo.nitro.camera.public.NativeFrame
import com.margelo.nitro.core.Promise
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.TimeUnit

/**
 * Multi-person body pose with Google MediaPipe Pose Landmarker (official,
 * bundled lite model) and faces with Google ML Kit Face Detection.
 * Output layout is documented in src/specs/FotoinPose.nitro.ts.
 */
@DoNotStrip
@Keep
class HybridFotoinPose : HybridFotoinPoseSpec() {
  private val context: Context
    get() = NitroModules.applicationContext ?: throw IllegalStateException("No application context")

  private val videoLandmarker by lazy { landmarker(RunningMode.VIDEO) }
  private val imageLandmarker by lazy { landmarker(RunningMode.IMAGE) }
  private val streamFaceDetector by lazy { faceDetector(FaceDetectorOptions.PERFORMANCE_MODE_FAST) }
  private val imageFaceDetector by lazy { faceDetector(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE) }
  private var lastVideoMs = 0L

  // ---- Bodies ---------------------------------------------------------------

  @OptIn(ExperimentalGetImage::class)
  override fun detect(frame: HybridFrameSpec): DoubleArray {
    val proxy = (frame as? NativeFrame)?.image ?: return empty()
    val rotation = proxy.imageInfo.rotationDegrees
    val bitmap = proxy.toBitmap()
    // VIDEO mode tracks people across frames; timestamps must increase.
    val ms = maxOf(proxy.imageInfo.timestamp / 1_000_000, lastVideoMs + 1)
    lastVideoMs = ms
    val options = ImageProcessingOptions.builder().setRotationDegrees(rotation).build()
    val result = videoLandmarker.detectForVideo(BitmapImageBuilder(bitmap).build(), options, ms)
    val quarterTurn = rotation == 90 || rotation == 270
    val w = if (quarterTurn) bitmap.height else bitmap.width
    val h = if (quarterTurn) bitmap.width else bitmap.height
    return packBodies(result, w, h, mirror = frame.isMirrored)
  }

  override fun detectInImage(path: String): Promise<DoubleArray> = Promise.async {
    val bitmap = decodeUpright(path)
    val result = imageLandmarker.detect(BitmapImageBuilder(bitmap).build())
    packBodies(result, bitmap.width, bitmap.height, mirror = false)
  }

  private fun landmarker(mode: RunningMode): PoseLandmarker {
    val model = context.assets.open(MODEL).use { input ->
      val bytes = input.readBytes()
      ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder()).put(bytes).apply { rewind() }
    }
    val options = PoseLandmarker.PoseLandmarkerOptions.builder()
      .setBaseOptions(BaseOptions.builder().setModelAssetBuffer(model).setDelegate(Delegate.CPU).build())
      .setRunningMode(mode)
      .setNumPoses(MAX_PEOPLE)
      .setMinPoseDetectionConfidence(0.5f)
      .setMinPosePresenceConfidence(0.5f)
      .setMinTrackingConfidence(0.5f)
      .build()
    return PoseLandmarker.createFromOptions(context, options)
  }

  /** People sorted largest first → [aspect, count, (x, y, conf)×13…]. */
  private fun packBodies(result: PoseLandmarkerResult, w: Int, h: Int, mirror: Boolean): DoubleArray {
    if (w <= 0 || h <= 0) return empty()
    val people = result.landmarks().map { lms ->
      val block = DoubleArray(JOINTS.size * 3)
      var minX = 1.0; var minY = 1.0; var maxX = 0.0; var maxY = 0.0
      JOINTS.forEachIndexed { i, index ->
        val lm = lms.getOrNull(index) ?: return@forEachIndexed
        val conf = lm.visibility().orElse(0f).toDouble()
        val x = lm.x().toDouble().let { if (mirror) 1 - it else it }
        val y = lm.y().toDouble()
        block[i * 3] = x
        block[i * 3 + 1] = y
        block[i * 3 + 2] = conf
        if (conf > 0.4) {
          minX = minOf(minX, x); maxX = maxOf(maxX, x)
          minY = minOf(minY, y); maxY = maxOf(maxY, y)
        }
      }
      Pair((maxX - minX).coerceAtLeast(0.0) * (maxY - minY).coerceAtLeast(0.0), block)
    }.sortedByDescending { it.first }.take(MAX_PEOPLE)
    return doubleArrayOf(w.toDouble() / h, people.size.toDouble()) + people.flatMap { it.second.asList() }
  }

  // ---- Faces ----------------------------------------------------------------

  @OptIn(ExperimentalGetImage::class)
  override fun detectFace(frame: HybridFrameSpec): DoubleArray {
    val proxy = (frame as? NativeFrame)?.image ?: return empty()
    val media = proxy.image ?: return empty()
    val rotation = proxy.imageInfo.rotationDegrees
    val quarterTurn = rotation == 90 || rotation == 270
    // Runs on VisionCamera's frame thread; the ImageProxy is only valid until
    // the frame is disposed, so wait here (with a cap) instead of going async.
    val faces = Tasks.await(
      streamFaceDetector.process(InputImage.fromMediaImage(media, rotation)),
      200,
      TimeUnit.MILLISECONDS,
    )
    val w = if (quarterTurn) proxy.height else proxy.width
    val h = if (quarterTurn) proxy.width else proxy.height
    return packFaces(faces, w, h, mirror = frame.isMirrored)
  }

  override fun detectFaceInImage(path: String): Promise<DoubleArray> = Promise.async {
    val input = InputImage.fromFilePath(context, toUri(path)) // applies EXIF rotation
    val faces = Tasks.await(imageFaceDetector.process(input))
    packFaces(faces, input.width, input.height, mirror = false)
  }

  private fun faceDetector(mode: Int) = FaceDetection.getClient(
    FaceDetectorOptions.Builder()
      .setPerformanceMode(mode)
      .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
      .setMinFaceSize(0.08f)
      .build(),
  )

  /** Faces sorted largest first → [aspect, count, (box(4), 5 points×2)…]. */
  private fun packFaces(faces: List<Face>, w: Int, h: Int, mirror: Boolean): DoubleArray {
    if (w <= 0 || h <= 0) return empty()
    val blocks = faces
      .sortedByDescending { it.boundingBox.width() * it.boundingBox.height() }
      .mapNotNull { face -> faceBlock(face, w, h, mirror) }
      .take(MAX_PEOPLE)
    return doubleArrayOf(w.toDouble() / h, blocks.size.toDouble()) + blocks.flatMap { it.asList() }
  }

  private fun faceBlock(face: Face, w: Int, h: Int, mirror: Boolean): DoubleArray? {
    val points = FACE_LANDMARKS.map { face.getLandmark(it)?.position ?: return null }
    fun x(v: Double) = if (mirror) 1 - v else v
    val box = face.boundingBox
    val left = if (mirror) 1 - box.right.toDouble() / w else box.left.toDouble() / w
    val out = mutableListOf(left, box.top.toDouble() / h, box.width().toDouble() / w, box.height().toDouble() / h)
    for (p in points) {
      out += x(p.x.toDouble() / w)
      out += p.y.toDouble() / h
    }
    return out.toDoubleArray()
  }

  // ---- Helpers --------------------------------------------------------------

  private fun empty() = doubleArrayOf(1.0, 0.0)

  private fun toUri(path: String): Uri =
    if (path.startsWith("file://") || path.startsWith("content://")) Uri.parse(path) else Uri.fromFile(File(path))

  /** Decodes a still upright (EXIF applied), capped at 1280 px for speed. */
  private fun decodeUpright(path: String): Bitmap {
    val uri = toUri(path)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val source = ImageDecoder.createSource(context.contentResolver, uri)
      return ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
        decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        val longest = maxOf(info.size.width, info.size.height)
        if (longest > MAX_STILL_PX) {
          val scale = MAX_STILL_PX.toFloat() / longest
          decoder.setTargetSize((info.size.width * scale).toInt(), (info.size.height * scale).toInt())
        }
      }
    }
    return context.contentResolver.openInputStream(uri).use { BitmapFactory.decodeStream(it) }
      ?: throw IllegalStateException("Cannot read image at $path")
  }

  companion object {
    private const val MODEL = "pose_landmarker_lite.task"
    private const val MAX_PEOPLE = 4
    private const val MAX_STILL_PX = 1280

    // BlazePose landmark indices for our 13 joints (see the spec's order).
    private val JOINTS = intArrayOf(0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28)

    private val FACE_LANDMARKS = intArrayOf(
      FaceLandmark.LEFT_EYE, FaceLandmark.RIGHT_EYE, FaceLandmark.NOSE_BASE,
      FaceLandmark.MOUTH_LEFT, FaceLandmark.MOUTH_RIGHT,
    )
  }
}
