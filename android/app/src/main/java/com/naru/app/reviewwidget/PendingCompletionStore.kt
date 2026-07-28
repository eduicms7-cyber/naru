package com.naru.app.reviewwidget

import android.content.Context
import org.json.JSONArray

// 잠금화면 "기억의 궁전"에서 기억완료 처리한 메모 id를 앱이 다시 열릴 때까지 임시로 쌓아두는 큐.
object PendingCompletionStore {
  private const val PREFS_NAME = "naru_review_prefs"
  private const val KEY_IDS = "pending_completion_ids_json"

  fun add(context: Context, memoId: String) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val current = load(context).toMutableList()
    if (!current.contains(memoId)) current.add(memoId)
    prefs.edit().putString(KEY_IDS, JSONArray(current).toString()).apply()
  }

  // 저장된 목록을 반환하고 비운다 (RN 쪽에서 한 번만 소비하도록).
  fun drain(context: Context): List<String> {
    val ids = load(context)
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .remove(KEY_IDS)
      .apply()
    return ids
  }

  private fun load(context: Context): List<String> {
    val json = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(KEY_IDS, null) ?: return emptyList()
    return try {
      val arr = JSONArray(json)
      (0 until arr.length()).map { arr.getString(it) }
    } catch (e: Exception) {
      emptyList()
    }
  }
}
