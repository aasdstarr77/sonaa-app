package com.sonaa.nativeadmin
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
interface AdminApi {
    @POST("api/admin/login") suspend fun login(@Body body: JsonObject): JsonElement
    @GET("api/admin/stats") suspend fun stats(): JsonElement
    @GET("api/admin/orders") suspend fun orders(): JsonElement
    @GET("api/admin/fannis") suspend fun technicians(): JsonElement
    @GET("api/admin/clients") suspend fun clients(): JsonElement
    @GET("api/admin/services") suspend fun services(): JsonElement
    @GET("api/admin/regions") suspend fun regions(): JsonElement
    @GET("api/admin/complaints") suspend fun complaints(): JsonElement
    @POST("api/notifications/admin/push-token") suspend fun registerFcmToken(@Body body: JsonObject): JsonElement
}
