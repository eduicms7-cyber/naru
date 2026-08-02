package com.naru.app.reviewwidget

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.AnimationUtils
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.ViewFlipper
import androidx.core.app.NotificationManagerCompat
import com.naru.app.R
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.abs

// 잠금화면 위에서 오늘 할 일 카드 + 오늘 복습할 카드를 슬라이드로 보여주는 "기억의 궁전" 풀스크린 액티비티.
// WakeMonitorService가 ACTION_SCREEN_ON을 감지했을 때 띄운다.
class WakeReviewActivity : Activity() {

  companion object {
    @Volatile
    var isShowing: Boolean = false

    // 화면이 켜질 때마다(하루 여러 번) 매번 재다운로드하지 않도록 프로세스가 살아있는 동안만
    // 쓰는 아주 단순한 메모리 캐시. 앱 프로세스가 죽으면 자연히 비워진다.
    private val imageCache = object : LinkedHashMap<String, Bitmap>(16, 0.75f, true) {
      override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Bitmap>?): Boolean {
        return size > 12
      }
    }
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

  // 카드 이미지를 백그라운드 스레드에서 내려받아 디코드한다. RN의 이미지 로더(Fresco)는
  // 이 액티비티가 뜨는 시점엔 아직 초기화됐다는 보장이 없어서(화면 켜짐이 앱 실행보다
  // 먼저일 수 있음) 의존하지 않고, 표준 API로 직접 처리 + 화면 폭 기준으로 다운샘플링.
  private fun loadImageInto(imageView: ImageView, url: String) {
    imageCache[url]?.let {
      imageView.setImageBitmap(it)
      return
    }
    Thread {
      try {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
          connectTimeout = 8000
          readTimeout = 8000
        }
        val bytes = connection.inputStream.use { it.readBytes() }
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        val targetWidth = resources.displayMetrics.widthPixels
        var sampleSize = 1
        while (bounds.outWidth / (sampleSize * 2) >= targetWidth) sampleSize *= 2
        val bitmap = BitmapFactory.decodeByteArray(
          bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sampleSize }
        )
        if (bitmap != null) {
          imageCache[url] = bitmap
          runOnUiThread {
            if (!isFinishing) imageView.setImageBitmap(bitmap)
          }
        }
      } catch (e: Exception) {
        // 실패하면 조용히 텍스트만 있는 카드로 남긴다.
      }
    }.start()
  }

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
      gravity = Gravity.CENTER_HORIZONTAL
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

    // 카드 안에 세로 스크롤(ScrollView)이 생기면서, 카드 위에서 시작한 좌우 스와이프를
    // 그 ScrollView가 세로 제스처로 가로채 다음 카드로 안 넘어가는 문제가 있었다.
    // 이 래퍼가 손가락 이동이 "가로가 더 큰지"를 먼저 판단해서, 가로 제스처면 자식(ScrollView)
    // 보다 먼저 가로채 카드 전환에 쓰고, 세로 제스처면 그대로 통과시켜 스크롤이 되게 한다.
    val swipeWrapper = SwipeAxisFrameLayout(this) { deltaX ->
      if (Math.abs(deltaX) >= dp(50)) {
        if (deltaX < 0) showIndex(currentIndex + 1, true) else showIndex(currentIndex - 1, false)
      }
    }
    swipeWrapper.addView(newFlipper, FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT
    ))
    // 고정 높이(320dp) 대신 위/아래 헤더·점·버튼을 뺀 나머지 공간을 카드가 다 채우도록 weight로 늘림 —
    // 화면 위아래에 빈 공간이 크게 남던 문제 수정.
    content.addView(
      swipeWrapper,
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f)
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

    // 버튼 3개가 폭이 좁은 화면에서 다 안 보이던 문제: WRAP_CONTENT + 넉넉한 패딩으로
    // 각자 필요한 만큼 차지하다 보니 화면 폭을 넘어갔음. weight로 3등분해서 화면 폭
    // 안에서 항상 다 보이도록 하고, minWidth 테마 기본값(보통 88dp)도 제거한다.
    val actionRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
    }

    fun actionButtonParams() = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
      marginStart = dp(6)
      marginEnd = dp(6)
    }

    val newSkipButton = Button(this).apply {
      text = "다시보기"
      textSize = 13f
      setTextColor(Color.parseColor("#8E8E93"))
      background = roundedDrawable("#2C2C2E", dp(10))
      setPadding(dp(8), dp(14), dp(8), dp(14))
      minWidth = 0
      minimumWidth = 0
      setOnClickListener { skipCurrent() }
    }
    skipButton = newSkipButton
    actionRow.addView(newSkipButton, actionButtonParams())

    val newCompleteButton = Button(this).apply {
      text = "기억완료"
      textSize = 13f
      setTextColor(Color.WHITE)
      background = roundedDrawable("#5B8DEF", dp(10))
      setPadding(dp(8), dp(14), dp(8), dp(14))
      minWidth = 0
      minimumWidth = 0
      setOnClickListener { completeCurrent() }
    }
    completeButton = newCompleteButton
    actionRow.addView(newCompleteButton, actionButtonParams())

    val finishButton = Button(this).apply {
      text = "마치기"
      textSize = 13f
      setTextColor(Color.parseColor("#8E8E93"))
      background = roundedDrawable("#2C2C2E", dp(10))
      setPadding(dp(8), dp(14), dp(8), dp(14))
      minWidth = 0
      minimumWidth = 0
      setOnClickListener { finish() }
    }
    actionRow.addView(finishButton, actionButtonParams())

    content.addView(actionRow, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(36) })

    root.addView(
      content,
      FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
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

  // 카드 내용이 길면(다음 슬라이드처럼 고정 높이라 넘칠 수 있음) 세로로 스크롤할 수
  // 있어야 한다. ScrollView + isFillViewport로 감싸서, 내용이 짧을 땐 기존처럼
  // 세로 가운데 정렬되고 길 땐 위에서부터 스크롤되도록 한다.
  private fun buildSlide(memo: DueMemo): View {
    val column = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(20), dp(20), dp(20), dp(20))
    }

    if (memo.imageUri != null) {
      val imageView = ImageView(this).apply {
        scaleType = ImageView.ScaleType.FIT_CENTER
        background = roundedDrawable("#00000000", dp(10))
        clipToOutline = true
      }
      column.addView(imageView, LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, dp(180)
      ).apply { bottomMargin = dp(14) })
      loadImageInto(imageView, memo.imageUri)
    }

    val text = TextView(this).apply {
      text = memo.text.ifEmpty { if (memo.imageUri != null) "" else "이미지 메모" }
      setTextColor(if (memo.color != null) Color.parseColor("#1C1C1E") else Color.WHITE)
      textSize = 20f
      gravity = Gravity.START
    }
    column.addView(text, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ))

    val inner = FrameLayout(this).apply {
      addView(column, FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT
      ).apply { gravity = Gravity.CENTER_VERTICAL })
    }
    val scroll = ScrollView(this).apply {
      isFillViewport = true
      addView(inner, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    }
    return FrameLayout(this).apply {
      background = roundedDrawable(memo.color ?: "#2C2C2E", dp(16))
      addView(scroll, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
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

}

// 자식(카드 안 ScrollView)이 세로 스크롤을 위해 터치를 가져가기 전에, 손가락 이동이
// 세로보다 가로로 더 크면 이 레이아웃이 먼저 가로채서 onSwipe로 넘긴다. 세로 위주
// 이동이면 그대로 통과시켜서 자식의 스크롤이 정상 동작한다.
private class SwipeAxisFrameLayout(
  context: android.content.Context,
  private val onSwipe: (deltaX: Float) -> Unit
) : FrameLayout(context) {
  private var downX = 0f
  private var downY = 0f
  private var draggingHorizontally = false
  private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop

  override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
    when (ev.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        downX = ev.x
        downY = ev.y
        draggingHorizontally = false
      }
      MotionEvent.ACTION_MOVE -> {
        val dx = ev.x - downX
        val dy = ev.y - downY
        if (!draggingHorizontally && (abs(dx) > touchSlop) && abs(dx) > abs(dy)) {
          draggingHorizontally = true
          return true
        }
      }
    }
    return false
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        if (draggingHorizontally) {
          onSwipe(event.x - downX)
        }
        draggingHorizontally = false
      }
    }
    return true
  }
}
