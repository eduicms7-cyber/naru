package com.naru.app.reviewwidget

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

private const val MONITOR_CHANNEL_ID = "naru_wake_monitor_channel"
private const val MONITOR_NOTIFICATION_ID = 1002
private const val WAKE_ALERT_CHANNEL_ID = "naru_wake_alert_channel"
const val WAKE_ALERT_NOTIFICATION_ID = 1003

// 화면이 켜질 때(전원 버튼/더블탭) 오늘 복습할 메모가 있으면 잠금화면 위에
// "기억의 궁전"(WakeReviewActivity)을 띄우기 위해 계속 살아있어야 하는 포그라운드 서비스.
class WakeMonitorService : Service() {

  private var receiver: BroadcastReceiver? = null

  override fun onCreate() {
    super.onCreate()
    startForegroundCompat()
    registerScreenOnReceiver()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    receiver?.let { unregisterReceiver(it) }
    receiver = null
    super.onDestroy()
  }

  private fun registerScreenOnReceiver() {
    if (receiver != null) return
    val screenReceiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_SCREEN_ON) return
        val memos = PriorityMemoStore.load(context)
        val todos = TodoStore.load(context)
        if ((memos.isNotEmpty() || todos.isNotEmpty()) && !WakeReviewActivity.isShowing) {
          postFullScreenAlert(context)
        }
      }
    }
    receiver = screenReceiver
    registerReceiver(screenReceiver, IntentFilter(Intent.ACTION_SCREEN_ON))
  }

  private fun postFullScreenAlert(context: Context) {
    ensureAlertChannel(context)

    val activityIntent = Intent(context, WakeReviewActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val fullScreenPendingIntent = PendingIntent.getActivity(
      context,
      0,
      activityIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notification = NotificationCompat.Builder(context, WAKE_ALERT_CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle("기억의 궁전")
      .setContentText("오늘 복습할 카드가 있습니다")
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setFullScreenIntent(fullScreenPendingIntent, true)
      .setContentIntent(fullScreenPendingIntent)
      .setAutoCancel(true)
      .build()

    NotificationManagerCompat.from(context).notify(WAKE_ALERT_NOTIFICATION_ID, notification)
  }

  private fun ensureAlertChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(WAKE_ALERT_CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      WAKE_ALERT_CHANNEL_ID,
      "기억의 궁전 잠금화면 알림",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "화면이 켜질 때 오늘 복습할 카드를 전체화면으로 보여줍니다"
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  private fun startForegroundCompat() {
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(MONITOR_NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(MONITOR_NOTIFICATION_ID, notification)
    }
  }

  private fun buildNotification(): Notification {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(NotificationManager::class.java)
      if (manager.getNotificationChannel(MONITOR_CHANNEL_ID) == null) {
        val channel = NotificationChannel(
          MONITOR_CHANNEL_ID,
          "기억의 궁전 감시",
          NotificationManager.IMPORTANCE_MIN
        ).apply {
          description = "화면이 켜질 때 복습 카드를 보여주기 위해 실행 중입니다"
          setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
      }
    }
    return NotificationCompat.Builder(this, MONITOR_CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle("Naru 기억의 궁전 감시 중")
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .setOngoing(true)
      .build()
  }
}
