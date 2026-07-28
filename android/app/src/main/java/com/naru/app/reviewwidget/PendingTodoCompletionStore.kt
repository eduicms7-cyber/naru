package com.naru.app.reviewwidget

import android.content.Context
import org.json.JSONArray

// 잠금화면 "기억의 궁전"에서 완료 체크한 할일 id를 앱이 다시 열릴 때까지 임시로 쌓아두는 큐.
// PendingCompletionStore(메모용)와 완전히 별도로 두어 메모 id와 섞이지 않게 한다.
object PendingTodoCompletionStore {
  private const val PREFS_NAME = "naru_review_prefs"
  private const val KEY_IDS = "pending_todo_completion_ids_json"

  fun add(context: Context, todoId: String) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val current = load(context).toMutableList()
    if (!current.contains(todoId)) current.add(todoId)
    prefs.edit().putString(KEY_IDS, JSONArray(current).toString()).apply()
  }

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
