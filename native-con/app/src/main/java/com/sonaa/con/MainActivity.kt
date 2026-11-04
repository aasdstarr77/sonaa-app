package com.sonaa.con

import android.app.Activity
import android.os.Bundle
import android.graphics.Color
import android.view.Gravity
import android.view.View
import android.widget.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val api = "https://sonaa-backend-v2.vercel.app/api"
    private val executor = Executors.newSingleThreadExecutor()
    private var token = ""
    private val navy = Color.rgb(20, 55, 94)
    private val teal = Color.rgb(20, 153, 164)
    private lateinit var root: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        token = getPreferences(0).getString("token", "") ?: ""
        if (token.isNotBlank()) loadProfile() else showLogin()
    }

    private fun base(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        layoutDirection = View.LAYOUT_DIRECTION_RTL
        setPadding(28, 34, 28, 24)
        setBackgroundColor(Color.rgb(244, 248, 252))
    }

    private fun title(text: String, size: Float = 24f) = TextView(this).apply {
        this.text = text; textSize = size; setTextColor(navy); gravity = Gravity.RIGHT
        setPadding(0, 10, 0, 10)
    }

    private fun field(hint: String, secret: Boolean = false) = EditText(this).apply {
        this.hint = hint; textSize = 16f; gravity = Gravity.RIGHT
        setSingleLine(true); setPadding(18, 14, 18, 14)
        if (secret) inputType =  android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
        else inputType = android.text.InputType.TYPE_CLASS_PHONE
        backgroundTintList = android.content.res.ColorStateList.valueOf(teal)
    }

    private fun button(label: String, action: () -> Unit) = Button(this).apply {
        text = label; setTextColor(Color.WHITE); setBackgroundColor(navy)
        setOnClickListener { action() }
    }

    private fun showLogin(message: String = "") {
        root = base()
        root.addView(title("صُنّاع CON", 30f))
        root.addView(title("إدارة المنصة والإشراف من تطبيق أندرويد أصلي", 14f))
        root.addView(title("تسجيل الدخول", 20f))
        val phone = field("رقم هاتف حساب الإدارة")
        val password = field("كلمة المرور", true)
        root.addView(phone); root.addView(password)
        if (message.isNotBlank()) root.addView(title(message, 14f))
        root.addView(button("دخول لوحة الإدارة") {
            val p = phone.text.toString().trim()
            val pass = password.text.toString()
            if (p.isBlank() || pass.isBlank()) { showLogin("اكتب رقم الهاتف وكلمة المرور"); return@button }
            request("/admin/con-login", "POST", null, JSONObject().put("phone", p).put("password", pass)) { result, error ->
                if (error != null) showLogin(error)
                else {
                    token = result?.optString("token", "") ?: ""
                    if (token.isBlank()) showLogin("بيانات الدخول غير مكتملة")
                    else { getPreferences(0).edit().putString("token", token).apply(); loadProfile() }
                }
            }
        })
        setContentView(root)
    }

    private fun loadProfile() {
        request("/admin/me", "GET", token, null) { result, error ->
            if (error != null) { token = ""; getPreferences(0).edit().remove("token").apply(); showLogin(error) }
            else showDashboard(result ?: JSONObject())
        }
    }

    private fun showDashboard(profile: JSONObject) {
        root = base()
        root.addView(title("لوحة إدارة صُنّاع", 26f))
        root.addView(title("أهلًا " + profile.optString("name", "بالإدارة"), 16f))
        root.addView(title("نسخة Kotlin أصلية — مركز الإدارة", 13f))
        val status = title("جاري تحميل مؤشرات المنصة...", 15f)
        root.addView(status)
        root.addView(button("تحديث البيانات") { status.text = "جاري التحديث..."; loadCounts(status) })
        root.addView(button("تسجيل الخروج") {
            token = ""; getPreferences(0).edit().remove("token").apply(); showLogin()
        })
        setContentView(ScrollView(this).apply { addView(root) })
        loadCounts(status)
    }

    private fun loadCounts(status: TextView) {
        request("/admin/counts", "GET", token, null) { data, error ->
            status.text = if (error != null) error else {
                val c = data?.optJSONObject("counts") ?: data ?: JSONObject()
                "إجمالي الفنيين: " + c.optString("technicians", "—") +
                "\nالفنيون المعتمدون: " + c.optString("verifiedTechnicians", "—") +
                "\nالعملاء: " + c.optString("clients", "—")
            }
        }
    }

    private fun request(path: String, method: String, auth: String?, body: JSONObject?, done: (JSONObject?, String?) -> Unit) {
        executor.execute {
            var result: JSONObject? = null
            var error: String? = null
            try {
                val conn = URL(api + path).openConnection() as HttpURLConnection
                conn.requestMethod = method
                conn.connectTimeout = 20000; conn.readTimeout = 20000
                conn.setRequestProperty("Accept", "application/json")
                conn.setRequestProperty("Content-Type", "application/json")
                if (!auth.isNullOrBlank()) conn.setRequestProperty("Authorization", "Bearer $auth")
                if (body != null) { conn.doOutput = true; conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) } }
                val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
                val raw = stream.bufferedReader().use { it.readText() }
                val json = JSONObject(raw.ifBlank { "{}" })
                if (conn.responseCode !in 200..299) error = json.optString("message", json.optString("error", "خطأ من الخادم"))
                else result = json
                conn.disconnect()
            } catch (e: Exception) { error = e.message ?: "تعذر الاتصال بالخادم" }
            runOnUiThread { done(result, error) }
        }
    }

    override fun onDestroy() { super.onDestroy(); executor.shutdown() }
}
