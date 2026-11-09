package com.margelo.nitro.fotoinpose

import android.net.Uri
import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalGetImage
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceLandmark
import com.google.mlkit.vision.pose.Pose
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.PoseLandmark
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions
import com.margelo.nitro.NitroModules
import com.margelo.nitro.camera.HybridFrameSpec
import com.margelo.nitro.camera.public.NativeFrame
import com.margelo.nitro.core.Promise
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Body pose with Google ML Kit (official Maven artifact, bundled base model).
 * Output layout is documented in src/specs/FotoinPose.nitro.ts.
 *
 * CPU only: ML Kit's GPU path starts an acceleration mini-benchmark process
 * that crashed on Android 16 (Infinix X6855). The base model is fast on CPU.
 */
class HybridFotoinPose : HybridFotoinPoseSpec() {
  private val streamDetector by lazy { detector(PoseDetectorOptions.STREAM_MODE) }
  private val imageDetector by lazy { detector(PoseDetectorOptions.SINGLE_IMAGE_MODE) }
  private val streamFaceDetector by lazy { faceDetector(FaceDetectorOptions.PERFORMANCE_MODE_FAST) }
  private val imageFaceDetector by lazy { faceDetector(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE) }

  /** Upright input for a live frame plus its upright size. */
  private class FrameInput(val image: InputImage, val w: Int, val h: Int)

  @OptIn(ExperimentalGetImage::class)
  private fun frameInput(frame: HybridFrameSpec): FrameInput? {
    val proxy = (frame as? NativeFrame)?.image ?: return null
    val media = proxy.image ?: return null
    val rotation = proxy.imageInfo.rotationDegrees
    val quarterTurn = rotation == 90 || rotation == 270
    return FrameInput(
      InputImage.fromMediaImage(media, rotation),
      if (quarterTurn) proxy.height else proxy.width,
      if (quarterTurn) proxy.width else proxy.height,
    )
  }

  override fun detect(frame: HybridFrameSpec): DoubleArray {
    val input = frameInput(frame) ?: return DoubleArray(0)
    // Runs on VisionCamera's frame thread; the ImageProxy is only valid until
    // the frame is disposed, so wait here (with a cap) instead of going async.
    val pose = Tasks.await(streamDetector.process(input.image), 200, TimeUnit.MILLISECONDS)
    return pack(pose, input.w, input.h, mirror = frame.isMirrored)
  }

  override fun detectFace(frame: HybridFrameSpec): DoubleArray {
    val input = frameInput(frame) ?: return DoubleArray(0)
    val faces = Tasks.await(streamFaceDetector.process(input.image), 200, TimeUnit.MILLISECONDS)
    return packFace(faces, input.w, input.h, mirror = frame.isMirrored)
  }

  override fun detectFaceInImage(path: String): Promise<DoubleArray> = Promise.async {
    val input = stillInput(path)
    val faces = Tasks.await(imageFaceDetector.process(input))
    packFace(faces, input.width, input.height, mirror = false)
  }

  private fun stillInput(path: String): InputImage {
    val context = NitroModules.applicationContext
      ?: throw IllegalStateException("No application context")
    val uri = if (path.startsWith("file://") || path.startsWith("content://")) {
      Uri.parse(path)
    } else {
      Uri.fromFile(File(path))
    }
    // Applies EXIF rotation; width/height are those of the upright bitmap.
    return InputImage.fromFilePath(context, uri)
  }

  private fun faceDetector(mode: Int) = FaceDetection.getClient(
    FaceDetectorOptions.Builder()
      .setPerformanceMode(mode)
      .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
      .build(),
  )

  /** Largest face → [aspect, box(4), eyeA, eyeB, nose, mouthA, mouthB]. */
  private fun packFace(faces: List<Face>, w: Int, h: Int, mirror: Boolean): DoubleArray {
    val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() } ?: return DoubleArray(0)
    val types = intArrayOf(
      FaceLandmark.LEFT_EYE, FaceLandmark.RIGHT_EYE, FaceLandmark.NOSE_BASE,
      FaceLandmark.MOUTH_LEFT, FaceLandmark.MOUTH_RIGHT,
    )
    val points = types.map { face.getLandmark(it)?.position ?: return DoubleArray(0) }
    if (w <= 0 || h <= 0) return DoubleArray(0)
    fun x(v: Float) = (v / w).toDouble().let { if (mirror) 1 - it else it }
    val box = face.boundingBox
    val left = if (mirror) 1 - (box.right.toDouble() / w) else box.left.toDouble() / w
    val out = mutableListOf(w.toDouble() / h, left, box.top.toDouble() / h, box.width().toDouble() / w, box.height().toDouble() / h)
    for (p in points) {
      out += x(p.x)
      out += (p.y / h).toDouble()
    }
    return out.toDoubleArray()
  }

  override fun detectInImage(path: String): Promise<DoubleArray> = Promise.async {
    val input = stillInput(path)
    val pose = Tasks.await(imageDetector.process(input))
    pack(pose, input.width, input.height, mirror = false)
  }

  private fun detector(mode: Int) = PoseDetection.getClient(
    PoseDetectorOptions.Builder()
      .setDetectorMode(mode)
      .setPreferredHardwareConfigs(PoseDetectorOptions.CPU)
      .build(),
  )

  private fun pack(pose: Pose, w: Int, h: Int, mirror: Boolean): DoubleArray {
    if (pose.allPoseLandmarks.isEmpty() || w <= 0 || h <= 0) return DoubleArray(0)
    val out = DoubleArray(1 + JOINTS.size * 3)
    out[0] = w.toDouble() / h
    JOINTS.forEachIndexed { i, type ->
      val lm = pose.getPoseLandmark(type) ?: return@forEachIndexed
      val x = (lm.position.x / w).toDouble()
      out[1 + i * 3] = if (mirror) 1 - x else x
      out[2 + i * 3] = (lm.position.y / h).toDouble()
      out[3 + i * 3] = lm.inFrameLikelihood.toDouble()
    }
    return out
  }

  companion object {
    private val JOINTS = intArrayOf(
      PoseLandmark.NOSE,
      PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW,
      PoseLandmark.LEFT_WRIST, PoseLandmark.RIGHT_WRIST,
      PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
      PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE,
      PoseLandmark.LEFT_ANKLE, PoseLandmark.RIGHT_ANKLE,
    )
  }
}
