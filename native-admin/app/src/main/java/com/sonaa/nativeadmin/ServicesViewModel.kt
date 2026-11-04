package com.sonaa.nativeadmin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.JsonElement
import kotlinx.coroutines.launch

sealed interface ServicesUiState {
    data object Loading : ServicesUiState
    data class Success(val services: List<JsonElement>) : ServicesUiState
    data class Error(val message: String) : ServicesUiState
}

class ServicesViewModel : ViewModel() {
    private val repository = ServicesRepository()
    var state: ServicesUiState = ServicesUiState.Loading
        private set

    private val observers = mutableListOf<(ServicesUiState) -> Unit>()

    fun observe(observer: (ServicesUiState) -> Unit) {
        observers += observer
        observer(state)
    }

    private fun update(newState: ServicesUiState) {
        state = newState
        observers.forEach { it(newState) }
    }

    fun load() {
        update(ServicesUiState.Loading)
        viewModelScope.launch {
            try {
                update(ServicesUiState.Success(repository.loadServices()))
            } catch (error: Exception) {
                update(ServicesUiState.Error(error.localizedMessage ?: "Request failed"))
            }
        }
    }
}
