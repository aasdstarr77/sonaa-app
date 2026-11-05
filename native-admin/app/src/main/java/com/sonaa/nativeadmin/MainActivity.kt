package com.sonaa.nativeadmin
import android.Manifest
import android.media.MediaPlayer
import android.net.Uri
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
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.gson.JsonElement
import com.google.gson.JsonObject
private val Accent = Color(0xFF087F9C)
private val DarkAccent = Color(0xFF07566B)
private val Background = Color(0xFFF4F8FA)
class MainActivity : ComponentActivity() {
    private var pendingDestination by mutableStateOf<String?>(null)
    private val askNotifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
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
            LaunchedEffect(pendingDestination, state.authenticated, state.adminInfo) { if (state.authenticated) { navigate(pendingDestination, state.adminInfo, vm); pendingDestination = null } }
            LaunchedEffect(state.authenticated) {
                if (state.authenticated) {
                    FirebaseMessaging.getInstance().token.addOnSuccessListener(vm::registerFcm)
                    getSharedPreferences("sonaa_admin_session", MODE_PRIVATE).getString("pending_fcm_token", null)?.let(vm::registerFcm)
                }
            }
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Accent,
                    onPrimary = Color.White,
                    secondary = Color(0xFF18A6A0),
                    background = Background,
                    surface = Color.White,
                    error = Color(0xFFB3261E)
                ),
                shapes = androidx.compose.material3.Shapes(
                    small = RoundedCornerShape(13.dp),
                    medium = RoundedCornerShape(18.dp),
                    large = RoundedCornerShape(24.dp)
                )
            ) {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    Surface(Modifier.fillMaxSize(), color = Background) {
                        when {
                            state.checking -> SplashScreen()
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
    private fun navigate(destination: String?, adminInfo: JsonElement?, vm: AdminViewModel?) {
        val section = when (destination) {
            "orders" -> AdminSection.ORDERS
            "technicians" -> AdminSection.TECHNICIANS
            "clients" -> AdminSection.CLIENTS
            "complaints" -> AdminSection.COMPLAINTS
            "support" -> AdminSection.SUPPORT
            "recovery" -> AdminSection.RECOVERY
            "topups" -> AdminSection.TOPUPS
            "wallets" -> AdminSection.WALLETS
            else -> null
        }
        if (section != null && vm != null && canReadSection(adminInfo, section)) vm.open(section)
    }
    private fun initializeFirebase() {
        if (FirebaseApp.getApps(this).isEmpty()) {
            FirebaseApp.initializeApp(this, FirebaseOptions.Builder()
                .setApplicationId(BuildConfig.FIREBASE_APP_ID).setApiKey(BuildConfig.FIREBASE_API_KEY)
                .setProjectId(BuildConfig.FIREBASE_PROJECT_ID).setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID).build())
        }
    }
}
@Composable private fun SplashScreen(){
 Box(Modifier.fillMaxSize().background(Color.White),contentAlignment=Alignment.Center){
  Column(horizontalAlignment=Alignment.CenterHorizontally){
   Image(painterResource(R.drawable.sonaa_logo),"شعار صُنّاع",Modifier.size(150.dp))
   Spacer(Modifier.height(18.dp))
   Text("صُنّاع",style=MaterialTheme.typography.headlineMedium,fontWeight=FontWeight.Black,color=DarkAccent)
   Text("كل خدمة تبدأ بخطوة",color=Accent,modifier=Modifier.padding(top=4.dp))
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
        Button(onClick = { login(phone, password) }, enabled = !state.busy && phone.isNotBlank() && password.isNotBlank(), modifier = Modifier.fillMaxWidth().padding(top = 18.dp), shape = RoundedCornerShape(17.dp), elevation = ButtonDefaults.buttonElevation(defaultElevation = 7.dp, pressedElevation = 1.dp, hoveredElevation = 9.dp)) {
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
            Surface(
                onClick = vm::retry,
                modifier = Modifier.size(42.dp),
                shape = RoundedCornerShape(14.dp),
                color = Color(0xFFE8F5F7),
                shadowElevation = 5.dp,
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFC8E5E9))
            ) { Box(contentAlignment = Alignment.Center) { Text("↻", color = Accent, fontWeight = FontWeight.Black, style = MaterialTheme.typography.headlineSmall) } }
            Spacer(Modifier.width(8.dp))
            Surface(
                onClick = vm::logout,
                modifier = Modifier.size(42.dp),
                shape = RoundedCornerShape(14.dp),
                color = Color(0xFFFFEEEE),
                shadowElevation = 5.dp,
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFF3CACA))
            ) { Box(contentAlignment = Alignment.Center) { Text("⇥", color = Color(0xFFB3261E), fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleLarge) } }
        }
        if(state.section==AdminSection.ORDERS)state.voicePath?.let { path -> VoicePlayer(path) { } }
        state.actionMessage?.let { message ->
            Card(Modifier.fillMaxWidth().padding(horizontal=12.dp, vertical=6.dp), colors=CardDefaults.cardColors(containerColor=Color(0xFFEAF6F8))) {
                Text(message, modifier=Modifier.padding(10.dp), color=DarkAccent, maxLines=5)
            }
        }
        var sectionMenuExpanded by remember { mutableStateOf(false) }
        val readableSections = AdminSection.entries.filter { canReadSection(state.adminInfo,it) }
        Box(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 14.dp, vertical = 9.dp)) {
            Surface(
                onClick = { sectionMenuExpanded = true },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                color = Color(0xFFF1F7FB),
                shadowElevation = 5.dp,
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFD6E6F0))
            ) {
                Row(Modifier.padding(horizontal = 16.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(38.dp).background(Accent, RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                        Text("☷", color = Color.White, fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleLarge)
                    }
                    Column(Modifier.weight(1f).padding(horizontal = 11.dp)) {
                        Text("القائمة الرئيسية", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                        Text(state.section.title, fontWeight = FontWeight.ExtraBold, color = DarkAccent)
                    }
                    Text("⌄", color = Accent, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black)
                }
            }
            DropdownMenu(
                expanded = sectionMenuExpanded,
                onDismissRequest = { sectionMenuExpanded = false },
                modifier = Modifier.fillMaxWidth(0.92f).background(Color.White)
            ) {
                readableSections.forEach { tab ->
                    DropdownMenuItem(
                        text = { Text(tab.title, fontWeight = if (tab == state.section) FontWeight.ExtraBold else FontWeight.Medium, color = if (tab == state.section) Accent else Color(0xFF263746)) },
                        leadingIcon = {
                            Box(Modifier.size(34.dp).background(if (tab == state.section) Color(0xFFE1F4F7) else Color(0xFFF1F5F9), RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) {
                                Text(sectionGlyph(tab), color = if (tab == state.section) Accent else Color(0xFF78909C), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Black)
                            }
                        },
                        onClick = {
                            sectionMenuExpanded = false
                            if (tab == AdminSection.DASHBOARD) vm.refresh() else vm.open(tab)
                        }
                    )
                }
            }
        }
        when {
            state.busy -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Accent) }
            state.error != null -> Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                Text(state.error, color = MaterialTheme.colorScheme.error)
                Button(onClick = vm::retry, modifier = Modifier.padding(top = 12.dp)) { Text("إعادة المحاولة") }
            }
            state.section == AdminSection.DASHBOARD || state.section == AdminSection.STATS -> Dashboard(state.stats)
            state.section == AdminSection.PAGE_VISITS -> PageVisitsScreen(state.payload)
            state.section == AdminSection.REPORTS -> ReportEditor(state.payload) { method, path, body -> vm.mutate(method, path, body) }
            state.section == AdminSection.SETTINGS || state.section == AdminSection.PRICING || state.section == AdminSection.CONTENT -> ConfigEditor(state.section, state.payload,{path->canWriteApi(state.adminInfo,path)}) { method, path, body -> vm.mutate(method, path, body) }
            state.walletFanniId!=null -> WalletTransactionsScreen(state.walletTransactions,vm::closeWalletTransactions)
            state.editingClient!=null -> ClientProfileEditor(state.editingClient,state.editingClientId.orEmpty(),{vm.closeClientProfile()}) { method:String,path:String,body:JsonObject -> vm.saveEditedProfile(method,path,body) }
            state.editingProfile!=null -> ProfileEditor(state.editingProfile,state.editingProfileId.orEmpty(),{vm.closeProfile()}) { method:String,path:String,body:JsonObject -> vm.saveEditedProfile(method,path,body) }
            state.recoveryDetail!=null -> RecoveryConversationScreen(state.recoveryDetail,state.busy,state.error,state.actionMessage,vm::closeRecovery,{path->canWriteApi(state.adminInfo,path)}) { method,path,body -> vm.recoveryAction(method,path,body) }
            else -> ListScreen(state.section, state.items, vm::retry, vm::loadVoice, vm::openFanniProfile, vm::openWalletTransactions, vm::openClientProfile, vm::searchSupport, vm::bulkPublish, vm::openRecovery, { section, ids, action -> vm.bulkAction(section, ids, action) }, { path -> canWriteApi(state.adminInfo,path) }, { path -> canReadApi(state.adminInfo,path) }) { method, path, body -> vm.mutate(method, path, body) }
        }
    }
}
private fun sectionGlyph(section:AdminSection):String=when(section){
 AdminSection.DASHBOARD->"⌂";AdminSection.STATS->"▥";AdminSection.ORDERS->"▤"
 AdminSection.TECHNICIANS->"♟";AdminSection.PENDING->"◷";AdminSection.PROFILE_EDITS->"✎"
 AdminSection.DISABLED->"⊘";AdminSection.LEVELS->"★";AdminSection.OFFERS->"%"
 AdminSection.WALLETS->"◉";AdminSection.TOPUPS->"+";AdminSection.SERVICES->"⚒"
 AdminSection.REGIONS->"⌖";AdminSection.COMPLAINTS->"!";AdminSection.SUPPORT->"?"
 AdminSection.RECOVERY->"↻";AdminSection.NOTIFICATIONS->"♢";AdminSection.CONTENT->"▣"
 AdminSection.PRICING->"$";AdminSection.REPORTS->"▤";AdminSection.PAGE_VISITS->"◉"
 AdminSection.SECURITY->"⌑";AdminSection.SETTINGS->"⚙";AdminSection.ROLES->"♙"
 AdminSection.CLIENTS->"♧"
}
@Composable private fun VoicePlayer(path:String,onClose:()->Unit){
 var prepared by remember(path){mutableStateOf(false)}
 var playing by remember(path){mutableStateOf(false)}
 val player=remember(path){
  MediaPlayer().apply{
   setDataSource(path)
   setOnPreparedListener{prepared=true}
   setOnCompletionListener{playing=false}
   prepareAsync()
  }
 }
 DisposableEffect(player){onDispose{runCatching{player.release()}}}
 Card(Modifier.fillMaxWidth().padding(horizontal=12.dp,vertical=6.dp),colors=CardDefaults.cardColors(containerColor=Color.White)){
  Row(Modifier.fillMaxWidth().padding(10.dp),verticalAlignment=Alignment.CenterVertically){
   Text("تسجيل صوتي للطلب",modifier=Modifier.weight(1f),fontWeight=FontWeight.Bold,color=DarkAccent)
   Button(onClick={if(prepared){if(playing){player.pause();playing=false}else{player.start();playing=true}}},enabled=prepared){Text(if(!prepared)"تحميل..." else if(playing)"إيقاف مؤقت" else "تشغيل")}
  }
 }
}

private val permissionSections=listOf(
 "dashboard" to "الرئيسية والإحصائيات","fannis" to "الفنيون","orders" to "الطلبات",
 "publishOrders" to "نشر الطلبات","voiceReview" to "مراجعة التسجيلات الصوتية",
 "passwordRecovery" to "استعادة كلمة المرور","complaints" to "الشكاوى","services" to "الخدمات",
 "clients" to "العملاء","topups" to "طلبات شحن المحافظ","wallet" to "المحافظ والأرصدة",
 "pricing" to "الأسعار والعمولات","settings" to "إعدادات المنصة","content" to "الإعلانات والمحتوى",
 "support" to "الدعم","regions" to "المناطق","offers" to "العروض",
 "notifications" to "الإشعارات","clientsData" to "بيانات العملاء"
)
private fun permissionDefaults(item:JsonElement?):Map<String,Pair<Boolean,Boolean>>{
 if(item==null||!item.isJsonObject)return emptyMap()
 val obj=item.asJsonObject
 val role=obj.get("adminRole")?.takeIf{!it.isJsonNull}?.asString?:if(obj.get("role")?.asString=="admin")"مشرف" else "قراءة فقط"
 val all=permissionSections.map{it.first}.toSet()
 val writes=when(role){
  "مشرف"->setOf("orders","complaints","support","offers")
  "مشرف أول"->setOf("fannis","orders","complaints","services","clients","topups","wallet","support","regions","offers","notifications","clientsData")
  "مدير"->all
  else->emptySet()
 }
 val reads=when(role){
  "قراءة فقط"->all
  "مدير","مشرف أول"->all
  else->setOf("dashboard","fannis","orders","voiceReview","passwordRecovery","complaints","services","clients","topups","wallet","pricing","content","support","regions","offers","notifications","clientsData")
 }
 val out=permissionSections.associate{(key,_)->key to ((key in reads||key in writes) to (key in writes))}.toMutableMap()
 val stored=obj.get("adminPermissions")?.takeIf{it.isJsonObject}?.asJsonObject
 if(stored?.get("__customOverrides")?.asBoolean==true){
  permissionSections.forEach{(key,_)->stored.get(key)?.takeIf{it.isJsonObject}?.asJsonObject?.let{delta->
   val base=out[key]?: (false to false)
   val read=delta.get("read")?.asBoolean?:base.first
   val write=delta.get("write")?.asBoolean?:base.second
   out[key]=(read||write) to write
  }}
 }
 return out
}
private fun isRootAdminInfo(info:JsonElement?):Boolean{
 val o=info?.takeIf{it.isJsonObject}?.asJsonObject?:return false
 return o.get("isRootAdmin")?.asBoolean==true||o.get("adminRoleLabel")?.asString=="أدمن رئيسي"
}
private fun permissionKeyForNativePath(path:String):String?{
 val clean=path.substringBefore("?").removePrefix("/")
 if(clean.startsWith("api/orders/admin/")&&clean.endsWith("/publish"))return "publishOrders"
 if(clean.startsWith("api/orders/admin/")&&clean.endsWith("/voice-reviewed"))return "voiceReview"
 if(clean.startsWith("api/orders/")&&clean.endsWith("/voice"))return "voiceReview"
 if(clean.startsWith("api/password-recovery/admin/requests"))return "passwordRecovery"
 if(clean.startsWith("api/admin/admin-users")||clean.startsWith("api/admin/audit-logs")||clean.startsWith("api/admin/page-visits"))return null
 if(clean.startsWith("api/admin/wallet/")||clean.endsWith("/set-balance")||clean.endsWith("/add-balance"))return "wallet"
 val prefix="api/admin/"
 if(!clean.startsWith(prefix))return null
 return when(clean.removePrefix(prefix).substringBefore("/")){
  "me","counts","stats","reports","mobile-panel"->"dashboard"
  "fannis","fanni-profile-edits"->"fannis"
  "orders"->"orders"
  "offers"->"offers"
  "complaints"->"complaints"
  "topup-requests"->"topups"
  "clients"->"clients"
  "client-accounts"->"clientsData"
  "pricing"->"pricing"
  "settings"->"settings"
  "content"->"content"
  "support"->"support"
  "regions"->"regions"
  "notifications"->"notifications"
  "services"->"services"
  else->null
 }
}
private fun canReadSection(info:JsonElement?,section:AdminSection):Boolean{
 if(isRootAdminInfo(info))return true
 val key=when(section){
  AdminSection.DASHBOARD,AdminSection.STATS,AdminSection.REPORTS->"dashboard"
  AdminSection.TECHNICIANS,AdminSection.PENDING,AdminSection.PROFILE_EDITS,AdminSection.DISABLED,AdminSection.LEVELS->"fannis"
  AdminSection.ORDERS->"orders"
  AdminSection.OFFERS->"offers"
  AdminSection.WALLETS->"wallet"
  AdminSection.TOPUPS->"topups"
  AdminSection.SERVICES->"services"
  AdminSection.REGIONS->"regions"
  AdminSection.COMPLAINTS->"complaints"
  AdminSection.SUPPORT->"support"
  AdminSection.RECOVERY->"passwordRecovery"
  AdminSection.NOTIFICATIONS->"notifications"
  AdminSection.CONTENT->"content"
  AdminSection.PRICING->"pricing"
  AdminSection.SETTINGS->"settings"
  AdminSection.CLIENTS->"clients"
  AdminSection.SECURITY,AdminSection.PAGE_VISITS,AdminSection.ROLES->return false
 }
 return permissionDefaults(info).get(key)?.first==true
}
private fun canReadApi(info:JsonElement?,path:String):Boolean{
 if(isRootAdminInfo(info))return true
 val key=permissionKeyForNativePath(path)?:return false
 return permissionDefaults(info)[key]?.first==true
}
private fun canWriteApi(info:JsonElement?,path:String):Boolean{
 if(isRootAdminInfo(info))return true
 val key=permissionKeyForNativePath(path)?:return false
 if(key=="dashboard"&&path.contains("/reports"))return permissionDefaults(info)[key]?.first==true
 return permissionDefaults(info)[key]?.second==true
}

@Composable private fun AdminPermissionsDialog(item:JsonElement,onDismiss:()->Unit,onSave:(JsonObject)->Unit){
 var permissions by remember(item){mutableStateOf(permissionDefaults(item))}
 val role=item.asJsonObject.get("adminRole")?.takeIf{!it.isJsonNull}?.asString?: "مشرف"
 AlertDialog(onDismissRequest=onDismiss,title={Text("صلاحيات المشرف: "+(item.asJsonObject.get("name")?.asString?: "—"))},
  text={Column(Modifier.heightIn(max=520.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(5.dp)){
   Text("المنصب الحالي: $role",fontWeight=FontWeight.Bold,color=DarkAccent)
   Text("التنفيذ يمنح القراءة تلقائيًا. الخادم يطبق الصلاحيات على كل طلب.",style=MaterialTheme.typography.bodySmall,color=Color.Gray)
   permissionSections.forEach{(key,label)->
    val current=permissions[key]?: (false to false)
    Card(Modifier.fillMaxWidth(),colors=CardDefaults.cardColors(containerColor=Color(0xFFF4F8FA))){
     Column(Modifier.padding(horizontal=10.dp,vertical=5.dp)){
      Text(label,fontWeight=FontWeight.SemiBold)
      Row(verticalAlignment=Alignment.CenterVertically){
       Text("قراءة",modifier=Modifier.weight(1f),style=MaterialTheme.typography.bodySmall)
       Switch(checked=current.first,onCheckedChange={v->permissions=permissions.toMutableMap().apply{put(key,(v||current.second) to current.second)}})
       Spacer(Modifier.width(12.dp))
       Text("تنفيذ",style=MaterialTheme.typography.bodySmall)
       Switch(checked=current.second,onCheckedChange={v->permissions=permissions.toMutableMap().apply{put(key,(current.first||v) to v)}})
      }
     }
    }
   }
  }},
  confirmButton={TextButton(onClick={
   val body=JsonObject().apply{add("permissions",JsonObject().apply{permissionSections.forEach{(key,_)->val p=permissions[key]?: (false to false);add(key,JsonObject().apply{addProperty("read",p.first||p.second);addProperty("write",p.second)})}})}
   onSave(body)
  }){Text("حفظ الصلاحيات")}},
  dismissButton={TextButton(onClick=onDismiss){Text("إلغاء")}}
 )
}

@Composable private fun FanniControlsDialog(item:JsonElement,onDismiss:()->Unit,onSave:(JsonObject)->Unit){
 val f=item.asJsonObject
 var trust by remember(item){mutableStateOf(f.get("trustScore")?.toString().orEmpty())}
 var verified by remember(item){mutableStateOf(f.get("isVerified")?.asBoolean?:false)}
 var featured by remember(item){mutableStateOf(f.get("isFeatured")?.asBoolean?:false)}
 var until by remember(item){mutableStateOf(f.get("featuredUntil")?.asString?.take(10).orEmpty())}
 AlertDialog(onDismissRequest=onDismiss,title={Text("الثقة والتحقق والظهور")},
  text={Column(verticalArrangement=Arrangement.spacedBy(6.dp)){
   OutlinedTextField(trust,{trust=it},label={Text("درجة الثقة 0 - 100")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number))
   Row(verticalAlignment=Alignment.CenterVertically){Text("فني موثق",modifier=Modifier.weight(1f));Switch(verified,{verified=it})}
   Row(verticalAlignment=Alignment.CenterVertically){Text("تمييز الفني",modifier=Modifier.weight(1f));Switch(featured,{featured=it})}
   OutlinedTextField(until,{until=it},label={Text("انتهاء التمييز YYYY-MM-DD")})
  }},
  confirmButton={TextButton(onClick={onSave(JsonObject().apply{addProperty("trustScore",trust.toIntOrNull()?:0);addProperty("isVerified",verified);addProperty("isFeatured",featured);if(until.isNotBlank())addProperty("featuredUntil",until)else add("featuredUntil",com.google.gson.JsonNull.INSTANCE)})}){Text("حفظ")}},
  dismissButton={TextButton(onClick=onDismiss){Text("إلغاء")}}
 )
}
@Composable private fun FanniLimitsDialog(item:JsonElement,onDismiss:()->Unit,onSave:(JsonObject)->Unit){
 val limits=item.asJsonObject.get("limits")?.takeIf{it.isJsonObject}?.asJsonObject
 var maxOrders by remember(item){mutableStateOf(limits?.get("maxOrders")?.toString().orEmpty())}
 var maxOffers by remember(item){mutableStateOf(limits?.get("maxOffers")?.toString().orEmpty())}
 var dailyLimit by remember(item){mutableStateOf(limits?.get("dailyLimit")?.toString().orEmpty())}
 var limited by remember(item){mutableStateOf(limits?.get("isLimited")?.asBoolean?:false)}
 var reason by remember(item){mutableStateOf(limits?.get("reason")?.asString.orEmpty())}
 AlertDialog(onDismissRequest=onDismiss,title={Text("حدود استقبال الفني")},
  text={Column(verticalArrangement=Arrangement.spacedBy(6.dp)){
   OutlinedTextField(maxOrders,{maxOrders=it},label={Text("أقصى عدد طلبات 0 - 1000")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number))
   OutlinedTextField(maxOffers,{maxOffers=it},label={Text("أقصى عدد عروض 0 - 1000")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number))
   OutlinedTextField(dailyLimit,{dailyLimit=it},label={Text("الحد اليومي 0 - 100")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number))
   Row(verticalAlignment=Alignment.CenterVertically){Text("تقييد الفني",modifier=Modifier.weight(1f));Switch(limited,{limited=it})}
   OutlinedTextField(reason,{reason=it},label={Text("سبب التقييد")},minLines=2)
  }},
  confirmButton={TextButton(onClick={onSave(JsonObject().apply{addProperty("maxOrders",maxOrders.toIntOrNull()?:0);addProperty("maxOffers",maxOffers.toIntOrNull()?:0);addProperty("dailyLimit",dailyLimit.toIntOrNull()?:0);addProperty("isLimited",limited);addProperty("reason",reason.trim())})}){Text("حفظ")}},
  dismissButton={TextButton(onClick=onDismiss){Text("إلغاء")}}
 )
}

@Composable private fun OrderCorrectionDialog(order:JsonElement,onDismiss:()->Unit,onSave:(JsonObject)->Unit){
 val o=order.asJsonObject
 var clientName by remember(order){mutableStateOf(o.get("clientName")?.asString.orEmpty())}
 var clientPhone by remember(order){mutableStateOf(o.get("clientPhone")?.asString.orEmpty())}
 var service by remember(order){mutableStateOf(o.get("service")?.asString.orEmpty())}
 var area by remember(order){mutableStateOf(o.get("area")?.asString.orEmpty())}
 var address by remember(order){mutableStateOf(o.get("address")?.asString.orEmpty())}
 var description by remember(order){mutableStateOf(o.get("description")?.asString.orEmpty())}
 var budget by remember(order){mutableStateOf(o.get("budget")?.asString.orEmpty())}
 AlertDialog(onDismissRequest=onDismiss,title={Text("تصحيح بيانات الطلب")},
  text={Column(Modifier.verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(6.dp)){
   OutlinedTextField(clientName,{clientName=it},label={Text("اسم العميل")})
   OutlinedTextField(clientPhone,{clientPhone=it},label={Text("رقم الهاتف")})
   OutlinedTextField(service,{service=it},label={Text("الخدمة")})
   OutlinedTextField(area,{area=it},label={Text("المنطقة")})
   OutlinedTextField(address,{address=it},label={Text("العنوان")})
   OutlinedTextField(description,{description=it},label={Text("الوصف")},minLines=2)
   OutlinedTextField(budget,{budget=it},label={Text("الميزانية")})
  }},
  confirmButton={TextButton(onClick={onSave(JsonObject().apply{addProperty("clientName",clientName.trim());addProperty("clientPhone",clientPhone.trim());addProperty("service",service.trim());addProperty("area",area.trim());addProperty("address",address.trim());addProperty("description",description.trim());addProperty("budget",budget.trim())})}){Text("حفظ التصحيح")}},
  dismissButton={TextButton(onClick=onDismiss){Text("إلغاء")}}
 )
}

@Composable private fun ClientProfileEditor(payload:JsonElement,id:String,onCancel:()->Unit,onSave:(String,String,JsonObject)->Unit){
 val client=payload.takeIf{it.isJsonObject}?.asJsonObject?.get("client")?.takeIf{it.isJsonObject}?.asJsonObject
 var name by remember(payload){mutableStateOf(client?.get("name")?.asString.orEmpty())}
 var phone by remember(payload){mutableStateOf(client?.get("phone")?.asString.orEmpty())}
 Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  Text("تعديل بيانات العميل",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=DarkAccent)
  OutlinedTextField(name,{name=it},label={Text("اسم العميل")},modifier=Modifier.fillMaxWidth())
  OutlinedTextField(phone,{phone=it},label={Text("رقم الهاتف")},modifier=Modifier.fillMaxWidth())
  Button(onClick={onSave("PATCH","api/admin/client-accounts/$id/profile",JsonObject().apply{addProperty("name",name.trim());addProperty("phone",phone.trim())})},modifier=Modifier.fillMaxWidth()){Text("حفظ بيانات العميل")}
  OutlinedButton(onClick=onCancel,modifier=Modifier.fillMaxWidth()){Text("رجوع")}
 }
}

@Composable private fun WalletTransactionsScreen(items:List<JsonElement>,onBack:()->Unit){
 val labels=mapOf("commission" to "عمولة طلب","topup" to "شحن محفظة","admin_adjustment" to "تسوية إدارية","refund" to "استرداد")
 Column(Modifier.fillMaxSize().padding(16.dp)){
  Text("حركات المحفظة",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.ExtraBold,color=DarkAccent)
  Text("سجل العمليات المالية مع الرصيد قبل الحركة وبعدها",style=MaterialTheme.typography.bodySmall,color=Color.Gray)
  Button(onClick=onBack,modifier=Modifier.fillMaxWidth().padding(vertical=8.dp),shape=RoundedCornerShape(14.dp),elevation=ButtonDefaults.buttonElevation(defaultElevation=5.dp)){Text("رجوع للمحافظ")}
  if(items.isEmpty())Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center){Text("لا توجد حركات مالية مسجلة",color=Color.Gray)}
  else LazyColumn(verticalArrangement=Arrangement.spacedBy(9.dp)){
   items(items){entry->
    val o=entry.takeIf{it.isJsonObject}?.asJsonObject
    val type=o?.get("type")?.takeIf{!it.isJsonNull}?.asString.orEmpty()
    val amount=o?.get("amount")?.takeIf{it.isJsonPrimitive}?.asString?: "—"
    val before=o?.get("balanceBefore")?.takeIf{it.isJsonPrimitive}?.asString?: "—"
    val after=o?.get("balanceAfter")?.takeIf{it.isJsonPrimitive}?.asString?: "—"
    val description=o?.get("description")?.takeIf{!it.isJsonNull}?.asString.orEmpty()
    val order=o?.get("orderSN")?.takeIf{!it.isJsonNull}?.asString.orEmpty()
    val date=o?.get("createdAt")?.takeIf{!it.isJsonNull}?.asString?: "—"
    Card(Modifier.fillMaxWidth(),shape=RoundedCornerShape(17.dp),colors=CardDefaults.cardColors(containerColor=Color.White),elevation=CardDefaults.cardElevation(defaultElevation=3.dp)){
     Column(Modifier.fillMaxWidth().padding(13.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){
      Row(verticalAlignment=Alignment.CenterVertically){
       Text(labels[type]?:if(type.isBlank())"حركة مالية" else type,modifier=Modifier.weight(1f),fontWeight=FontWeight.ExtraBold,color=DarkAccent)
       Text("$amount ج.م",fontWeight=FontWeight.Black,color=if(amount.startsWith("-"))Color(0xFFB3261E) else Color(0xFF087F55))
      }
      if(description.isNotBlank())Text(description,color=Color(0xFF455A64))
      Row(horizontalArrangement=Arrangement.spacedBy(6.dp)){
       Surface(shape=RoundedCornerShape(10.dp),color=Color(0xFFF0F5F8)){Text("قبل: $before ج.م",modifier=Modifier.padding(horizontal=9.dp,vertical=6.dp),style=MaterialTheme.typography.labelMedium)}
       Surface(shape=RoundedCornerShape(10.dp),color=Color(0xFFE8F5F2)){Text("بعد: $after ج.م",modifier=Modifier.padding(horizontal=9.dp,vertical=6.dp),style=MaterialTheme.typography.labelMedium)}
      }
      if(order.isNotBlank())Text("رقم الطلب: $order",style=MaterialTheme.typography.labelSmall,color=Color.Gray)
      Text(date,style=MaterialTheme.typography.labelSmall,color=Color.Gray)
     }
    }
   }
  }
 }
}

@Composable private fun FanniLevelBadgeControls(item:JsonElement,canWrite:(String)->Boolean,onAction:(String,String,JsonObject)->Unit){
 val f=item.asJsonObject
 val id=f.get("_id")?.asString.orEmpty()
 val canEditLevel=canWrite("api/admin/fannis/$id/level")
 val canEditBadge=canWrite("api/admin/fannis/$id/badge")
 val levels=listOf("مبتدئ","ممارس","محترف","خبير مبتدئ","خبير","خبير أول","استشاري فني","نخبة","أسطوري")
 val badges=listOf("trusted","top_rated","verified","fast_response","premium","gold")
 val badgeLabels=mapOf("trusted" to "موثوق","top_rated" to "الأعلى تقييمًا","verified" to "تم التحقق","fast_response" to "سريع الاستجابة","premium" to "مميز","gold" to "ذهبي")
 var selectedLevel by remember(item){mutableStateOf(f.get("level")?.asString?:levels.first())}
 var levelMenu by remember{mutableStateOf(false)}
 var selectedBadge by remember{mutableStateOf(badges.first())}
 var badgeMenu by remember{mutableStateOf(false)}
 val currentBadges=f.get("badges")?.takeIf{it.isJsonArray}?.asJsonArray?.mapNotNull{it.takeIf{v->v.isJsonPrimitive}?.asString}.orEmpty()
 Column(Modifier.fillMaxWidth().padding(top=10.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
  Text("المستوى الحالي: "+(f.get("level")?.asString?: "مبتدئ"),fontWeight=FontWeight.Bold,color=DarkAccent)
  Surface(shape=RoundedCornerShape(14.dp),color=Color(0xFFF1F7FB),border=androidx.compose.foundation.BorderStroke(1.dp,Color(0xFFD6E6F0))){
   Column(Modifier.fillMaxWidth().padding(10.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
    Text("تغيير مستوى الفني",fontWeight=FontWeight.Bold)
    Box{
     OutlinedButton(onClick={levelMenu=true},enabled=canEditLevel,modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(13.dp)){Text(selectedLevel)}
     DropdownMenu(expanded=levelMenu,onDismissRequest={levelMenu=false}){
      levels.forEach{level->DropdownMenuItem(text={Text(level)},onClick={selectedLevel=level;levelMenu=false})}
     }
    }
    Button(onClick={onAction("PATCH","api/admin/fannis/$id/level",JsonObject().apply{addProperty("level",selectedLevel)})},enabled=canEditLevel,modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(14.dp),elevation=ButtonDefaults.buttonElevation(defaultElevation=5.dp,pressedElevation=1.dp)){Text("حفظ المستوى")}
   }
  }
  Text("الشارات الحالية: "+if(currentBadges.isEmpty())"لا توجد شارات" else currentBadges.map{badgeLabels[it]?:it}.joinToString("، "),style=MaterialTheme.typography.bodySmall)
  Surface(shape=RoundedCornerShape(14.dp),color=Color(0xFFFFF8E8),border=androidx.compose.foundation.BorderStroke(1.dp,Color(0xFFF0D9A5))){
   Column(Modifier.fillMaxWidth().padding(10.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
    Text("إدارة الشارات",fontWeight=FontWeight.Bold,color=Color(0xFF79520A))
    Box{
     OutlinedButton(onClick={badgeMenu=true},enabled=canEditBadge,modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(13.dp)){Text(badgeLabels[selectedBadge]?:selectedBadge)}
     DropdownMenu(expanded=badgeMenu,onDismissRequest={badgeMenu=false}){
      badges.forEach{badge->DropdownMenuItem(text={Text(badgeLabels[badge]?:badge)},onClick={selectedBadge=badge;badgeMenu=false})}
     }
    }
    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
     Button(onClick={onAction("PATCH","api/admin/fannis/$id/badge",JsonObject().apply{addProperty("badge",selectedBadge);addProperty("action","add")})},enabled=canEditBadge,modifier=Modifier.weight(1f),shape=RoundedCornerShape(13.dp),elevation=ButtonDefaults.buttonElevation(defaultElevation=5.dp)){Text("إضافة")}
     OutlinedButton(onClick={onAction("PATCH","api/admin/fannis/$id/badge",JsonObject().apply{addProperty("badge",selectedBadge);addProperty("action","remove")})},enabled=canEditBadge,modifier=Modifier.weight(1f),shape=RoundedCornerShape(13.dp)){Text("إزالة")}
    }
   }
  }
 }
}

@Composable private fun ProfileEditor(payload:JsonElement,id:String,onCancel:()->Unit,onSave:(String,String,JsonObject)->Unit){
 val root=payload.takeIf{it.isJsonObject}?.asJsonObject
 val f=root?.get("fanni")?.takeIf{it.isJsonObject}?.asJsonObject
 val serviceOptions=root?.get("serviceOptions")?.takeIf{it.isJsonArray}?.asJsonArray?.mapNotNull{it.takeIf{v->v.isJsonPrimitive}?.asString}?.distinct().orEmpty()
 val areaOptions=root?.get("areaOptions")?.takeIf{it.isJsonArray}?.asJsonArray?.mapNotNull{it.takeIf{v->v.isJsonPrimitive}?.asString}?.distinct().orEmpty()
 var phone by remember(payload){mutableStateOf(f?.get("phone")?.asString.orEmpty())}
 val selectedServices=remember(payload){androidx.compose.runtime.mutableStateListOf<String>().apply{addAll(f?.get("specialties")?.takeIf{it.isJsonArray}?.asJsonArray?.mapNotNull{it.takeIf{v->v.isJsonPrimitive}?.asString}.orEmpty())}}
 val selectedAreas=remember(payload){androidx.compose.runtime.mutableStateListOf<String>().apply{addAll(f?.get("areas")?.takeIf{it.isJsonArray}?.asJsonArray?.mapNotNull{it.takeIf{v->v.isJsonPrimitive}?.asString}.orEmpty())}}
 var servicesExpanded by remember{mutableStateOf(false)}
 var areasExpanded by remember{mutableStateOf(false)}
 Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text("تعديل بيانات الفني",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.ExtraBold,color=DarkAccent)
  OutlinedTextField(phone,{phone=it},label={Text("رقم الهاتف")},modifier=Modifier.fillMaxWidth(),singleLine=true)
  Surface(Modifier.fillMaxWidth(),shape=RoundedCornerShape(17.dp),color=Color.White,shadowElevation=3.dp,border=androidx.compose.foundation.BorderStroke(1.dp,Color(0xFFDCE8F0))){
   Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){
    Text("الخدمات والمهن",fontWeight=FontWeight.Bold,color=DarkAccent)
    Text("اختار الخدمات المعتمدة للفني بدل كتابتها يدويًا",style=MaterialTheme.typography.bodySmall,color=Color.Gray)
    Box{
     OutlinedButton(onClick={servicesExpanded=true},modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(13.dp)){Text(if(selectedServices.isEmpty())"اختيار الخدمات" else "تم اختيار ${selectedServices.size} خدمة")}
     DropdownMenu(expanded=servicesExpanded,onDismissRequest={servicesExpanded=false},modifier=Modifier.heightIn(max=360.dp)){
      serviceOptions.forEach{service->DropdownMenuItem(
       text={Text(service)},
       leadingIcon={Checkbox(checked=service in selectedServices,onCheckedChange=null)},
       onClick={if(service in selectedServices)selectedServices.remove(service) else selectedServices.add(service)}
      )}
     }
    }
    if(selectedServices.isNotEmpty())Text(selectedServices.joinToString(" • "),style=MaterialTheme.typography.bodySmall,color=Accent)
   }
  }
  Surface(Modifier.fillMaxWidth(),shape=RoundedCornerShape(17.dp),color=Color.White,shadowElevation=3.dp,border=androidx.compose.foundation.BorderStroke(1.dp,Color(0xFFDCE8F0))){
   Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){
    Text("مناطق العمل",fontWeight=FontWeight.Bold,color=DarkAccent)
    Text("اختار المناطق من القائمة الموحدة المعتمدة",style=MaterialTheme.typography.bodySmall,color=Color.Gray)
    Box{
     OutlinedButton(onClick={areasExpanded=true},modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(13.dp)){Text(if(selectedAreas.isEmpty())"اختيار مناطق العمل" else "تم اختيار ${selectedAreas.size} منطقة")}
     DropdownMenu(expanded=areasExpanded,onDismissRequest={areasExpanded=false},modifier=Modifier.heightIn(max=360.dp)){
      areaOptions.forEach{area->DropdownMenuItem(
       text={Text(area)},
       leadingIcon={Checkbox(checked=area in selectedAreas,onCheckedChange=null)},
       onClick={if(area in selectedAreas)selectedAreas.remove(area) else selectedAreas.add(area)}
      )}
     }
    }
    if(selectedAreas.isNotEmpty())Text(selectedAreas.joinToString(" • "),style=MaterialTheme.typography.bodySmall,color=Accent)
   }
  }
  Button(onClick={
   val body=JsonObject().apply{
    addProperty("phone",phone.trim())
    add("specialties",com.google.gson.JsonArray().apply{selectedServices.forEach{add(it)}})
    add("areas",com.google.gson.JsonArray().apply{selectedAreas.forEach{add(it)}})
   }
   onSave("PATCH","api/admin/fannis/$id/profile",body)
  },enabled=phone.isNotBlank()&&selectedServices.isNotEmpty()&&selectedAreas.isNotEmpty(),modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(15.dp),elevation=ButtonDefaults.buttonElevation(defaultElevation=6.dp,pressedElevation=1.dp)){Text("حفظ بيانات الفني")}
  OutlinedButton(onClick=onCancel,modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(15.dp)){Text("رجوع")}
 }
}

@Composable private fun RecoveryConversationScreen(payload:JsonElement,busy:Boolean,error:String?,message:String?,onClose:()->Unit,canWrite:(String)->Boolean,onAction:(String,String,JsonObject)->Unit){
 val recovery=payload.asJsonObject.get("recovery")?.takeIf{it.isJsonObject}?.asJsonObject?:payload.asJsonObject
 val id=recovery.get("id")?.asString.orEmpty()
 val messages=recovery.get("messages")?.takeIf{it.isJsonArray}?.asJsonArray
 var reply by remember(id){mutableStateOf("")}
 var rejectReason by remember(id){mutableStateOf("تعذر التحقق من ملكية الحساب")}
 var confirmIssue by remember(id){mutableStateOf(false)}
 var rejectOpen by remember(id){mutableStateOf(false)}
 Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(14.dp),verticalArrangement=Arrangement.spacedBy(9.dp)){
  Row(verticalAlignment=Alignment.CenterVertically){
   Text("محادثة استعادة كلمة المرور",modifier=Modifier.weight(1f),style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=DarkAccent)
   TextButton(onClick=onClose){Text("رجوع")}
  }
  Text("الاسم: "+(recovery.get("accountName")?.asString?: "—"))
  Text("الهاتف: "+(recovery.get("phone")?.asString?: "—"))
  Text("نوع الحساب: "+(recovery.get("ownerRole")?.asString?: "—"))
  Text("الحالة: "+(recovery.get("status")?.asString?: "—"))
  Text("الموضوع: "+(recovery.get("subject")?.asString?: "—"))
  message?.let{Text(it,color=Color(0xFF087F55),fontWeight=FontWeight.Bold)}
  error?.let{Text(it,color=Color(0xFFB3261E))}
  Text("الرسائل",fontWeight=FontWeight.Bold,color=DarkAccent)
  messages?.forEach{entry->
   val msg=entry.asJsonObject
   Card(Modifier.fillMaxWidth(),colors=CardDefaults.cardColors(containerColor=if(msg.get("senderRole")?.asString=="admin")Color(0xFFEAF5F7) else Color.White)){
    Column(Modifier.padding(10.dp),verticalArrangement=Arrangement.spacedBy(5.dp)){
     Text(if(msg.get("senderRole")?.asString=="admin")"الإدارة" else "المستخدم",fontWeight=FontWeight.Bold)
     Text(msg.get("text")?.asString.orEmpty())
     Text(msg.get("createdAt")?.toString().orEmpty(),style=MaterialTheme.typography.labelSmall,color=Color.Gray)
     val messageId=msg.get("id")?.asString.orEmpty()
     if(messageId.isNotBlank())TextButton(onClick={onAction("DELETE","api/password-recovery/admin/requests/$id/messages/$messageId",JsonObject())},enabled=canWrite("api/password-recovery/admin/requests/$id/messages/$messageId")){Text("حذف الرسالة",color=Color(0xFFB3261E))}
    }
   }
  }
  OutlinedTextField(reply,{reply=it},label={Text("اكتب ردًا للمستخدم")},modifier=Modifier.fillMaxWidth(),minLines=2)
  Button(onClick={onAction("POST","api/password-recovery/admin/requests/$id/reply",JsonObject().apply{addProperty("text",reply.trim())});reply=""},enabled=reply.trim().isNotEmpty()&&!busy&&canWrite("api/password-recovery/admin/requests/$id/reply"),modifier=Modifier.fillMaxWidth()){Text("إرسال الرد")}
  OutlinedButton(onClick={confirmIssue=true},enabled=!busy&&canWrite("api/password-recovery/admin/requests/$id/issue-code"),modifier=Modifier.fillMaxWidth()){Text("إصدار رمز استعادة بعد التحقق")}
  OutlinedButton(onClick={rejectOpen=true},enabled=!busy&&canWrite("api/password-recovery/admin/requests/$id/reject"),modifier=Modifier.fillMaxWidth()){Text("رفض طلب الاستعادة")}
  if(busy)LinearProgressIndicator(Modifier.fillMaxWidth())
 }
 if(confirmIssue)AlertDialog(onDismissRequest={confirmIssue=false},title={Text("تأكيد إصدار الرمز")},text={Text("تأكدت من هوية صاحب الحساب عبر المحادثة؟ الرمز صالح لمدة 10 دقائق وسيظهر مرة واحدة.")},confirmButton={TextButton(onClick={confirmIssue=false;onAction("POST","api/password-recovery/admin/requests/$id/issue-code",JsonObject())}){Text("إصدار الرمز")}},dismissButton={TextButton(onClick={confirmIssue=false}){Text("إلغاء")}})
 if(rejectOpen)AlertDialog(onDismissRequest={rejectOpen=false},title={Text("رفض طلب الاستعادة")},text={OutlinedTextField(rejectReason,{rejectReason=it},label={Text("سبب الرفض")},minLines=2)},confirmButton={TextButton(onClick={rejectOpen=false;onAction("POST","api/password-recovery/admin/requests/$id/reject",JsonObject().apply{addProperty("reason",rejectReason.trim())})}){Text("تأكيد الرفض")}},dismissButton={TextButton(onClick={rejectOpen=false}){Text("إلغاء")}})
}

@Composable private fun PageVisitsScreen(payload:JsonElement?){
 val root=payload?.takeIf{it.isJsonObject}?.asJsonObject
 val summary=root?.get("summary")?.takeIf{it.isJsonArray}?.asJsonArray?.toList().orEmpty()
 val recent=root?.get("recent")?.takeIf{it.isJsonArray}?.asJsonArray?.toList().orEmpty()
 var filter by remember{mutableStateOf("")}
 val term=filter.trim()
 val filteredSummary=summary.filter{entry->
  val o=entry.takeIf{it.isJsonObject}?.asJsonObject
  term.isBlank()||listOf("pageName","pageKey").any{k->o?.get(k)?.toString()?.contains(term,true)==true}
 }
 val filteredRecent=recent.filter{entry->
  val o=entry.takeIf{it.isJsonObject}?.asJsonObject
  term.isBlank()||listOf("pageName","pageKey","path","referrer").any{k->o?.get(k)?.toString()?.contains(term,true)==true}
 }
 Column(Modifier.fillMaxSize().padding(horizontal=14.dp,vertical=10.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
  Text("سجل زيارات الموقع",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=DarkAccent)
  Text("إجمالي الزيارات: "+(root?.get("total")?.toString()?: "0"),fontWeight=FontWeight.Bold)
  OutlinedTextField(filter,{filter=it},label={Text("تصفية باسم الصفحة أو المسار")},singleLine=true,modifier=Modifier.fillMaxWidth())
  Text("ملخص الصفحات",fontWeight=FontWeight.Bold,color=DarkAccent)
  if(filteredSummary.isEmpty())Text("لا توجد صفحات مطابقة")
  filteredSummary.forEach{entry->
   val o=entry.asJsonObject
   Card(Modifier.fillMaxWidth(),colors=CardDefaults.cardColors(containerColor=Color.White)){
    Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(3.dp)){
     Text(o.get("pageName")?.asString?:o.get("pageKey")?.asString.orEmpty(),fontWeight=FontWeight.Bold)
     Text("المفتاح: "+(o.get("pageKey")?.asString?: "—"),style=MaterialTheme.typography.bodySmall,color=Color.Gray)
     Text("عدد الزيارات: "+(o.get("visits")?.toString()?: "0"))
     Text("آخر زيارة: "+(o.get("lastVisit")?.toString()?: "—"),style=MaterialTheme.typography.bodySmall,color=Color.Gray)
    }
   }
  }
  Text("أحدث الزيارات",fontWeight=FontWeight.Bold,color=DarkAccent)
  if(filteredRecent.isEmpty())Text("لا توجد زيارات مطابقة")
  LazyColumn(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(7.dp)){
   items(filteredRecent){entry->
    val o=entry.asJsonObject
    Card(Modifier.fillMaxWidth(),colors=CardDefaults.cardColors(containerColor=Color.White)){
     Column(Modifier.padding(10.dp),verticalArrangement=Arrangement.spacedBy(3.dp)){
      Text(o.get("pageName")?.asString?:o.get("pageKey")?.asString.orEmpty(),fontWeight=FontWeight.Bold)
      Text("المسار: "+(o.get("path")?.asString?: "—"),style=MaterialTheme.typography.bodySmall)
      Text("المصدر: "+(o.get("referrer")?.asString?: "مباشر"),style=MaterialTheme.typography.bodySmall,color=Color.Gray)
      Text("التوقيت: "+(o.get("visitedAt")?.toString()?: "—"),style=MaterialTheme.typography.labelSmall,color=Color.Gray)
     }
    }
   }
  }
 }
}

@Composable private fun ReportEditor(payload:JsonElement?,onGenerate:(String,String,JsonObject)->Unit){
 var startDate by remember{mutableStateOf("")}
 var endDate by remember{mutableStateOf("")}
 var service by remember{mutableStateOf("")}
 var area by remember{mutableStateOf("")}
 val root=payload?.takeIf{it.isJsonObject}?.asJsonObject
 val summary=root?.get("summary")?.takeIf{it.isJsonObject}?.asJsonObject
 Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  Text("تقارير المنصة",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=DarkAccent)
  OutlinedTextField(startDate,{startDate=it},label={Text("من تاريخ YYYY-MM-DD")},modifier=Modifier.fillMaxWidth())
  OutlinedTextField(endDate,{endDate=it},label={Text("إلى تاريخ YYYY-MM-DD")},modifier=Modifier.fillMaxWidth())
  OutlinedTextField(service,{service=it},label={Text("الخدمة")},modifier=Modifier.fillMaxWidth())
  OutlinedTextField(area,{area=it},label={Text("المنطقة")},modifier=Modifier.fillMaxWidth())
  Button(onClick={onGenerate("POST","api/admin/reports",JsonObject().apply{addProperty("startDate",startDate);addProperty("endDate",endDate);addProperty("service",service);addProperty("area",area)})},modifier=Modifier.fillMaxWidth()){Text("إنشاء التقرير")}
  if(summary!=null) summary.entrySet().forEach{Text(it.key+" : "+it.value.toString())}
  root?.get("topServices")?.takeIf{it.isJsonArray}?.asJsonArray?.forEach{Text(it.toString())}
 }
}

@Composable private fun ConfigEditor(section:AdminSection,payload:JsonElement?,canWrite:(String)->Boolean,onSave:(String,String,JsonObject)->Unit){
 val root=payload?.takeIf{it.isJsonObject}?.asJsonObject
 if(section==AdminSection.SETTINGS){
  val p=root?.get("settings")?.takeIf{it.isJsonObject}?.asJsonObject
  var name by remember(payload){mutableStateOf(p?.get("siteName")?.asString.orEmpty())}
  var maintenance by remember(payload){mutableStateOf(p?.get("maintenance")?.asBoolean?:false)}
  var message by remember(payload){mutableStateOf(p?.get("maintenanceMessage")?.asString.orEmpty())}
  var attempts by remember(payload){mutableStateOf(p?.get("maxFanniSignupAttempts")?.toString().orEmpty())}
  var wallet1 by remember(payload){mutableStateOf(p?.get("walletPhone1")?.asString.orEmpty())}
  var wallet2 by remember(payload){mutableStateOf(p?.get("walletPhone2")?.asString.orEmpty())}
  Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
   Text("إعدادات المنصة",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=DarkAccent)
   OutlinedTextField(name,{name=it},label={Text("اسم المنصة")},modifier=Modifier.fillMaxWidth())
   Row(verticalAlignment=Alignment.CenterVertically){Text("وضع الصيانة",modifier=Modifier.weight(1f));Switch(maintenance,{maintenance=it})}
   OutlinedTextField(message,{message=it},label={Text("رسالة الصيانة")},modifier=Modifier.fillMaxWidth(),minLines=2)
   OutlinedTextField(attempts,{attempts=it},label={Text("حد محاولات تسجيل الفني")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number),modifier=Modifier.fillMaxWidth())
   OutlinedTextField(wallet1,{wallet1=it},label={Text("رقم المحفظة الأول")},modifier=Modifier.fillMaxWidth())
   OutlinedTextField(wallet2,{wallet2=it},label={Text("رقم المحفظة الثاني")},modifier=Modifier.fillMaxWidth())
   Button(onClick={onSave("PUT","api/admin/settings",JsonObject().apply{addProperty("siteName",name.trim());addProperty("maintenance",maintenance);addProperty("maintenanceMessage",message.trim());addProperty("maxFanniSignupAttempts",attempts.toIntOrNull()?:0);addProperty("walletPhone1",wallet1.trim());addProperty("walletPhone2",wallet2.trim())})},enabled=attempts.toIntOrNull()?.let{it in 1..100}==true&&name.trim().length>=2&&canWrite("api/admin/settings"),modifier=Modifier.fillMaxWidth()){Text("حفظ الإعدادات")}
  }
 }else if(section==AdminSection.PRICING){
  val p=root?.get("pricing")?.takeIf{it.isJsonObject}?.asJsonObject
  var check by remember(payload){mutableStateOf(p?.get("check")?.toString().orEmpty())}
  var commission by remember(payload){mutableStateOf(p?.get("commission")?.toString().orEmpty())}
  var minimum by remember(payload){mutableStateOf(p?.get("minOffer")?.toString().orEmpty())}
  var maximum by remember(payload){mutableStateOf(p?.get("maxOffer")?.toString().orEmpty())}
  Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
   Text("الأسعار والعمولات",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=DarkAccent)
   OutlinedTextField(check,{check=it},label={Text("رسوم الفرصة بالجنيه")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Decimal),modifier=Modifier.fillMaxWidth())
   OutlinedTextField(commission,{commission=it},label={Text("العمولة %")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Decimal),modifier=Modifier.fillMaxWidth())
   OutlinedTextField(minimum,{minimum=it},label={Text("أقل عرض")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number),modifier=Modifier.fillMaxWidth())
   OutlinedTextField(maximum,{maximum=it},label={Text("أعلى عرض")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number),modifier=Modifier.fillMaxWidth())
   Button(onClick={onSave("PUT","api/admin/pricing",JsonObject().apply{addProperty("check",check.toDoubleOrNull()?:0.0);addProperty("commission",commission.toDoubleOrNull()?:0.0);addProperty("minOffer",minimum.toIntOrNull()?:0);addProperty("maxOffer",maximum.toIntOrNull()?:0)})},enabled=check.toDoubleOrNull()?.let{it>=0}==true&&commission.toDoubleOrNull()?.let{it in 0.0..100.0}==true&&minimum.toIntOrNull()?.let{it in 1..1000000}==true&&maximum.toIntOrNull()?.let{it in 1..1000000}==true&&(minimum.toIntOrNull()?:Int.MAX_VALUE)<=(maximum.toIntOrNull()?:Int.MIN_VALUE)&&canWrite("api/admin/pricing"),modifier=Modifier.fillMaxWidth()){Text("حفظ الأسعار")}
   Text("سجل تغييرات الأسعار",fontWeight=FontWeight.Bold,color=DarkAccent)
   root?.get("history")?.takeIf{it.isJsonArray}?.asJsonArray?.take(20)?.forEach{Text(it.toString(),style=MaterialTheme.typography.bodySmall,color=Color.Gray)}
  }
 }else{
  val p=root?.get("content")?.takeIf{it.isJsonObject}?.asJsonObject
  var announcement by remember(payload){mutableStateOf(p?.get("announcement")?.asString.orEmpty())}
  var question by remember(payload){mutableStateOf("")}
  var answer by remember(payload){mutableStateOf("")}
  var faqIndex by remember(payload){mutableStateOf(-1)}
  val faqs=p?.get("faqs")?.takeIf{it.isJsonArray}?.asJsonArray
  Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
   Text("الإعلانات والأسئلة الشائعة",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=DarkAccent)
   OutlinedTextField(announcement,{announcement=it},label={Text("إعلان واجهة العميل")},modifier=Modifier.fillMaxWidth(),minLines=3)
   Button(onClick={onSave("PATCH","api/admin/content/announcement",JsonObject().apply{addProperty("announcement",announcement.trim())})},enabled=canWrite("api/admin/content/announcement"),modifier=Modifier.fillMaxWidth()){Text("حفظ الإعلان")}
   Text("الأسئلة الشائعة",fontWeight=FontWeight.Bold,color=DarkAccent)
   faqs?.forEachIndexed{index,faq->
    Card(Modifier.fillMaxWidth(),colors=CardDefaults.cardColors(containerColor=Color.White)){
     Column(Modifier.padding(12.dp)){
      Text(faq.asJsonObject.get("question")?.asString.orEmpty(),fontWeight=FontWeight.Bold)
      Text(faq.asJsonObject.get("answer")?.asString.orEmpty(),style=MaterialTheme.typography.bodySmall)
      Text("الحالة: "+if(faq.asJsonObject.get("active")?.asBoolean!=false)"مفعل" else "متوقف",style=MaterialTheme.typography.labelSmall,color=Color.Gray)
      Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
       TextButton(onClick={faqIndex=index;question=faq.asJsonObject.get("question")?.asString.orEmpty();answer=faq.asJsonObject.get("answer")?.asString.orEmpty()}){Text("تعديل")}
       TextButton(onClick={
        val body=JsonObject().apply{addProperty("announcement",announcement.trim());val array=com.google.gson.JsonArray();faqs?.forEachIndexed{idx,entry->val copy=entry.asJsonObject.deepCopy();if(idx==index)copy.addProperty("active",copy.get("active")?.asBoolean==false);array.add(copy)};add("faqs",array)}
        onSave("PUT","api/admin/content",body)
       },enabled=canWrite("api/admin/content")){Text(if(faq.asJsonObject.get("active")?.asBoolean==false)"تفعيل" else "إيقاف")}
       TextButton(onClick={onSave("DELETE","api/admin/content/faqs/$index",JsonObject())},enabled=canWrite("api/admin/content/faqs/$index")){Text("حذف",color=Color(0xFFB3261E))}
      }
     }
    }
   }
   OutlinedTextField(question,{question=it},label={Text("سؤال جديد")},modifier=Modifier.fillMaxWidth())
   OutlinedTextField(answer,{answer=it},label={Text("الإجابة")},modifier=Modifier.fillMaxWidth(),minLines=2)
   Button(onClick={
    val body=JsonObject().apply{
     addProperty("announcement",announcement.trim())
     val array=com.google.gson.JsonArray()
     faqs?.forEach{array.add(it)}
     if(faqIndex>=0&&faqIndex<array.size()){
      val old=array[faqIndex].asJsonObject.deepCopy()
      old.addProperty("question",question.trim());old.addProperty("answer",answer.trim());array.set(faqIndex,old)
     }else array.add(JsonObject().apply{addProperty("question",question.trim());addProperty("answer",answer.trim());addProperty("active",true)})
     add("faqs",array)
    }
    onSave("PUT","api/admin/content",body);faqIndex=-1;question="";answer=""
   },enabled=question.trim().length>=2&&answer.trim().length>=2&&canWrite("api/admin/content"),modifier=Modifier.fillMaxWidth()){Text(if(faqIndex>=0)"حفظ تعديل السؤال" else "إضافة السؤال")}
   if(faqIndex>=0)TextButton(onClick={faqIndex=-1;question="";answer=""},modifier=Modifier.fillMaxWidth()){Text("إلغاء التعديل")}
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
private data class RowAction(val label:String,val method:String,val path:String,val body:JsonObject=JsonObject(),val inputKey:String?=null,val inputHint:String="",val secondInputKey:String?=null,val secondInputHint:String="")
@Composable private fun ListScreen(section: AdminSection, items: List<JsonElement>, retry: () -> Unit, onVoice:(String)->Unit, onEditProfile:(String)->Unit, onOpenWallet:(String)->Unit, onEditClient:(String)->Unit, onSupportSearch:(String)->Unit, onBulkPublish:(List<String>)->Unit, onOpenRecovery:(String)->Unit, onBulkAction:(AdminSection,List<String>,String)->Unit, onCanWriteApi:(String)->Boolean, onCanReadApi:(String)->Boolean, onAction:(String,String,JsonObject)->Unit) {
    var query by remember(section) { mutableStateOf("") }
    var statusFilter by remember(section) { mutableStateOf("") }
    var regionFilter by remember(section) { mutableStateOf("") }
    var dateFilter by remember(section) { mutableStateOf("") }
    var pending by remember { mutableStateOf<RowAction?>(null) }
    var actionInput by remember { mutableStateOf("") }
    var actionInput2 by remember { mutableStateOf("") }
    var createOpen by remember(section){mutableStateOf(false)}
    var createName by remember(section){mutableStateOf("")}
    var createCategory by remember(section){mutableStateOf("خدمات أخرى")}
    var createEmoji by remember(section){mutableStateOf("🔧")}
    var notifyOpen by remember(section){mutableStateOf(false)}
    var notifyTitle by remember(section){mutableStateOf("")}
    var notifyMessage by remember(section){mutableStateOf("")}
    var notifyRole by remember(section){mutableStateOf("fanni")}
    var notifyMode by remember(section){mutableStateOf("single")}
    var notifyPhone by remember(section){mutableStateOf("")}
    var notifyAudience by remember(section){mutableStateOf("all")}
    var selectedOrders by remember(section){mutableStateOf(setOf<String>())}
    var selectedBulk by remember(section){mutableStateOf(setOf<String>())}
    var pendingBulk by remember{mutableStateOf<Pair<String,List<String>>?>(null)}
    var pendingPublishSns by remember{mutableStateOf<List<String>?>(null)}
    var categoryOrderOpen by remember(section){mutableStateOf(false)}
    var categoryOrderText by remember(section,items){mutableStateOf(items.filter{it.isJsonObject}.mapNotNull{it.asJsonObject.get("category")?.asString}.distinct().joinToString("، "))}
    var serviceOrderOpen by remember(section){mutableStateOf(false)}
    var serviceOrderCategory by remember(section,items){mutableStateOf(items.firstOrNull{it.isJsonObject}?.asJsonObject?.get("category")?.asString.orEmpty())}
    var serviceOrderText by remember(section,items){mutableStateOf(items.filter{it.isJsonObject}.filter{it.asJsonObject.get("category")?.asString==serviceOrderCategory}.sortedBy{it.asJsonObject.get("sortOrder")?.asInt?:0}.mapNotNull{it.asJsonObject.get("name")?.asString}.joinToString("، "))}
    var correctionOrder by remember{mutableStateOf<JsonElement?>(null)}
    var advancedFanni by remember{mutableStateOf<JsonElement?>(null)}
    var limitFanni by remember{mutableStateOf<JsonElement?>(null)}
    var editingPermissions by remember{mutableStateOf<JsonElement?>(null)}
    val filtered = remember(items, query, statusFilter, regionFilter, dateFilter) {
        items.filter { item ->
            val raw = item.toString()
            val obj = item.takeIf { it.isJsonObject }?.asJsonObject
            val status = listOf("status","actualStatus").mapNotNull { obj?.get(it)?.takeIf { v -> !v.isJsonNull }?.asString }.joinToString(" ")
            val region = listOf("area","region","regionName","areas","city").mapNotNull { obj?.get(it)?.takeIf { v -> !v.isJsonNull }?.toString() }.joinToString(" ")
            val date = listOf("createdAt","requestedAt","reviewedAt","visitedAt").mapNotNull { obj?.get(it)?.takeIf { v -> !v.isJsonNull }?.asString }.joinToString(" ")
            (query.isBlank() || raw.contains(query.trim(), true)) &&
            (statusFilter.isBlank() || status.contains(statusFilter.trim(), true)) &&
            (regionFilter.isBlank() || region.contains(regionFilter.trim(), true)) &&
            (dateFilter.isBlank() || date.contains(dateFilter.trim(), true))
        }
    }
    editingPermissions?.let{admin->AdminPermissionsDialog(admin,{editingPermissions=null}){body->
        val id=admin.asJsonObject.get("_id")?.asString?:admin.asJsonObject.get("id")?.asString.orEmpty()
        editingPermissions=null
        onAction("PATCH","api/admin/admin-users/$id/permissions",body)
    }}
    advancedFanni?.let{fanni->FanniControlsDialog(fanni,{advancedFanni=null}){body->
        val id=fanni.asJsonObject.get("_id")?.asString.orEmpty();advancedFanni=null
        onAction("PATCH","api/admin/fannis/$id/profile-controls",body)
    }}
    limitFanni?.let{fanni->FanniLimitsDialog(fanni,{limitFanni=null}){body->
        val id=fanni.asJsonObject.get("_id")?.asString.orEmpty();limitFanni=null
        onAction("PATCH","api/admin/fannis/$id/limit",body)
    }}
    correctionOrder?.let{order->OrderCorrectionDialog(order,{correctionOrder=null}){body->
        val sn=order.asJsonObject.get("sn")?.asString.orEmpty()
        correctionOrder=null
        onAction("PATCH","api/admin/orders/$sn/correct",body)
    }}
    if(notifyOpen) AlertDialog(
        onDismissRequest={notifyOpen=false},
        title={Text("إرسال إشعار مباشر")},
        text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
            OutlinedTextField(notifyTitle,{notifyTitle=it},label={Text("عنوان الإشعار")},singleLine=true)
            OutlinedTextField(notifyMessage,{notifyMessage=it},label={Text("نص الإشعار")},minLines=2)
            OutlinedTextField(notifyRole,{notifyRole=it},label={Text("نوع الحساب: fanni أو client")},singleLine=true)
            OutlinedTextField(notifyMode,{notifyMode=it},label={Text("النوع: single أو group")},singleLine=true)
            if(notifyMode=="single")OutlinedTextField(notifyPhone,{notifyPhone=it},label={Text("رقم هاتف المستلم")},singleLine=true)
            else OutlinedTextField(notifyAudience,{notifyAudience=it},label={Text("الفئة: all / approved / active / disabled")},singleLine=true)
        }},
        confirmButton={TextButton(onClick={
            val body=JsonObject().apply{addProperty("title",notifyTitle.trim());addProperty("message",notifyMessage.trim());addProperty("recipientRole",notifyRole.trim());addProperty("recipientMode",notifyMode.trim());if(notifyMode=="single")addProperty("phone",notifyPhone.trim())else addProperty("audience",notifyAudience.trim())}
            notifyOpen=false;onAction("POST","api/admin/notifications/direct",body)
        },enabled=notifyTitle.trim().length>=2&&notifyMessage.trim().length>=2&&notifyRole in listOf("fanni","client")&&notifyMode in listOf("single","group")&&!(notifyRole=="fanni"&&notifyMode=="group"&&notifyAudience=="active")){Text("إرسال")}},
        dismissButton={TextButton(onClick={notifyOpen=false}){Text("إلغاء")}}
    )
    pendingBulk?.let{pendingAction->
        AlertDialog(
            onDismissRequest={pendingBulk=null},
            title={Text("تأكيد الإجراء الجماعي")},
            text={Text("سيتم تنفيذ «"+pendingAction.first+"» على "+pendingAction.second.size+" عناصر. العناصر غير المؤهلة سيبلغ عنها التطبيق بعد التنفيذ.")},
            confirmButton={TextButton(onClick={val action=pendingAction.first;val ids=pendingAction.second;pendingBulk=null;selectedBulk=emptySet();onBulkAction(section,ids,action)}){Text("تأكيد التنفيذ")}},
            dismissButton={TextButton(onClick={pendingBulk=null}){Text("إلغاء")}}
        )
    }
    pendingPublishSns?.let{sns->AlertDialog(
        onDismissRequest={pendingPublishSns=null},
        title={Text("تأكيد نشر الطلبات")},
        text={Text("سيتم محاولة نشر "+sns.size+" طلب. الطلب الذي لم تتم مراجعة تسجيله الصوتي سيظل غير منشور.")},
        confirmButton={TextButton(onClick={pendingPublishSns=null;onBulkPublish(sns)}){Text("تأكيد النشر")}},
        dismissButton={TextButton(onClick={pendingPublishSns=null}){Text("إلغاء")}}
    )}
    if(serviceOrderOpen) AlertDialog(
        onDismissRequest={serviceOrderOpen=false},
        title={Text("ترتيب الخدمات داخل القسم")},
        text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
            OutlinedTextField(serviceOrderCategory,{serviceOrderCategory=it},label={Text("اسم القسم")},modifier=Modifier.fillMaxWidth())
            OutlinedTextField(serviceOrderText,{serviceOrderText=it},label={Text("أسماء الخدمات بالترتيب، افصل بينها بفاصلة")},modifier=Modifier.fillMaxWidth(),minLines=4)
            Text("سيتم حفظ الترتيب حسب ترتيب الأسماء من اليمين إلى اليسار.",style=MaterialTheme.typography.bodySmall,color=Color.Gray)
        }},
        confirmButton={TextButton(onClick={
            val names=serviceOrderText.split(',', '،').map{it.trim()}.filter{it.isNotEmpty()}.distinct()
            val body=JsonObject().apply{
                addProperty("category",serviceOrderCategory.trim())
                add("items",com.google.gson.JsonArray().apply{names.forEachIndexed{index,name->add(JsonObject().apply{addProperty("name",name);addProperty("sortOrder",(index+1)*10)})}})
            }
            serviceOrderOpen=false;onAction("PATCH","api/admin/services/order",body)
        },enabled=serviceOrderCategory.trim().length>=2&&serviceOrderText.trim().length>=2){Text("حفظ الترتيب")}},
        dismissButton={TextButton(onClick={serviceOrderOpen=false}){Text("إلغاء")}}
    )
    if(categoryOrderOpen) AlertDialog(
        onDismissRequest={categoryOrderOpen=false},
        title={Text("ترتيب أقسام الخدمات")},
        text={OutlinedTextField(categoryOrderText,{categoryOrderText=it},label={Text("أسماء الأقسام بالترتيب، افصل بينها بفاصلة")},modifier=Modifier.fillMaxWidth(),minLines=3)},
        confirmButton={TextButton(onClick={
            val categories=categoryOrderText.split(',', '،').map{it.trim()}.filter{it.isNotEmpty()}
            val body=JsonObject().apply{add("categories",com.google.gson.JsonArray().apply{categories.forEach{add(it)}})}
            categoryOrderOpen=false;onAction("PATCH","api/admin/services/categories/order",body)
        },enabled=categoryOrderText.trim().length>=2){Text("حفظ الترتيب")}},
        dismissButton={TextButton(onClick={categoryOrderOpen=false}){Text("إلغاء")}}
    )
    if(createOpen) AlertDialog(
        onDismissRequest={createOpen=false},
        title={Text(if(section==AdminSection.SERVICES)"إضافة خدمة" else "إضافة منطقة")},
        text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
            OutlinedTextField(createName,{createName=it},label={Text(if(section==AdminSection.SERVICES)"اسم الخدمة" else "اسم المنطقة")},singleLine=true)
            if(section==AdminSection.SERVICES){
                OutlinedTextField(createCategory,{createCategory=it},label={Text("القسم")},singleLine=true)
                OutlinedTextField(createEmoji,{createEmoji=it},label={Text("الأيقونة")},singleLine=true)
            }
        }},
        confirmButton={TextButton(onClick={
            val body=JsonObject().apply{
                if(section==AdminSection.SERVICES){addProperty("name",createName.trim());addProperty("category",createCategory.trim());addProperty("emoji",createEmoji.trim());addProperty("sortOrder",0)}
                else addProperty("name",createName.trim())
            }
            val path=if(section==AdminSection.SERVICES)"api/admin/services" else "api/admin/regions"
            createOpen=false;onAction("POST",path,body);createName=""
        },enabled=createName.trim().length>=2){Text("إضافة")}},
        dismissButton={TextButton(onClick={createOpen=false}){Text("إلغاء")}}
    )
    if(pending!=null) AlertDialog(
        onDismissRequest={pending=null},
        title={Text("تأكيد الإجراء")},
        text={Column { Text("هل تريد تنفيذ: "+pending!!.label+"؟"); if(pending!!.inputKey!=null) OutlinedTextField(actionInput,{actionInput=it},label={Text(pending!!.inputHint)},visualTransformation=if(pending!!.inputKey=="newPassword")PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,singleLine=true,modifier=Modifier.fillMaxWidth()); if(pending!!.secondInputKey!=null) OutlinedTextField(actionInput2,{actionInput2=it},label={Text(pending!!.secondInputHint)},visualTransformation=if(pending!!.secondInputKey=="confirmPassword")PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,singleLine=true,modifier=Modifier.fillMaxWidth()) }},
        confirmButton={TextButton(onClick={val a=pending!!;val body=a.body.deepCopy();a.inputKey?.let{k->if(k=="amount"||k=="sortOrder")body.addProperty(k,actionInput.toDoubleOrNull()?:0.0) else body.addProperty(k,actionInput.trim())};a.secondInputKey?.let{k->body.addProperty(k,actionInput2.trim())};pending=null;actionInput="";actionInput2="";onAction(a.method,a.path,body)}){Text("تأكيد")}},
        dismissButton={TextButton(onClick={pending=null}){Text("إلغاء")}}
    )
    Column(Modifier.fillMaxSize().padding(horizontal = 14.dp)) {
        OutlinedTextField(query, { query = it }, modifier = Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 6.dp), label = { Text("بحث في " + section.title) }, singleLine = true)
        if((section==AdminSection.SERVICES&&onCanWriteApi("api/admin/services"))||(section==AdminSection.REGIONS&&onCanWriteApi("api/admin/regions"))) Button(onClick={createOpen=true},modifier=Modifier.fillMaxWidth()){Text(if(section==AdminSection.SERVICES)"إضافة خدمة جديدة" else "إضافة منطقة جديدة")}
        if(section==AdminSection.SERVICES&&onCanWriteApi("api/admin/services/categories/order")) Button(onClick={categoryOrderOpen=true},modifier=Modifier.fillMaxWidth()){Text("ترتيب أقسام الخدمات")}
        if(section==AdminSection.SERVICES&&onCanWriteApi("api/admin/services/order")) OutlinedButton(onClick={serviceOrderOpen=true},modifier=Modifier.fillMaxWidth()){Text("ترتيب الخدمات داخل القسم")}
        if(section==AdminSection.NOTIFICATIONS&&onCanWriteApi("api/admin/notifications/direct")) Button(onClick={notifyOpen=true},modifier=Modifier.fillMaxWidth()){Text("إنشاء وإرسال إشعار")}
        if(section==AdminSection.SUPPORT) Button(onClick={onSupportSearch(query)},enabled=query.trim().length>=2,modifier=Modifier.fillMaxWidth()){Text("بحث في الطلبات والشكاوى وأرقام الهواتف")}
        if(selectedBulk.isNotEmpty()){
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical=6.dp),horizontalArrangement=Arrangement.spacedBy(6.dp)){
                Text("المحدد: "+selectedBulk.size,modifier=Modifier.align(Alignment.CenterVertically),fontWeight=FontWeight.Bold)
                fun runBulk(action:String){pendingBulk=action to selectedBulk.toList()}
                when(section){
                    AdminSection.TECHNICIANS,AdminSection.PENDING,AdminSection.DISABLED->{
                        if(onCanWriteApi("api/admin/fannis/x/approve"))Button(onClick={runBulk("approve")}){Text("اعتماد")}
                        if(onCanWriteApi("api/admin/fannis/x/reject"))Button(onClick={runBulk("reject")}){Text("رفض")}
                        if(onCanWriteApi("api/admin/fannis/x/disable"))Button(onClick={runBulk("disable")}){Text("إيقاف")}
                        if(onCanWriteApi("api/admin/fannis/x/enable"))Button(onClick={runBulk("enable")}){Text("تفعيل")}
                        if(onCanWriteApi("api/admin/wallet/freeze/x"))Button(onClick={runBulk("freeze")}){Text("تجميد المحافظ")}
                        if(onCanWriteApi("api/admin/wallet/freeze/x"))Button(onClick={runBulk("unfreeze")}){Text("فك التجميد")}
                    }
                    AdminSection.WALLETS->{if(onCanWriteApi("api/admin/wallet/freeze/x")){Button(onClick={runBulk("freeze")}){Text("تجميد المحافظ")};Button(onClick={runBulk("unfreeze")}){Text("فك التجميد")}}}
                    AdminSection.TOPUPS->{if(onCanWriteApi("api/admin/topup-requests/x/approve"))Button(onClick={runBulk("approve")}){Text("قبول الشحن")};if(onCanWriteApi("api/admin/topup-requests/x/reject"))Button(onClick={runBulk("reject")}){Text("رفض الشحن")}}
                    AdminSection.CLIENTS->{if(onCanWriteApi("api/admin/clients/x/account"))Button(onClick={runBulk("delete")}){Text("حذف الحسابات المحددة")}}
                    AdminSection.COMPLAINTS->{if(onCanWriteApi("api/admin/complaints/x")){Button(onClick={runBulk("قيد المراجعة")}){Text("مراجعة")};Button(onClick={runBulk("تم الحل")}){Text("حل الشكاوى")};Button(onClick={runBulk("مرفوضة")}){Text("رفض")}}}
                    AdminSection.OFFERS->{if(onCanWriteApi("api/admin/offers/SN000000/0/reject"))Button(onClick={runBulk("reject")}){Text("رفض العروض")}}
                    AdminSection.REGIONS->{if(onCanWriteApi("api/admin/regions/x")){Button(onClick={runBulk("activate")}){Text("تفعيل")};Button(onClick={runBulk("deactivate")}){Text("إيقاف")};Button(onClick={runBulk("restore")}){Text("استعادة")};Button(onClick={runBulk("delete")}){Text("حذف")}}}
                    else->Unit
                }
                OutlinedButton(onClick={selectedBulk=emptySet()}){Text("إلغاء")}
            }
        }
        if(section==AdminSection.ORDERS && selectedOrders.isNotEmpty()){
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
                if(onCanWriteApi("api/orders/admin/SN000000/publish"))Button(onClick={pendingPublishSns=selectedOrders.toList();selectedOrders=emptySet()},modifier=Modifier.weight(1f)){Text("نشر المحدد ("+selectedOrders.size+")")}
                if(onCanWriteApi("api/admin/orders/bulk-delete"))Button(onClick={
                    val body=JsonObject().apply{add("sns",com.google.gson.JsonArray().apply{selectedOrders.forEach{add(it)}})}
                    pending=RowAction("حذف الطلبات المحددة","POST","api/admin/orders/bulk-delete",body);selectedOrders=emptySet()
                },modifier=Modifier.weight(1f)){Text("حذف المحدد")}
                OutlinedButton(onClick={selectedOrders=emptySet()},modifier=Modifier.weight(1f)){Text("إلغاء")}
            }
        }
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(bottom=8.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){
            OutlinedTextField(statusFilter,{statusFilter=it},modifier=Modifier.width(145.dp),label={Text("فلتر الحالة")},singleLine=true)
            OutlinedTextField(regionFilter,{regionFilter=it},modifier=Modifier.width(145.dp),label={Text("المنطقة")},singleLine=true)
            OutlinedTextField(dateFilter,{dateFilter=it},modifier=Modifier.width(145.dp),label={Text("التاريخ YYYY-MM-DD")},singleLine=true)
        }
        if (filtered.isEmpty()) {
            Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Text(if (items.isEmpty()) "لا توجد بيانات متاحة حاليًا" else "لا توجد نتائج مطابقة")
                if (items.isEmpty()) OutlinedButton(onClick = retry, modifier = Modifier.padding(top = 10.dp)) { Text("إعادة المحاولة") }
            }
        } else LazyColumn(contentPadding = PaddingValues(bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(filtered) { item ->
                val actions=rowActions(section,item).filter{onCanWriteApi(it.path)}
                Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(14.dp)) {
                    Column(Modifier.padding(14.dp)) {
                        if(section==AdminSection.ORDERS&&(onCanWriteApi("api/orders/admin/SN000000/publish")||onCanWriteApi("api/admin/orders/bulk-delete"))){
                            val orderSn=item.asJsonObject.get("sn")?.asString.orEmpty()
                            if(orderSn.isNotBlank())Row(verticalAlignment=Alignment.CenterVertically){
                                Checkbox(checked=selectedOrders.contains(orderSn),onCheckedChange={checked->selectedOrders=if(checked)selectedOrders+orderSn else selectedOrders-orderSn})
                                Text("تحديد الطلب "+orderSn,style=MaterialTheme.typography.labelSmall,color=Color.Gray)
                            }
                        }
                        val bulkKey=when(section){
                            AdminSection.TECHNICIANS,AdminSection.PENDING,AdminSection.DISABLED,AdminSection.WALLETS,AdminSection.TOPUPS,AdminSection.COMPLAINTS,AdminSection.REGIONS->item.asJsonObject.get("_id")?.asString?:item.asJsonObject.get("id")?.asString
                            else->null
                        }
                        val canSelectBulk=when(section){
                            AdminSection.TECHNICIANS,AdminSection.PENDING,AdminSection.DISABLED->onCanWriteApi("api/admin/fannis/x/approve")||onCanWriteApi("api/admin/wallet/freeze/x")
                            AdminSection.WALLETS->onCanWriteApi("api/admin/wallet/freeze/x")
                            AdminSection.TOPUPS->onCanWriteApi("api/admin/topup-requests/x/approve")
                            AdminSection.COMPLAINTS->onCanWriteApi("api/admin/complaints/x")
                            AdminSection.OFFERS->onCanWriteApi("api/admin/offers/SN000000/0/reject")
                            AdminSection.REGIONS->onCanWriteApi("api/admin/regions/x")
                            else->false
                        }
                        if(bulkKey!=null&&canSelectBulk)Row(verticalAlignment=Alignment.CenterVertically){
                            Checkbox(checked=selectedBulk.contains(bulkKey),onCheckedChange={checked->selectedBulk=if(checked)selectedBulk+bulkKey else selectedBulk-bulkKey})
                            Text("تحديد للإجراء الجماعي",style=MaterialTheme.typography.labelSmall,color=Color.Gray)
                        }
                        Text(primary(item), fontWeight = FontWeight.Bold, color = DarkAccent)
                        val detail = secondary(item)
                        if (detail.isNotBlank()) Text(detail, color = Color.DarkGray, modifier = Modifier.padding(top = 5.dp))
                        if(section==AdminSection.OFFERS && item.isJsonObject){
                            val orderSn=item.asJsonObject.get("sn")?.asString.orEmpty()
                            item.asJsonObject.get("offers")?.takeIf{it.isJsonArray}?.asJsonArray?.forEachIndexed{index,offer->
                                Card(Modifier.fillMaxWidth().padding(top=6.dp),colors=CardDefaults.cardColors(containerColor=Color(0xFFF4F8FA))){
                                    Column(Modifier.padding(10.dp)){
                                        Text("العرض "+(index+1),fontWeight=FontWeight.Bold)
                                        Row(verticalAlignment=Alignment.CenterVertically){
                                            val offerKey="$orderSn|$index"
                                            Checkbox(checked=selectedBulk.contains(offerKey),onCheckedChange={checked->selectedBulk=if(checked)selectedBulk+offerKey else selectedBulk-offerKey})
                                            Text("تحديد العرض",style=MaterialTheme.typography.labelSmall,color=Color.Gray)
                                        }
                                        Text(offer.toString(),style=MaterialTheme.typography.bodySmall)
                                        OutlinedButton(onClick={pending=RowAction("حذف العرض","DELETE","api/admin/offers/$orderSn/$index")},modifier=Modifier.fillMaxWidth()){Text("حذف العرض")}
                                        OutlinedButton(onClick={pending=RowAction("رفض العرض","POST","api/admin/offers/$orderSn/$index/reject")},modifier=Modifier.fillMaxWidth()){Text("رفض العرض")}
                                    }
                                }
                            }
                        }
                        if(section==AdminSection.ROLES){
                            val adminId=item.asJsonObject.get("_id")?.asString?:item.asJsonObject.get("id")?.asString.orEmpty()
                            if(adminId.isNotBlank()&&item.asJsonObject.get("isRootAdmin")?.asBoolean!=true)OutlinedButton(onClick={editingPermissions=item},modifier=Modifier.fillMaxWidth().padding(top=8.dp)){Text("تخصيص صلاحيات القراءة والتنفيذ")}
                        }
                        if(section==AdminSection.RECOVERY){
                            val recoveryId=item.asJsonObject.get("id")?.asString?:item.asJsonObject.get("_id")?.asString.orEmpty()
                            if(recoveryId.isNotBlank())OutlinedButton(onClick={onOpenRecovery(recoveryId)},modifier=Modifier.fillMaxWidth().padding(top=8.dp)){Text("فتح محادثة استعادة كلمة المرور")}
                        }
                        if(section==AdminSection.LEVELS && item.isJsonObject){
                            val fanniId=item.asJsonObject.get("_id")?.asString.orEmpty()
                            if(fanniId.isNotBlank()) FanniLevelBadgeControls(item,onCanWriteApi) { method,path,body -> onAction(method,path,body) }
                        }
                        if(section==AdminSection.PROFILE_EDITS && item.isJsonObject){
                            val pending=item.asJsonObject.get("pendingProfileChange")?.takeIf{it.isJsonObject}?.asJsonObject
                            val before=pending?.get("before")?.takeIf{it.isJsonObject}?.asJsonObject
                            if(pending!=null){
                                Card(Modifier.fillMaxWidth().padding(top=8.dp),colors=CardDefaults.cardColors(containerColor=Color(0xFFF4F8FA))){
                                    Column(Modifier.padding(10.dp),verticalArrangement=Arrangement.spacedBy(5.dp)){
                                        Text("مقارنة طلب تعديل البيانات",fontWeight=FontWeight.Bold,color=DarkAccent)
                                        Text("البيانات الحالية",fontWeight=FontWeight.SemiBold)
                                        Text("الهاتف: "+(before?.get("phone")?.asString?:item.asJsonObject.get("phone")?.asString.orEmpty()))
                                        Text("التخصصات: "+(before?.get("specialties")?.toString()?: "—"))
                                        Text("مناطق العمل: "+(before?.get("areas")?.toString()?: "—"))
                                        Divider()
                                        Text("البيانات المطلوبة",fontWeight=FontWeight.SemiBold,color=Accent)
                                        Text("الهاتف: "+(pending.get("phone")?.asString?:before?.get("phone")?.asString.orEmpty()))
                                        Text("التخصصات: "+(pending.get("specialties")?.toString()?:before?.get("specialties")?.toString().orEmpty()))
                                        Text("مناطق العمل: "+(pending.get("areas")?.toString()?:before?.get("areas")?.toString().orEmpty()))
                                        Text("الحقول المطلوبة: "+(pending.get("changedFields")?.toString()?: "—"),style=MaterialTheme.typography.bodySmall,color=Color.Gray)
                                    }
                                }
                            }
                        }
                        if(section==AdminSection.CLIENTS&&onCanWriteApi("api/admin/client-accounts/x/profile")){
                            val clientId=item.asJsonObject.get("_id")?.asString?:item.asJsonObject.get("id")?.asString.orEmpty()
                            if(clientId.isNotBlank())OutlinedButton(onClick={onEditClient(clientId)},modifier=Modifier.fillMaxWidth().padding(top=8.dp)){Text("تعديل بيانات العميل")}
                        }
                        if(section==AdminSection.WALLETS){
                            val fanniId=item.asJsonObject.get("_id")?.asString.orEmpty()
                            if(fanniId.isNotBlank())OutlinedButton(onClick={onOpenWallet(fanniId)},modifier=Modifier.fillMaxWidth().padding(top=8.dp)){Text("عرض حركات المحفظة")}
                        }
                        if((section==AdminSection.TECHNICIANS||section==AdminSection.PENDING||section==AdminSection.DISABLED)&&onCanWriteApi("api/admin/fannis/x/profile-controls")){
                            val fanni=item.asJsonObject
                            OutlinedButton(onClick={advancedFanni=item},modifier=Modifier.fillMaxWidth().padding(top=6.dp)){Text("إعدادات الثقة والظهور")}
                            OutlinedButton(onClick={limitFanni=item},modifier=Modifier.fillMaxWidth()){Text("حدود استقبال الطلبات والعروض")}
                        }
                        if((section==AdminSection.TECHNICIANS||section==AdminSection.PENDING||section==AdminSection.DISABLED)&&onCanWriteApi("api/admin/fannis/x/profile")){
                            val fanniId=item.asJsonObject.get("_id")?.asString.orEmpty()
                            if(fanniId.isNotBlank())OutlinedButton(onClick={onEditProfile(fanniId)},modifier=Modifier.fillMaxWidth().padding(top=8.dp)){Text("تعديل بيانات الفني")}
                        }
                        if(section==AdminSection.ORDERS&&onCanWriteApi("api/admin/orders/x/correct")){
                            OutlinedButton(onClick={correctionOrder=item},modifier=Modifier.fillMaxWidth().padding(top=8.dp)){Text("تصحيح بيانات الطلب")}
                        }
                        if(section==AdminSection.ORDERS && item.isJsonObject && item.asJsonObject.get("hasVoiceRecording")?.asBoolean==true){
                            val orderSn=item.asJsonObject.get("sn")?.asString.orEmpty()
                            OutlinedButton(onClick={onVoice(orderSn)},modifier=Modifier.fillMaxWidth().padding(top=8.dp)){Text("استماع للتسجيل الصوتي")}
                        }
                        if(actions.isNotEmpty()){
                            Row(Modifier.fillMaxWidth().padding(top=10.dp),horizontalArrangement=Arrangement.spacedBy(6.dp)){
                                actions.forEach { action ->
                                    OutlinedButton(onClick={pending=action;actionInput="";actionInput2=""},modifier=Modifier.weight(1f)) { Text(action.label, maxLines=1) }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
private fun rowActions(section:AdminSection,item:JsonElement):List<RowAction>{
 if(!item.isJsonObject)return emptyList()
 val o=item.asJsonObject
 fun value(vararg keys:String):String?=keys.firstNotNullOfOrNull{k->o.get(k)?.takeIf{!it.isJsonNull}?.asString}
 val id=value("_id","id").orEmpty()
 val phone=value("phone","clientPhone")
 val sn=value("sn","target")
 return when(section){
  AdminSection.TECHNICIANS,AdminSection.PENDING,AdminSection.DISABLED->listOf(
   RowAction("اعتماد","POST","api/admin/fannis/$id/approve"),
   RowAction("رفض","POST","api/admin/fannis/$id/reject",JsonObject().apply{addProperty("reason","رفض من تطبيق الإدارة")}),
   RowAction("إيقاف","POST","api/admin/fannis/$id/disable",JsonObject().apply{addProperty("reason","إيقاف من تطبيق الإدارة")}),
   RowAction("تفعيل","POST","api/admin/fannis/$id/enable"),
   RowAction("حذف الفني","DELETE","api/admin/fannis/$id"),
   RowAction("تعديل المستوى","PATCH","api/admin/fannis/$id/level",JsonObject(),"level","المستوى الجديد"),
   RowAction("تعيين منصب إداري","POST","api/admin/admin-users",JsonObject().apply{addProperty("fanniId",id)},"role","المنصب الإداري"),
   RowAction("شارة موثوق","PATCH","api/admin/fannis/$id/badge",JsonObject().apply{addProperty("badge","trusted")}),
   RowAction("إزالة شارة موثوق","PATCH","api/admin/fannis/$id/badge",JsonObject().apply{addProperty("badge","trusted");addProperty("action","remove")}),
   RowAction("حفظ ملاحظة","PATCH","api/admin/fannis/$id/note",JsonObject(),"note","الملاحظة الداخلية"),
   RowAction("تغيير كلمة المرور","PATCH","api/admin/fannis/$id/password",JsonObject(),"newPassword","كلمة المرور الجديدة","confirmPassword","تأكيد كلمة المرور")
  )
  AdminSection.PROFILE_EDITS->listOf(
   RowAction("قبول التعديل","POST","api/admin/fanni-profile-edits/$id/approve"),
   RowAction("رفض التعديل","POST","api/admin/fanni-profile-edits/$id/reject",JsonObject().apply{addProperty("reason","رفض من تطبيق الإدارة")})
  )
  AdminSection.TOPUPS->listOf(
   RowAction("قبول الشحن","POST","api/admin/topup-requests/$id/approve"),
   RowAction("رفض الشحن","POST","api/admin/topup-requests/$id/reject",JsonObject().apply{addProperty("reason","رفض من تطبيق الإدارة")})
  )
  AdminSection.WALLETS->listOf(
   RowAction("تعيين الرصيد","POST","api/admin/fannis/$id/set-balance",JsonObject(),"amount","الرصيد الجديد بالجنيه"),
   RowAction("إضافة رصيد","POST","api/admin/fannis/$id/add-balance",JsonObject(),"amount","المبلغ المراد إضافته"),
   RowAction("تجميد المحفظة","POST","api/admin/wallet/freeze/$id",JsonObject().apply{addProperty("action","freeze");addProperty("reason","من تطبيق الإدارة")}),
   RowAction("فك تجميد المحفظة","POST","api/admin/wallet/freeze/$id",JsonObject().apply{addProperty("action","unfreeze");addProperty("reason","من تطبيق الإدارة")})
  )
  AdminSection.SERVICES->{
   val name=value("name")?:return emptyList()
   val encoded=Uri.encode(name)
   listOf(
    RowAction("إخفاء الخدمة","POST","api/admin/services/$encoded/hide"),
    RowAction("إظهار الخدمة","POST","api/admin/services/$encoded/show"),
    RowAction("تعديل الاسم","PATCH","api/admin/services/$encoded?category="+Uri.encode(value("category").orEmpty()),JsonObject().apply{addProperty("category",value("category").orEmpty())},"name","اسم الخدمة الجديد"),
    RowAction("تغيير الأيقونة","PATCH","api/admin/services/$encoded?category="+Uri.encode(value("category").orEmpty()),JsonObject().apply{addProperty("category",value("category").orEmpty())},"emoji","رمز الخدمة"),
    RowAction("حذف الخدمة","DELETE","api/admin/services/$id?category="+Uri.encode(value("category").orEmpty()))
   )
  }
  AdminSection.CLIENTS->if(phone!=null)listOf(
   RowAction("حظر العميل","POST","api/admin/clients/$phone/block",JsonObject().apply{addProperty("reason","حظر من تطبيق الإدارة")}),
   RowAction("إلغاء الحظر","POST","api/admin/clients/$phone/unblock"),
   RowAction("تغيير كلمة المرور","PATCH","api/admin/clients/$phone/password",JsonObject(), "newPassword","كلمة المرور الجديدة","confirmPassword","تأكيد كلمة المرور"),
   RowAction("حفظ ملاحظة داخلية","POST","api/admin/clients/$phone/note",JsonObject(), "note","الملاحظة الداخلية")
  )else emptyList()
  AdminSection.ORDERS->if(sn!=null){
   val actions=mutableListOf(RowAction("نشر الطلب","POST","api/orders/admin/$sn/publish"))
   actions.add(RowAction("تعيين فني","POST","api/admin/orders/$sn/assign",JsonObject(),"offerId","معرّف العرض","reason","سبب التعيين"))
   if(o.get("hasVoiceRecording")?.asBoolean==true)actions.add(RowAction("تأكيد مراجعة الصوت","POST","api/orders/admin/$sn/voice-reviewed"))
   actions.add(RowAction("إلغاء الطلب","POST","api/admin/orders/$sn/cancel",JsonObject().apply{addProperty("reason","إلغاء من تطبيق الإدارة")}))
   actions.add(RowAction("أرشفة","POST","api/admin/orders/$sn/archive"))
   actions.add(RowAction("حذف","DELETE","api/admin/orders/$sn"))
   actions
  }else emptyList()
  AdminSection.SUPPORT->if(sn!=null)listOf(RowAction("وضع علامة مراجعة","POST","api/admin/support/$sn/review"))else emptyList()
  AdminSection.RECOVERY->if(id.isNotBlank())listOf(
   RowAction("إرسال رد","POST","api/password-recovery/admin/requests/$id/reply",JsonObject(),"text","اكتب الرد للمستخدم"),
   RowAction("رفض الطلب","POST","api/password-recovery/admin/requests/$id/reject",JsonObject(),"reason","سبب الرفض")
  )else emptyList()
  AdminSection.COMPLAINTS->listOf(
   RowAction("حفظ رد وملاحظة","PATCH","api/admin/complaints/$id",JsonObject().apply{addProperty("status","قيد المراجعة")},"adminNote","ملاحظة داخلية","adminResponse","رد رسمي للعميل"),
   RowAction("قيد المراجعة","PATCH","api/admin/complaints/$id",JsonObject().apply{addProperty("status","قيد المراجعة")}),
   RowAction("حل الشكوى","PATCH","api/admin/complaints/$id",JsonObject().apply{addProperty("status","تم الحل")}),
   RowAction("رفض","PATCH","api/admin/complaints/$id",JsonObject().apply{addProperty("status","مرفوضة")})
  )
  AdminSection.REGIONS->listOf(
   RowAction("تعديل الاسم","PATCH","api/admin/regions/$id",JsonObject(),"name","اسم المنطقة الجديد"),
   RowAction("تفعيل","PATCH","api/admin/regions/$id",JsonObject().apply{addProperty("isActive",true)}),
   RowAction("استعادة","PATCH","api/admin/regions/$id",JsonObject().apply{addProperty("isDeleted",false)}),
   RowAction("إيقاف","PATCH","api/admin/regions/$id",JsonObject().apply{addProperty("isActive",false)}),
   RowAction("حذف","DELETE","api/admin/regions/$id")
  )
  AdminSection.NOTIFICATIONS->listOf(RowAction("حذف الحملة","DELETE","api/admin/notifications/direct/$id"))
  AdminSection.LEVELS->listOf(RowAction("تغيير المستوى","PATCH","api/admin/fannis/$id/level",JsonObject(),"level","المستوى: مبتدئ، ممارس، محترف، خبير مبتدئ، خبير، خبير أول، استشاري فني، نخبة، أسطوري","reason","سبب التغيير (اختياري)"),RowAction("إضافة شارة","PATCH","api/admin/fannis/$id/badge",JsonObject().apply{addProperty("action","add")},"badge","الشارة: trusted / top_rated / verified / fast_response / premium / gold"),RowAction("إزالة شارة","PATCH","api/admin/fannis/$id/badge",JsonObject().apply{addProperty("action","remove")},"badge","اسم الشارة المراد إزالتها"))
  AdminSection.ROLES->if(o.get("isRootAdmin")?.asBoolean==true)emptyList() else listOf(RowAction("تغيير دور المشرف","PATCH","api/admin/admin-users/$id/role",JsonObject(),"role","الدور: مشرف / مشرف أول / مدير / قراءة فقط"),RowAction("إلغاء صلاحية المشرف","DELETE","api/admin/admin-users/$id"))
  else->emptyList()
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
    return listOf("status", "phone", "clientPhone", "area", "region", "createdAt", "specialties", "message", "adminNote", "orderCount", "lastOrder")
        .mapNotNull { k -> item.asJsonObject.get(k)?.takeIf { !it.isJsonNull }?.let { "$k: $it" } }.take(4).joinToString("  •  ")
}
