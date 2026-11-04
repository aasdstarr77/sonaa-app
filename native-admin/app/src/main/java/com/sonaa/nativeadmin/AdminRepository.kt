package com.sonaa.nativeadmin
import android.content.Context
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
class AdminRepository(context:Context){
 private val auth=AuthStore(context.applicationContext)
 private val client=OkHttpClient.Builder().addInterceptor{chain->
  val token=runBlocking{auth.currentToken()}
  val req=chain.request().newBuilder().apply{if(!token.isNullOrBlank())header("Authorization","Bearer $token");header("Accept","application/json")}.build()
  chain.proceed(req)
 }.build()
 private val api=Retrofit.Builder().baseUrl("https://sonaa-backend-v2.vercel.app/").client(client).addConverterFactory(GsonConverterFactory.create()).build().create(AdminApi::class.java)
 suspend fun login(phone:String,password:String):JsonElement{
  val response=api.login(JsonObject().apply{addProperty("phone",phone.trim());addProperty("password",password)})
  val token=response.asJsonObject.get("token")?.asString?:error("الخادم لم يُرجع رمز الجلسة")
  auth.saveToken(token);return response
 }
 suspend fun hasSession():Boolean{if(auth.currentToken().isNullOrBlank())return false;return try{api.me();true}catch(_:Exception){auth.clear();false}}
 suspend fun logout()=auth.clear()
 suspend fun get(path:String)=api.get(path)
 suspend fun mutate(method:String,path:String,body:JsonObject=JsonObject()):JsonElement=when(method.uppercase()){
  "POST"->api.post(path,body);"PATCH"->api.patch(path,body);"PUT"->api.put(path,body);"DELETE"->api.delete(path);else->error("طريقة غير مدعومة")
 }
 suspend fun registerFcm(token:String){api.registerFcmToken(JsonObject().apply{addProperty("token",token);addProperty("platform","fcm-android")})}
}
enum class AdminSection(val title:String,val path:String,val keys:List<String>){
 DASHBOARD("الرئيسية","api/admin/stats",listOf("counts","stats","data")),
 STATS("الإحصائيات","api/admin/stats",listOf("stats","data","counts")),
 ORDERS("طلبات العملاء","api/admin/orders",listOf("orders","data","items")),
 TECHNICIANS("كل الفنيين","api/admin/fannis",listOf("fannis","technicians","data","items")),
 PENDING("انتظار اعتماد الفنيين","api/admin/fannis?status=pending",listOf("fannis","technicians","data","items")),
 PROFILE_EDITS("طلبات تعديل البيانات","api/admin/fanni-profile-edits",listOf("requests","edits","data","items")),
 DISABLED("الفنيون الموقوفون","api/admin/fannis?status=disabled",listOf("fannis","technicians","data","items")),
 LEVELS("المستويات والشارات","api/admin/fannis",listOf("fannis","data","items")),
 OFFERS("عروض الفنيين","api/admin/offers",listOf("offers","data","items")),
 WALLETS("محافظ الفنيين","api/admin/fannis",listOf("fannis","data","items")),
 TOPUPS("طلبات شحن المحافظ","api/admin/topup-requests",listOf("requests","topups","data","items")),
 SERVICES("المهن والخدمات","api/admin/services",listOf("services","data","items")),
 REGIONS("مناطق الخدمة","api/admin/regions",listOf("regions","data","items")),
 COMPLAINTS("الشكاوى","api/admin/complaints",listOf("complaints","data","items")),
 SUPPORT("الدعم والمخالفات","api/admin/support/violations",listOf("cases","violations","data","items")),
 NOTIFICATIONS("الإشعارات","api/admin/notifications/direct",listOf("notifications","campaigns","data","items")),
 CONTENT("الإعلانات والأسئلة الشائعة","api/admin/content",listOf("faqs","content","data","items")),
 PRICING("الأسعار والعمولات","api/admin/pricing",listOf("pricing","data","settings")),
 REPORTS("التقارير","api/admin/reports",listOf("reports","data","items")),
 PAGE_VISITS("سجل زيارات الموقع","api/admin/page-visits",listOf("visits","data","items")),
 SECURITY("سجل التدقيق والأمان","api/admin/audit-logs",listOf("logs","auditLogs","data","items")),
 SETTINGS("إعدادات المنصة","api/admin/settings",listOf("settings","data")),
 ROLES("صلاحيات المشرفين","api/admin/admin-users",listOf("users","admins","data","items")),
 CLIENTS("كل العملاء","api/admin/clients",listOf("clients","data","items"));
 fun extract(p:JsonElement):List<JsonElement>{if(p.isJsonArray)return p.asJsonArray.map{it};if(!p.isJsonObject)return listOf(p);for(k in keys){val v=p.asJsonObject.get(k)?:continue;if(v.isJsonArray)return v.asJsonArray.map{it}};return emptyList()}
}
