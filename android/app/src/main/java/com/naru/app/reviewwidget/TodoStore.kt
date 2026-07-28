package com.naru.app.reviewwidget

import android.content.Context
import org.json.JSONArray

data class WakeTodo(val id: String, val title: String)

// 기억의 궁전(잠금화면)에 보여줄 오늘의 미완료 할일 목록.
object TodoStore {
  private const val PREFS_NAME = "naru_review_prefs"
  private const val KEY_TODOS = "wake_todos_json"

  fun save(context: Context, json: String) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_TODOS, json)
      .apply()
  }

  fun load(context: Context): List<WakeTodo> {
    val json = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(KEY_TODOS, null) ?: return emptyList()
    return try {
      val arr = JSONArray(json)
      (0 until arr.length()).map { i ->
        val obj = arr.getJSONObject(i)
        WakeTodo(obj.getString("id"), obj.optString("title", ""))
      }
    } catch (e: Exception) {
      emptyList()
    }
  }
}
