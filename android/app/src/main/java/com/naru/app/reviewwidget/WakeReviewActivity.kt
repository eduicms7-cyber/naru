package com.naru.app.reviewwidget

import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.GestureDetector
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.AnimationUtils
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.ViewFlipper
import androidx.core.app.NotificationManagerCompat
import com.naru.app.R

// 잠금화면 위에서 오늘 할 일 카드 + 오늘 복습할 카드를 슬라이드로 보여주는 "기억의 궁전" 풀스크린 액티비티.
// WakeMonitorService가 ACTION_SCREEN_ON을 감지했을 때 띄운다.
class WakeReviewActivity : Activity() {

  companion object {
    @Volatile
    var isShowing: Boolean = false
  }

  private var flipper: ViewFlipper? = null
  private var dots: LinearLayout? = null
  private var completeButton: Button? = null
  private var skipButton: Button? = null
  private lateinit var root: FrameLayout
  private var memos: MutableList<DueMemo> = mutableListOf()
  private var todos: MutableList<WakeTodo> = mutableListOf()
  // 할일이 있으면 플리퍼의 0번 슬라이드가 할일 카드이므로, memos 인덱스는 이 오프셋만큼 밀린다.
  // 세션 중 todos가 다 체크돼도(내용만 비워짐) 슬라이드 자체는 유지하므로 값은 고정.
  private var memoOffset = 0
  private var currentIndex = 0

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    isShowing = true

    applyLockScreenWindowFlags()

    memos = PriorityMemoStore.load(this).toMutableList()
    todos = TodoStore.load(this).toMutableList()
    if (memos.isEmpty() && todos.isEmpty()) {
      finish()
      return
    }
    memoOffset = if (todos.isNotEmpty()) 1 else 0

    setContentView(buildRootView())
    attachSwipeGesture()
  }

  override fun onDestroy() {
    isShowing = false
    NotificationManagerCompat.from(this).cancel(WAKE_ALERT_NOTIFICATION_ID)
    super.onDestroy()
  }

  private fun applyLockScreenWindowFlags() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  private fun buildRootView(): View {
    root = FrameLayout(this).apply {
      setBackgroundColor(Color.parseColor("#1C1C1E"))
    }

    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dp(28), dp(28), dp(28), dp(28))
    }

    val header = TextView(this).apply {
      text = "기억의 궁전"
      setTextColor(Color.parseColor("#8E8E93"))
      textSize = 14f
      gravity = Gravity.CENTER
    }
    content.addView(header, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { bottomMargin = dp(12) })

    val newFlipper = ViewFlipper(this).apply {
      inAnimation = AnimationUtils.loadAnimation(this@WakeReviewActivity, android.R.anim.fade_in)
      outAnimation = AnimationUtils.loadAnimation(this@WakeReviewActivity, android.R.anim.fade_out)
    }
    if (memoOffset == 1) {
      newFlipper.addView(buildTodoSlide())
    }
    memos.forEach { memo -> newFlipper.addView(buildSlide(memo)) }
    flipper = newFlipper
    content.addView(
      newFlipper,
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(320))
    )

    val newDots = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
    }
    dots = newDots
    content.addView(newDots, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(20) })
    renderDots()

    val actionRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
    }

    val newSkipButton = Button(this).apply {
      text = "다시보기"
      setTextColor(Color.parseColor("#8E8E93"))
      background = roundedDrawable("#2C2C2E", dp(10))
      setPadding(dp(24), dp(14), dp(24), dp(14))
      setOnClickListener { skipCurrent() }
    }
    skipButton = newSkipButton
    actionRow.addView(newSkipButton, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { marginEnd = dp(12) })

    val newCompleteButton = Button(this).apply {
      text = "기억완료"
      setTextColor(Color.WHITE)
      background = roundedDrawable("#5B8DEF", dp(10))
      setPadding(dp(28), dp(14), dp(28), dp(14))
      setOnClickListener { completeCurrent() }
    }
    completeButton = newCompleteButton
    actionRow.addView(newCompleteButton, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { marginEnd = dp(12) })

    val finishButton = Button(this).apply {
      text = "마치기"
      setTextColor(Color.parseColor("#8E8E93"))
      background = roundedDrawable("#2C2C2E", dp(10))
      setPadding(dp(28), dp(14), dp(28), dp(14))
      setOnClickListener { finish() }
    }
    actionRow.addView(finishButton, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ))

    content.addView(actionRow, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(36) })

    root.addView(
      content,
      FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT).apply {
        gravity = Gravity.CENTER
      }
    )

    updateActionRowVisibility()

    return root
  }

  // 할일 카드: 복습 카드와 같은 슬라이드 자리지만, 스크롤 가능한 체크리스트가 들어간다.
  // 항목을 탭하면 완료 처리되고 그 줄만 사라진다(카드 자체는 세션 중 유지).
  private fun buildTodoSlide(): View {
    val container = FrameLayout(this).apply {
      background = roundedDrawable("#2C2C2E", dp(16))
    }
    val list = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(20), dp(20), dp(20), dp(20))
    }
    val title = TextView(this).apply {
      text = "오늘 할 일"
      setTextColor(Color.parseColor("#8E8E93"))
      textSize = 13f
    }
    list.addView(title, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { bottomMargin = dp(10) })

    todos.forEach { todo -> list.addView(buildTodoRow(todo)) }

    val scroll = ScrollView(this)
    scroll.addView(list, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    container.addView(scroll, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
    return container
  }

  private fun buildTodoRow(todo: WakeTodo): View {
    return TextView(this).apply {
      text = "☐  ${todo.title}"
      setTextColor(Color.WHITE)
      textSize = 16f
      setPadding(0, dp(8), 0, dp(8))
      setOnClickListener {
        PendingTodoCompletionStore.add(this@WakeReviewActivity, todo.id)
        todos.remove(todo)
        (parent as? ViewGroup)?.removeView(this)
      }
    }
  }

  private fun buildSlide(memo: DueMemo): View {
    return FrameLayout(this).apply {
      background = roundedDrawable(memo.color ?: "#2C2C2E", dp(16))
      setPadding(dp(20), dp(20), dp(20), dp(20))
      addView(TextView(this@WakeReviewActivity).apply {
        text = memo.text.ifEmpty { "이미지 메모" }
        setTextColor(if (memo.color != null) Color.parseColor("#1C1C1E") else Color.WHITE)
        textSize = 20f
        gravity = Gravity.CENTER_VERTICAL or Gravity.START
      }, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT).apply {
        gravity = Gravity.CENTER
      })
    }
  }

  private fun totalSlideCount(): Int = memoOffset + memos.size

  private fun renderDots() {
    val dotsRow = dots ?: return
    dotsRow.removeAllViews()
    val total = totalSlideCount()
    if (total <= 1) return
    for (i in 0 until total) {
      val dot = View(this).apply {
        background = roundedDrawable(if (i == currentIndex) "#5B8DEF" else "#48484A", dp(4))
      }
      val size = dp(8)
      dotsRow.addView(dot, LinearLayout.LayoutParams(size, size).apply {
        marginStart = dp(4)
        marginEnd = dp(4)
      })
    }
  }

  // 할일 카드(0번, memoOffset이 있을 때)를 보고 있을 땐 복습 카드 전용 버튼들을 숨긴다.
  private fun updateActionRowVisibility() {
    val visibility = if (currentIndex < memoOffset) View.GONE else View.VISIBLE
    completeButton?.visibility = visibility
    skipButton?.visibility = visibility
  }

  private fun roundedDrawable(colorHex: String, radius: Int): GradientDrawable {
    return GradientDrawable().apply {
      setColor(Color.parseColor(colorHex))
      cornerRadius = radius.toFloat()
    }
  }

  private fun showIndex(index: Int, animateForward: Boolean) {
    val f = flipper ?: return
    val total = totalSlideCount()
    if (total == 0) return
    val next = (index + total) % total
    if (animateForward) {
      // 오른쪽에서 왼쪽으로 스와이프(다음 카드)할 땐 새 카드가 오른쪽에서 들어오고
      // 기존 카드는 왼쪽으로 나가야 손가락 방향과 맞는다. android.R.anim에는 이
      // 방향 조합이 없어서 res/anim에 직접 정의해뒀다.
      f.setInAnimation(this, R.anim.slide_in_right)
      f.setOutAnimation(this, R.anim.slide_out_left)
    } else {
      f.setInAnimation(this, android.R.anim.slide_in_left)
      f.setOutAnimation(this, android.R.anim.slide_out_right)
    }
    currentIndex = next
    f.displayedChild = currentIndex
    renderDots()
    updateActionRowVisibility()
  }

  // "기억완료" 처리: 대기열에 id를 남겨 두면 앱이 다음에 열릴 때 실제 간격 갱신이 적용된다.
  // 이 카드는 슬라이드 목록에서 바로 제거하고, 남은 슬라이드가 없으면 궁전을 닫는다.
  private fun completeCurrent() {
    val f = flipper ?: return
    if (currentIndex < memoOffset) return // 할일 카드에서는 이 버튼이 숨겨져 있어 정상적으로는 여기 안 옴
    val memoIndex = currentIndex - memoOffset
    if (memoIndex >= memos.size) return
    val memo = memos[memoIndex]
    PendingCompletionStore.add(this, memo.id)
    memos.removeAt(memoIndex)
    val total = totalSlideCount()
    if (total == 0) {
      finish()
      return
    }
    f.removeViewAt(currentIndex)
    if (currentIndex >= total) currentIndex = total - 1
    f.displayedChild = currentIndex
    renderDots()
    updateActionRowVisibility()
  }

  // "다시보기": 완료 처리(PendingCompletionStore)는 하지 않고 이번 세션 화면에서만 카드를 뺀다.
  // 복습 예정일은 그대로라 다음에 기억의 궁전을 다시 열면(재실행) 이 카드가 다시 나타난다.
  private fun skipCurrent() {
    val f = flipper ?: return
    if (currentIndex < memoOffset) return
    val memoIndex = currentIndex - memoOffset
    if (memoIndex >= memos.size) return
    memos.removeAt(memoIndex)
    val total = totalSlideCount()
    if (total == 0) {
      finish()
      return
    }
    f.removeViewAt(currentIndex)
    if (currentIndex >= total) currentIndex = total - 1
    f.displayedChild = currentIndex
    renderDots()
    updateActionRowVisibility()
  }

  private fun attachSwipeGesture() {
    val detector = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
      override fun onFling(
        e1: MotionEvent?,
        e2: MotionEvent,
        velocityX: Float,
        velocityY: Float
      ): Boolean {
        if (e1 == null || totalSlideCount() <= 1) return false
        val deltaX = e2.x - e1.x
        if (Math.abs(deltaX) < dp(50)) return false
        if (deltaX < 0) {
          showIndex(currentIndex + 1, true)
        } else {
          showIndex(currentIndex - 1, false)
        }
        return true
      }
    })
    findViewById<View>(android.R.id.content).setOnTouchListener { _, event ->
      detector.onTouchEvent(event)
      true
    }
  }
}
