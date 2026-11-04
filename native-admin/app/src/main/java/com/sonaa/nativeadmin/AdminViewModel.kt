package com.sonaa.nativeadmin
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.JsonElement
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
data class AdminUiState(
    val checking: Boolean = true, val authenticated: Boolean = false, val busy: Boolean = false,
    val error: String? = null, val section: AdminSection = AdminSection.DASHBOARD,
    val stats: JsonElement? = null, val items: List<JsonElement> = emptyList()
)
class AdminViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = AdminRepository(app)
    private val _state = MutableStateFlow(AdminUiState())
    val state = _state.asStateFlow()
    fun restore() = viewModelScope.launch {
        val ok = repo.hasSession()
        _state.value = _state.value.copy(checking = false, authenticated = ok)
        if (ok) refresh()
    }
    fun login(phone: String, password: String) = viewModelScope.launch {
        _state.value = _state.value.copy(busy = true, error = null)
        try { repo.login(phone, password); _state.value = _state.value.copy(busy = false, authenticated = true); refresh() }
        catch (e: Exception) { _state.value = _state.value.copy(busy = false, error = e.message ?: "تعذر تسجيل الدخول") }
    }
    fun refresh() = viewModelScope.launch {
        _state.value = _state.value.copy(section = AdminSection.DASHBOARD, busy = true, error = null)
        try { val data = repo.stats(); _state.value = _state.value.copy(busy = false, stats = data, items = emptyList()) }
        catch (e: Exception) { _state.value = _state.value.copy(busy = false, error = e.message ?: "تعذر تحميل الإحصائيات") }
    }
    fun open(section: AdminSection) = viewModelScope.launch {
        _state.value = _state.value.copy(section = section, busy = true, error = null, items = emptyList())
        try {
            val payload = repo.load(section)
            val list = extract(payload, section.keys)
            _state.value = _state.value.copy(busy = false, items = list)
        } catch (e: Exception) { _state.value = _state.value.copy(busy = false, error = e.message ?: "تعذر تحميل البيانات") }
    }
    fun retry() { if (_state.value.section == AdminSection.DASHBOARD) refresh() else open(_state.value.section) }
    fun logout() = viewModelScope.launch { repo.logout(); _state.value = AdminUiState(checking = false) }
    fun registerFcm(token: String) = viewModelScope.launch { runCatching { repo.registerFcm(token) } }
    private fun extract(p: JsonElement, keys: List<String>): List<JsonElement> {
        if (p.isJsonArray) return p.asJsonArray.map { it }
        if (!p.isJsonObject) return listOf(p)
        for (key in keys) {
            val v = p.asJsonObject.get(key) ?: continue
            if (v.isJsonArray) return v.asJsonArray.map { it }
        }
        return emptyList()
    }
}
