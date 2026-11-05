package com.sonaa.nativeadmin
import android.content.Context
import java.io.File
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.HttpException
import com.google.gson.JsonParser
import retrofit2.converter.gson.GsonConverterFactory
class AdminRepository(context:Context){
 private val appContext=context.applicationContext
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
 suspend fun getMe():JsonElement=api.me()
 suspend fun hasSession():Boolean{if(auth.currentToken().isNullOrBlank())return false;return try{api.me();true}catch(_:Exception){auth.clear();false}}
 suspend fun logout()=auth.clear()
 suspend fun get(section:AdminSection):JsonElement=when(section.method){
  "POST"->api.post(section.path,section.defaultBody())
  else->api.get(section.path)
 }
 suspend fun get(path:String):JsonElement=try{api.get(path)}catch(e:HttpException){throw apiFailure(e)}
 private fun apiFailure(e:HttpException):IllegalStateException{
  val response=e.response()
  val raw=runCatching{response?.errorBody()?.string().orEmpty()}.getOrDefault("")
  val serverMessage=runCatching{
   val parsed=JsonParser.parseString(raw)
   if(parsed.isJsonObject)parsed.asJsonObject.get("message")?.takeIf{!it.isJsonNull}?.asString else null
  }.getOrNull()
  val detail=serverMessage?.takeIf{it.isNotBlank()}?:raw.replace(Regex("\\s+")," ").take(180).ifBlank{"لم يُرجع الخادم تفاصيل إضافية"}
  val requestPath=response?.raw()?.request?.url?.encodedPath.orEmpty()
  return IllegalStateException("فشل الطلب (HTTP \${e.code()}): $detail"+if(requestPath.isNotBlank())"\nالمسار: $requestPath" else "",e)
 }
 suspend fun downloadVoice(sn:String):File{
  val response=api.getVoice("api/orders/${sn}/voice")
  if(!response.isSuccessful)error("تعذر تحميل التسجيل الصوتي (HTTP ${response.code()})")
  val bytes=response.body()?.bytes()?:error("ملف التسجيل فارغ")
  val file=File(appContext.cacheDir,"order-${sn}-voice.audio")
  file.writeBytes(bytes)
  return file
 }
 suspend fun mutate(method:String,path:String,body:JsonObject=JsonObject()):JsonElement=try{
  when(method.uppercase()){
   "POST"->api.post(path,body);"PATCH"->api.patch(path,body);"PUT"->api.put(path,body);"DELETE"->api.delete(path);else->error("طريقة غير مدعومة")
  }
 }catch(e:HttpException){throw apiFailure(e)}
 suspend fun registerFcm(token:String){api.registerFcmToken(JsonObject().apply{addProperty("token",token);addProperty("platform","fcm-android")})}
}
enum class AdminSection(
 val title:String,
 val path:String,
 val keys:List<String>,
 val method:String="GET"
){
 DASHBOARD("الرئيسية","api/admin/counts",listOf("counts","data")),
 STATS("الإحصائيات","api/admin/stats",listOf("counts","stats","data")),
 ORDERS("طلبات العملاء","api/admin/orders",listOf("orders","data","items")),
 TECHNICIANS("كل الفنيين","api/admin/fannis",listOf("fannis","technicians","data","items")),
 PENDING("انتظار اعتماد الفنيين","api/admin/fannis",listOf("fannis","technicians","data","items")),
 PROFILE_EDITS("طلبات تعديل البيانات","api/admin/fanni-profile-edits",listOf("requests","edits","data","items")),
 DISABLED("الفنيون الموقوفون","api/admin/fannis",listOf("fannis","technicians","data","items")),
 LEVELS("المستويات والشارات","api/admin/fannis",listOf("fannis","data","items")),
 OFFERS("عروض الفنيين","api/admin/orders",listOf("orders","data","items")),
 WALLETS("محافظ الفنيين","api/admin/fannis",listOf("fannis","data","items")),
 TOPUPS("طلبات شحن المحافظ","api/admin/topup-requests",listOf("requests","data","items")),
 SERVICES("المهن والخدمات","api/admin/services",listOf("services","data","items")),
 REGIONS("مناطق الخدمة","api/admin/regions",listOf("regions","items","data")),
 COMPLAINTS("الشكاوى","api/admin/complaints",listOf("complaints","data","items")),
 SUPPORT("الدعم والمخالفات","api/admin/support/violations",listOf("violations","cases","data","items")),
 RECOVERY("طلبات استعادة كلمة المرور","api/password-recovery/admin/requests",listOf("recoveries","items","data")),
 NOTIFICATIONS("الإشعارات","api/admin/notifications/direct",listOf("notifications","campaigns","data","items")),
 CONTENT("الإعلانات والأسئلة الشائعة","api/admin/content",listOf("faqs","content","data")),
 PRICING("الأسعار والعمولات","api/admin/pricing",listOf("pricing","data","history")),
 REPORTS("التقارير","api/admin/reports",listOf("summary","topServices","data"),"POST"),
 PAGE_VISITS("سجل زيارات الموقع","api/admin/page-visits",listOf("recent","summary","data")),
 SECURITY("سجل التدقيق والأمان","api/admin/audit-logs",listOf("logs","items","data")),
 SETTINGS("إعدادات المنصة","api/admin/settings",listOf("settings","data")),
 ROLES("صلاحيات المشرفين","api/admin/admin-users",listOf("users","admins","data","items")),
 CLIENTS("كل العملاء","api/admin/clients",listOf("clients","items","data"));
 fun defaultBody()=JsonObject()
 fun extract(p:JsonElement):List<JsonElement>{
  if(p.isJsonArray)return p.asJsonArray.map{it}
  if(!p.isJsonObject)return emptyList()
  val obj=p.asJsonObject
  for(k in keys){val v=obj.get(k)?:continue;if(v.isJsonArray)return v.asJsonArray.map{it}}
  val data=obj.get("data")
  if(data?.isJsonObject==true){for(k in keys){val v=data.asJsonObject.get(k)?:continue;if(v.isJsonArray)return v.asJsonArray.map{it}}}
  return emptyList()
 }
}
