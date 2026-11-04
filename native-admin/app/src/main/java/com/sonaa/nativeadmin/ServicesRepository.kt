package com.sonaa.nativeadmin

import com.google.gson.JsonElement
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class ServicesRepository {
    private val api: ServicesApi = Retrofit.Builder()
        .baseUrl("https://sonaa-backend-v2.vercel.app/")
        .addConverterFactory(GsonConverterFactory.create())
        .build()
        .create(ServicesApi::class.java)

    suspend fun loadServices(): List<JsonElement> {
        val response = api.getServices()
        val payload = if (response.isJsonObject) {
            val obj = response.asJsonObject
            listOf("data", "services", "results")
                .firstNotNullOfOrNull { key -> obj.get(key)?.takeIf { it.isJsonArray } }
                ?: response
        } else response

        return when {
            payload.isJsonArray -> payload.asJsonArray.map { it }
            else -> listOf(payload)
        }
    }
}
