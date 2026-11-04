package com.sonaa.nativeadmin
import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
private val Context.adminDataStore by preferencesDataStore(name = "sonaa_admin_session")
class AuthStore(private val context: Context) {
    private val tokenKey = stringPreferencesKey("admin_token")
    val token: Flow<String?> = context.adminDataStore.data.map { it[tokenKey] }
    suspend fun saveToken(token: String) { context.adminDataStore.edit { it[tokenKey] = token } }
    suspend fun clear() { context.adminDataStore.edit { it.remove(tokenKey) } }
    suspend fun currentToken(): String? = token.first()
}
