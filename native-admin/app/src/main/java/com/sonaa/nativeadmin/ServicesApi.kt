package com.sonaa.nativeadmin

import com.google.gson.JsonElement
import retrofit2.http.GET

interface ServicesApi {
    @GET("api/services")
    suspend fun getServices(): JsonElement
}
