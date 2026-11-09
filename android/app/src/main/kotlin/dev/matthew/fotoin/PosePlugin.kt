package dev.matthew.fotoin

import android.content.Context
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.pose.Pose
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.PoseLandmark
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.File

/**
 * Body pose detection with Google ML Kit (official Maven artifact).
 * Same channel contract as ios/Runner/PosePlugin.swift: returns
 * {aspect, joints: {name: [x, y, confidence]}} normalised to the upright
 * image (origin top-left), or null when nobody is found.
 */
class PosePlugin : FlutterPlugin, MethodChannel.MethodCallHandler {
    private lateinit var channel: MethodChannel
    private lateinit var context: Context

    // CPU only: skips ML Kit's acceleration mini-benchmark process, which
    // crashed on Android 16 (Infinix X6855). The base model is fast on CPU.
    private val streamDetector by lazy {
        PoseDetection.getClient(
            PoseDetectorOptions.Builder()
                .setDetectorMode(PoseDetectorOptions.STREAM_MODE)
                .setPreferredHardwareConfigs(PoseDetectorOptions.CPU)
                .build(),
        )
    }
    private val imageDetector by lazy {
        PoseDetection.getClient(
            PoseDetectorOptions.Builder()
                .setDetectorMode(PoseDetectorOptions.SINGLE_IMAGE_MODE)
                .setPreferredHardwareConfigs(PoseDetectorOptions.CPU)
                .build(),
        )
    }

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        context = binding.applicationContext
        channel = MethodChannel(binding.binaryMessenger, "fotoin/pose")
        channel.setMethodCallHandler(this)
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        channel.setMethodCallHandler(null)
        streamDetector.close()
        imageDetector.close()
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "detectFile" -> detectFile(call, result)
            "detectFrame" -> detectFrame(call, result)
            else -> result.notImplemented()
        }
    }

    private fun detectFile(call: MethodCall, result: MethodChannel.Result) {
        val path = call.argument<String>("path")
            ?: return result.error("bad_args", "Missing path", null)
        val image = try {
            // Applies EXIF rotation; width/height are of the upright bitmap.
            InputImage.fromFilePath(context, Uri.fromFile(File(path)))
        } catch (e: Exception) {
            return result.error("read_failed", e.message, null)
        }
        process(imageDetector, image, image.width, image.height, result)
    }

    private fun detectFrame(call: MethodCall, result: MethodChannel.Result) {
        val bytes = call.argument<ByteArray>("bytes")
        val width = call.argument<Int>("width")
        val height = call.argument<Int>("height")
        val sensor = call.argument<Int>("sensorOrientation")
        if (bytes == null || width == null || height == null || sensor == null) {
            return result.error("bad_args", "Missing frame fields", null)
        }
        // The app is locked to portrait, so the sensor orientation is the
        // whole rotation for both cameras.
        val rotation = ((sensor % 360) + 360) % 360
        val image = InputImage.fromByteArray(
            bytes, width, height, rotation, InputImage.IMAGE_FORMAT_NV21,
        )
        val quarterTurn = rotation == 90 || rotation == 270
        val uprightW = if (quarterTurn) height else width
        val uprightH = if (quarterTurn) width else height
        process(streamDetector, image, uprightW, uprightH, result)
    }

    private fun process(
        detector: com.google.mlkit.vision.pose.PoseDetector,
        image: InputImage,
        uprightW: Int,
        uprightH: Int,
        result: MethodChannel.Result,
    ) {
        detector.process(image)
            .addOnSuccessListener { pose -> result.success(toMap(pose, uprightW, uprightH)) }
            .addOnFailureListener { e -> result.error("mlkit_failed", e.message, null) }
    }

    private fun toMap(pose: Pose, w: Int, h: Int): Map<String, Any>? {
        if (pose.allPoseLandmarks.isEmpty()) return null
        val joints = HashMap<String, List<Double>>()
        for ((name, type) in JOINTS) {
            val lm = pose.getPoseLandmark(type) ?: continue
            joints[name] = listOf(
                (lm.position.x / w).toDouble(),
                (lm.position.y / h).toDouble(),
                lm.inFrameLikelihood.toDouble(),
            )
        }
        return mapOf("aspect" to w.toDouble() / h, "joints" to joints)
    }

    companion object {
        private val JOINTS = listOf(
            "nose" to PoseLandmark.NOSE,
            "leftShoulder" to PoseLandmark.LEFT_SHOULDER,
            "rightShoulder" to PoseLandmark.RIGHT_SHOULDER,
            "leftElbow" to PoseLandmark.LEFT_ELBOW,
            "rightElbow" to PoseLandmark.RIGHT_ELBOW,
            "leftWrist" to PoseLandmark.LEFT_WRIST,
            "rightWrist" to PoseLandmark.RIGHT_WRIST,
            "leftHip" to PoseLandmark.LEFT_HIP,
            "rightHip" to PoseLandmark.RIGHT_HIP,
            "leftKnee" to PoseLandmark.LEFT_KNEE,
            "rightKnee" to PoseLandmark.RIGHT_KNEE,
            "leftAnkle" to PoseLandmark.LEFT_ANKLE,
            "rightAnkle" to PoseLandmark.RIGHT_ANKLE,
        )
    }
}
