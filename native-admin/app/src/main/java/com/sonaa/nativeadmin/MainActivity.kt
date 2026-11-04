package com.sonaa.nativeadmin
import android.Manifest
import android.app.NotificationManager
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.gson.JsonElement
private val Accent = Color(0xFF087F9C)
private val DarkAccent = Color(0xFF07566B)
private val Background = Color(0xFFF4F8FA)
class MainActivity : ComponentActivity() {
    private var pendingDestination by mutableStateOf<String?>(null)
    private val askNotifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        initializeFirebase()
        SonaaMessagingService.createChannels(getSystemService(NotificationManager::class.java))
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
        pendingDestination = intent?.getStringExtra("destination")
        setContent {
            val vm: AdminViewModel = viewModel()
            val state by vm.state.collectAsState()
            LaunchedEffect(Unit) { vm.restore() }
            LaunchedEffect(pendingDestination, state.authenticated) { if (state.authenticated) { navigate(pendingDestination, vm); pendingDestination = null } }
            LaunchedEffect(state.authenticated) {
                if (state.authenticated) {
                    FirebaseMessaging.getInstance().token.addOnSuccessListener(vm::registerFcm)
                    getSharedPreferences("sonaa_admin_session", MODE_PRIVATE).getString("pending_fcm_token", null)?.let(vm::registerFcm)
                }
            }
            MaterialTheme {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    Surface(Modifier.fillMaxSize(), color = Background) {
                        when {
                            state.checking -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Accent) }
                            !state.authenticated -> LoginScreen(state, vm::login)
                            else -> HomeScreen(state, vm)
                        }
                    }
                }
            }
        }
    }
    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent); setIntent(intent)
        pendingDestination = intent.getStringExtra("destination")
    }
    private fun navigate(destination: String?, vm: AdminViewModel?) {
        val section = when (destination) {
            "orders" -> AdminSection.ORDERS
            "technicians" -> AdminSection.TECHNICIANS
            "clients" -> AdminSection.CLIENTS
            "complaints" -> AdminSection.COMPLAINTS
            else -> null
        }
        if (section != null && vm != null) vm.open(section)
    }
    private fun initializeFirebase() {
        if (FirebaseApp.getApps(this).isEmpty()) {
            FirebaseApp.initializeApp(this, FirebaseOptions.Builder()
                .setApplicationId(BuildConfig.FIREBASE_APP_ID).setApiKey(BuildConfig.FIREBASE_API_KEY)
                .setProjectId(BuildConfig.FIREBASE_PROJECT_ID).setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID).build())
        }
    }
}
@Composable private fun LoginScreen(state: AdminUiState, login: (String, String) -> Unit) {
    var phone by remember { mutableStateOf("") }; var password by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Image(painterResource(R.drawable.sonaa_logo), "شعار صُنّاع", Modifier.size(112.dp))
        Spacer(Modifier.height(16.dp))
        Text("إدارة صُنّاع CON", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = DarkAccent)
        Text("سجّل الدخول للمتابعة", color = Color.Gray, modifier = Modifier.padding(bottom = 22.dp, top = 5.dp))
        OutlinedTextField(phone, { phone = it }, label = { Text("رقم الهاتف") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), singleLine = true, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(password, { password = it }, label = { Text("كلمة المرور") }, visualTransformation = PasswordVisualTransformation(), singleLine = true, modifier = Modifier.fillMaxWidth())
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp)) }
        Button(onClick = { login(phone, password) }, enabled = !state.busy && phone.isNotBlank() && password.isNotBlank(), modifier = Modifier.fillMaxWidth().padding(top = 18.dp)) {
            if (state.busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("تسجيل الدخول")
        }
    }
}
@Composable private fun HomeScreen(state: AdminUiState, vm: AdminViewModel) {
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().background(Color.White).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Image(painterResource(R.drawable.sonaa_logo), "شعار صُنّاع", Modifier.size(42.dp))
            Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                Text("إدارة صُنّاع CON", fontWeight = FontWeight.Bold, color = DarkAccent)
                Text(state.section.title, style = MaterialTheme.typography.labelMedium, color = Color.Gray)
            }
            TextButton(onClick = vm::logout) { Text("خروج", color = Color(0xFFB3261E)) }
        }
        Row(Modifier.fillMaxWidth().background(Color.White).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            AdminSection.entries.forEach { tab ->
                TextButton(onClick = { if (tab == AdminSection.DASHBOARD) vm.refresh() else vm.open(tab) }) {
                    Text(tab.title, color = if (tab == state.section) Accent else Color.DarkGray, fontWeight = if (tab == state.section) FontWeight.Bold else FontWeight.Normal)
                }
            }
        }
        when {
            state.busy -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Accent) }
            state.error != null -> Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                Text(state.error, color = MaterialTheme.colorScheme.error)
                Button(onClick = vm::retry, modifier = Modifier.padding(top = 12.dp)) { Text("إعادة المحاولة") }
            }
            state.section == AdminSection.DASHBOARD -> Dashboard(state.stats)
            else -> ListScreen(state.section, state.items, vm::retry)
        }
    }
}
@Composable private fun Dashboard(stats: JsonElement?) {
    val root = stats?.takeIf { it.isJsonObject }?.asJsonObject
    val data = root?.get("counts")?.takeIf { it.isJsonObject }?.asJsonObject ?: root
    val cards = listOf("إجمالي الفنيين" to (data?.get("technicians")?.toString() ?: "—"), "الفنيون المعتمدون" to (data?.get("verifiedTechnicians")?.toString() ?: "—"), "العملاء" to (data?.get("clients")?.toString() ?: "—"))
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("ملخص المنصة", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = DarkAccent)
        Spacer(Modifier.height(12.dp))
        cards.forEach { (label, value) -> Card(Modifier.fillMaxWidth().padding(bottom = 10.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
            Column(Modifier.padding(18.dp)) { Text(label, color = Color.Gray); Text(value, style = MaterialTheme.typography.headlineMedium, color = Accent, fontWeight = FontWeight.Bold) }
        } }
    }
}
@Composable private fun ListScreen(section: AdminSection, items: List<JsonElement>, retry: () -> Unit) {
    var query by remember(section) { mutableStateOf("") }
    val filtered = remember(items, query) { if (query.isBlank()) items else items.filter { it.toString().contains(query.trim(), true) } }
    Column(Modifier.fillMaxSize().padding(horizontal = 14.dp)) {
        OutlinedTextField(query, { query = it }, modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp), label = { Text("بحث في " + section.title) }, singleLine = true)
        if (filtered.isEmpty()) {
            Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Text(if (items.isEmpty()) "لا توجد بيانات متاحة حاليًا" else "لا توجد نتائج مطابقة")
                if (items.isEmpty()) OutlinedButton(onClick = retry, modifier = Modifier.padding(top = 10.dp)) { Text("إعادة المحاولة") }
            }
        } else LazyColumn(contentPadding = PaddingValues(bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(filtered) { item ->
                Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(14.dp)) {
                    Column(Modifier.padding(14.dp)) {
                        Text(primary(item), fontWeight = FontWeight.Bold, color = DarkAccent)
                        val detail = secondary(item)
                        if (detail.isNotBlank()) Text(detail, color = Color.DarkGray, modifier = Modifier.padding(top = 5.dp))
                    }
                }
            }
        }
    }
}
private fun primary(item: JsonElement): String {
    if (!item.isJsonObject) return item.toString()
    val o = item.asJsonObject
    val keys = listOf("name", "title", "service", "sn", "clientName", "fanniName", "text", "regionName")
    return keys.firstNotNullOfOrNull { k -> o.get(k)?.takeIf { it.isJsonPrimitive && !it.asString.isNullOrBlank() }?.asString } ?: "عنصر"
}
private fun secondary(item: JsonElement): String {
    if (!item.isJsonObject) return ""
    return listOf("status", "phone", "clientPhone", "area", "region", "createdAt", "specialties", "message")
        .mapNotNull { k -> item.asJsonObject.get(k)?.takeIf { !it.isJsonNull }?.let { "$k: $it" } }.take(4).joinToString("  •  ")
}
