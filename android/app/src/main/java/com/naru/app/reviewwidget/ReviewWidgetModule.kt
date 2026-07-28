package com.naru.app.reviewwidget

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.naru.app.MainActivity

private const val CHANNEL_ID = "naru_review_channel"
private const val NOTIFICATION_ID = 1001

class ReviewWidgetModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "ReviewWidget"

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager =
        reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (manager.getNotificationChannel(CHANNEL_ID) == null) {
        val channel = NotificationChannel(
          CHANNEL_ID,
          "기억의 궁전",
          NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
          description = "잠금화면에서 오늘 복습할 카드를 보여줍니다"
          setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
      }
    }
  }

  private fun hasNotificationPermission(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
    return ActivityCompat.checkSelfPermission(
      reactApplicationContext,
      Manifest.permission.POST_NOTIFICATIONS
    ) == PackageManager.PERMISSION_GRANTED
  }

  private fun buildContentIntent(): PendingIntent {
    val intent = Intent(reactApplicationContext, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    return PendingIntent.getActivity(
      reactApplicationContext,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  @ReactMethod
  fun showReview(title: String, body: String) {
    ensureChannel()
    if (!hasNotificationPermission()) return

    val notification = NotificationCompat.Builder(reactApplicationContext, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle(title)
      .setContentText(body)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setContentIntent(buildContentIntent())
      .build()

    NotificationManagerCompat.from(reactApplicationContext).notify(NOTIFICATION_ID, notification)
  }

  @ReactMethod
  fun clearReview() {
    NotificationManagerCompat.from(reactApplicationContext).cancel(NOTIFICATION_ID)
  }

  @ReactMethod
  fun setDueMemos(memosJson: String) {
    PriorityMemoStore.save(reactApplicationContext, memosJson)
  }

  @ReactMethod
  fun getPendingCompletions(promise: Promise) {
    val ids = PendingCompletionStore.drain(reactApplicationContext)
    val arr = com.facebook.react.bridge.Arguments.createArray()
    ids.forEach { arr.pushString(it) }
    promise.resolve(arr)
  }

  @ReactMethod
  fun setTodos(todosJson: String) {
    TodoStore.save(reactApplicationContext, todosJson)
  }

  @ReactMethod
  fun getPendingTodoCompletions(promise: Promise) {
    val ids = PendingTodoCompletionStore.drain(reactApplicationContext)
    val arr = com.facebook.react.bridge.Arguments.createArray()
    ids.forEach { arr.pushString(it) }
    promise.resolve(arr)
  }

  @ReactMethod
  fun startWakeMonitor() {
    val intent = Intent(reactApplicationContext, WakeMonitorService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      reactApplicationContext.startForegroundService(intent)
    } else {
      reactApplicationContext.startService(intent)
    }
  }

  @ReactMethod
  fun canUseFullScreenIntent(promise: Promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val manager = reactApplicationContext.getSystemService(NotificationManager::class.java)
      promise.resolve(manager.canUseFullScreenIntent())
    } else {
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun openFullScreenIntentSettings() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val intent = Intent(android.provider.Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
        data = android.net.Uri.parse("package:${reactApplicationContext.packageName}")
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }
      reactApplicationContext.startActivity(intent)
    }
  }

  @ReactMethod
  fun requestPermission(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && activity != null && !hasNotificationPermission()) {
      ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 9001)
    }
    promise.resolve(hasNotificationPermission())
  }
}
