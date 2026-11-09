package com.fotoinpose

import android.net.Uri
import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalGetImage
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.pose.Pose
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.PoseLandmark
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions
import com.margelo.nitro.NitroModules
import com.margelo.nitro.camera.HybridFrameSpec
import com.margelo.nitro.camera.public.NativeFrame
import com.margelo.nitro.core.Promise
import com.margelo.nitro.fotoinpose.HybridFotoinPoseSpec
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

  @OptIn(ExperimentalGetImage::class)
  override fun detect(frame: HybridFrameSpec): DoubleArray {
    val proxy = (frame as? NativeFrame)?.image ?: return DoubleArray(0)
    val media = proxy.image ?: return DoubleArray(0)
    val rotation = proxy.imageInfo.rotationDegrees
    val input = InputImage.fromMediaImage(media, rotation)
    // Runs on VisionCamera's frame thread; the ImageProxy is only valid until
    // the frame is disposed, so wait here (with a cap) instead of going async.
    val pose = Tasks.await(streamDetector.process(input), 200, TimeUnit.MILLISECONDS)
    val quarterTurn = rotation == 90 || rotation == 270
    val w = if (quarterTurn) proxy.height else proxy.width
    val h = if (quarterTurn) proxy.width else proxy.height
    return pack(pose, w, h, mirror = frame.isMirrored)
  }

  override fun detectInImage(path: String): Promise<DoubleArray> = Promise.async {
    val context = NitroModules.applicationContext
      ?: throw IllegalStateException("No application context")
    val uri = if (path.startsWith("file://") || path.startsWith("content://")) {
      Uri.parse(path)
    } else {
      Uri.fromFile(File(path))
    }
    // Applies EXIF rotation; width/height are those of the upright bitmap.
    val input = InputImage.fromFilePath(context, uri)
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
