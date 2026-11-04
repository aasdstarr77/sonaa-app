package com.sonaa.nativeadmin
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import retrofit2.http.*
import retrofit2.Response
import okhttp3.ResponseBody
interface AdminApi {
 @POST("api/admin/login") suspend fun login(@Body body: JsonObject): JsonElement
 @GET("api/admin/me") suspend fun me(): JsonElement
 @GET suspend fun get(@Url path:String): JsonElement
 @Streaming @GET suspend fun getVoice(@Url path:String): Response<ResponseBody>
 @POST suspend fun post(@Url path:String,@Body body:JsonObject):JsonElement
 @PATCH suspend fun patch(@Url path:String,@Body body:JsonObject):JsonElement
 @PUT suspend fun put(@Url path:String,@Body body:JsonObject):JsonElement
 @DELETE suspend fun delete(@Url path:String):JsonElement
 @POST("api/notifications/admin/push-token") suspend fun registerFcmToken(@Body body: JsonObject): JsonElement
}
