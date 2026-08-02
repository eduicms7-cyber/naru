package com.naru.app.reviewwidget

import android.content.Context
import org.json.JSONArray

data class DueMemo(val id: String, val text: String, val color: String?, val imageUri: String?)

// 이름은 예전 "공지" 시절 그대로지만, 지금은 오늘 복습할 모든 메모(due)를 담는다.
object PriorityMemoStore {
  private const val PREFS_NAME = "naru_review_prefs"
  private const val KEY_MEMOS = "priority_memos_json"

  fun save(context: Context, json: String) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_MEMOS, json)
      .apply()
  }

  fun load(context: Context): List<DueMemo> {
    val json = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(KEY_MEMOS, null) ?: return emptyList()
    return try {
      val arr = JSONArray(json)
      (0 until arr.length()).map { i ->
        val obj = arr.getJSONObject(i)
        val color = if (obj.isNull("color")) null else obj.optString("color").takeIf { it.isNotEmpty() }
        val imageUri = if (obj.isNull("imageUri")) null else obj.optString("imageUri").takeIf { it.isNotEmpty() }
        DueMemo(obj.getString("id"), obj.optString("text", ""), color, imageUri)
      }
    } catch (e: Exception) {
      emptyList()
    }
  }
}
