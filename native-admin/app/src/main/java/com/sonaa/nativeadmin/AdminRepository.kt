package com.sonaa.nativeadmin
import android.content.Context
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
class AdminRepository(context: Context) {
    private val auth = AuthStore(context.applicationContext)
    private val client = OkHttpClient.Builder().addInterceptor { chain ->
        val token = runBlocking { auth.currentToken() }
        val request = chain.request().newBuilder().apply {
            if (!token.isNullOrBlank()) header("Authorization", "Bearer $token")
            header("Accept", "application/json")
        }.build()
        chain.proceed(request)
    }.build()
    private val api = Retrofit.Builder().baseUrl("https://sonaa-backend-v2.vercel.app/")
        .client(client).addConverterFactory(GsonConverterFactory.create()).build().create(AdminApi::class.java)
    suspend fun login(phone: String, password: String): JsonElement {
        val body = JsonObject().apply { addProperty("phone", phone.trim()); addProperty("password", password) }
        val response = api.login(body)
        val token = response.asJsonObject.get("token")?.asString ?: error("الخادم لم يُرجع رمز الجلسة")
        auth.saveToken(token)
        return response
    }
    suspend fun hasSession() = !auth.currentToken().isNullOrBlank()
    suspend fun logout() = auth.clear()
    suspend fun stats() = api.stats()
    suspend fun load(section: AdminSection): JsonElement = when (section) {
        AdminSection.DASHBOARD -> api.stats()
        AdminSection.ORDERS -> api.orders()
        AdminSection.TECHNICIANS -> api.technicians()
        AdminSection.CLIENTS -> api.clients()
        AdminSection.SERVICES -> api.services()
        AdminSection.REGIONS -> api.regions()
        AdminSection.COMPLAINTS -> api.complaints()
    }
    suspend fun registerFcm(token: String) {
        val body = JsonObject().apply { addProperty("token", token); addProperty("platform", "fcm-android") }
        api.registerFcmToken(body)
    }
}
enum class AdminSection(val title: String, val keys: List<String>) {
    DASHBOARD("الرئيسية", listOf("counts", "stats", "data")),
    ORDERS("الطلبات", listOf("orders", "data", "items")),
    TECHNICIANS("الفنيون", listOf("fannis", "technicians", "data", "items")),
    CLIENTS("العملاء", listOf("clients", "data", "items")),
    SERVICES("الخدمات", listOf("services", "data", "items")),
    REGIONS("المناطق", listOf("regions", "items", "data")),
    COMPLAINTS("الشكاوى", listOf("complaints", "items", "data"))
}
