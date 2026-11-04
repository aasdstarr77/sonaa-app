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
        super.onCreate(savedInstanceState)
        initializeFirebase()
        SonaaMessagingService.createChannels(getSystemService(NotificationManager::class.java))
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
        pendingDestination = intent?.getStringExtra("destination")
        setContent {
            val vm: AdminViewModel = viewModel()
            val state by vm.state.collectAsState()
            LaunchedEffect(Unit) { kotlinx.coroutines.delay(2000); vm.restore() }
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
        state.voicePath?.let { path -> VoicePlayer(path) { } }
        state.actionMessage?.let { message ->
            Card(Modifier.fillMaxWidth().padding(horizontal=12.dp, vertical=6.dp), colors=CardDefaults.cardColors(containerColor=Color(0xFFEAF6F8))) {
                Text(message, modifier=Modifier.padding(10.dp), color=DarkAccent, maxLines=5)
            }
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
            state.section == AdminSection.SETTINGS || state.section == AdminSection.PRICING || state.section == AdminSection.CONTENT -> ConfigEditor(state.section, state.payload) { method, path, body -> vm.mutate(method, path, body) }
            else -> ListScreen(state.section, state.items, vm::retry, vm::loadVoice) { method, path, body -> vm.mutate(method, path, body) }
        }
    }
}
@Composable private fun ConfigEditor(section:AdminSection,payload:JsonElement?,onSave:(String,String,JsonObject)->Unit){
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
   Button(onClick={onSave("PUT","api/admin/settings",JsonObject().apply{addProperty("siteName",name.trim());addProperty("maintenance",maintenance);addProperty("maintenanceMessage",message.trim());addProperty("maxFanniSignupAttempts",attempts.toIntOrNull()?:0);addProperty("walletPhone1",wallet1.trim());addProperty("walletPhone2",wallet2.trim())})},modifier=Modifier.fillMaxWidth()){Text("حفظ الإعدادات")}
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
   Button(onClick={onSave("PUT","api/admin/pricing",JsonObject().apply{addProperty("check",check.toDoubleOrNull()?:0.0);addProperty("commission",commission.toDoubleOrNull()?:0.0);addProperty("minOffer",minimum.toIntOrNull()?:0);addProperty("maxOffer",maximum.toIntOrNull()?:0)})},modifier=Modifier.fillMaxWidth()){Text("حفظ الأسعار")}
   Text("سجل تغييرات الأسعار",fontWeight=FontWeight.Bold,color=DarkAccent)
   root?.get("history")?.takeIf{it.isJsonArray}?.asJsonArray?.take(20)?.forEach{Text(it.toString(),style=MaterialTheme.typography.bodySmall,color=Color.Gray)}
  }
 }else{
  val p=root?.get("content")?.takeIf{it.isJsonObject}?.asJsonObject
  var announcement by remember(payload){mutableStateOf(p?.get("announcement")?.asString.orEmpty())}
  var question by remember(payload){mutableStateOf("")}
  var answer by remember(payload){mutableStateOf("")}
  val faqs=p?.get("faqs")?.takeIf{it.isJsonArray}?.asJsonArray
  Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
   Text("الإعلانات والأسئلة الشائعة",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,color=DarkAccent)
   OutlinedTextField(announcement,{announcement=it},label={Text("إعلان واجهة العميل")},modifier=Modifier.fillMaxWidth(),minLines=3)
   Button(onClick={onSave("PATCH","api/admin/content/announcement",JsonObject().apply{addProperty("announcement",announcement.trim())})},modifier=Modifier.fillMaxWidth()){Text("حفظ الإعلان")}
   Text("الأسئلة الشائعة",fontWeight=FontWeight.Bold,color=DarkAccent)
   faqs?.forEachIndexed{index,faq->
    Card(Modifier.fillMaxWidth(),colors=CardDefaults.cardColors(containerColor=Color.White)){
     Column(Modifier.padding(12.dp)){
      Text(faq.asJsonObject.get("question")?.asString.orEmpty(),fontWeight=FontWeight.Bold)
      Text(faq.asJsonObject.get("answer")?.asString.orEmpty(),style=MaterialTheme.typography.bodySmall)
      TextButton(onClick={onSave("DELETE","api/admin/content/faqs/$index",JsonObject())}){Text("حذف السؤال")}
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
     array.add(JsonObject().apply{addProperty("question",question.trim());addProperty("answer",answer.trim());addProperty("active",true)})
     add("faqs",array)
    }
    onSave("PUT","api/admin/content",body)
   },enabled=question.trim().length>=2&&answer.trim().length>=2,modifier=Modifier.fillMaxWidth()){Text("إضافة السؤال")}
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
private data class RowAction(val label:String,val method:String,val path:String,val body:JsonObject=JsonObject(),val inputKey:String?=null,val inputHint:String="")
@Composable private fun ListScreen(section: AdminSection, items: List<JsonElement>, retry: () -> Unit, onVoice:(String)->Unit, onAction:(String,String,JsonObject)->Unit) {
    var query by remember(section) { mutableStateOf("") }
    var statusFilter by remember(section) { mutableStateOf("") }
    var regionFilter by remember(section) { mutableStateOf("") }
    var dateFilter by remember(section) { mutableStateOf("") }
    var pending by remember { mutableStateOf<RowAction?>(null) }
    var actionInput by remember { mutableStateOf("") }
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
    if(pending!=null) AlertDialog(
        onDismissRequest={pending=null},
        title={Text("تأكيد الإجراء")},
        text={Column { Text("هل تريد تنفيذ: "+pending!!.label+"؟"); if(pending!!.inputKey!=null) OutlinedTextField(actionInput,{actionInput=it},label={Text(pending!!.inputHint)},singleLine=true,modifier=Modifier.fillMaxWidth()) }},
        confirmButton={TextButton(onClick={val a=pending!!;val body=a.body.deepCopy();a.inputKey?.let{k->if(k=="amount")body.addProperty(k,actionInput.toDoubleOrNull()?:0.0) else body.addProperty(k,actionInput.trim())};pending=null;actionInput="";onAction(a.method,a.path,body)}){Text("تأكيد")}},
        dismissButton={TextButton(onClick={pending=null}){Text("إلغاء")}}
    )
    Column(Modifier.fillMaxSize().padding(horizontal = 14.dp)) {
        OutlinedTextField(query, { query = it }, modifier = Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 6.dp), label = { Text("بحث في " + section.title) }, singleLine = true)
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
                val actions=rowActions(section,item)
                Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(14.dp)) {
                    Column(Modifier.padding(14.dp)) {
                        Text(primary(item), fontWeight = FontWeight.Bold, color = DarkAccent)
                        val detail = secondary(item)
                        if (detail.isNotBlank()) Text(detail, color = Color.DarkGray, modifier = Modifier.padding(top = 5.dp))
                        if(section==AdminSection.ORDERS && item.isJsonObject && item.asJsonObject.get("hasVoiceRecording")?.asBoolean==true){
                            val orderSn=item.asJsonObject.get("sn")?.asString.orEmpty()
                            OutlinedButton(onClick={onVoice(orderSn)},modifier=Modifier.fillMaxWidth().padding(top=8.dp)){Text("استماع للتسجيل الصوتي")}
                        }
                        if(actions.isNotEmpty()){
                            Row(Modifier.fillMaxWidth().padding(top=10.dp),horizontalArrangement=Arrangement.spacedBy(6.dp)){
                                actions.forEach { action ->
                                    OutlinedButton(onClick={pending=action;actionInput=""},modifier=Modifier.weight(1f)) { Text(action.label, maxLines=1) }
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
 val id=value("_id","id")?:return emptyList()
 val phone=value("phone","clientPhone")
 val sn=value("sn")
 return when(section){
  AdminSection.TECHNICIANS,AdminSection.PENDING,AdminSection.DISABLED->listOf(
   RowAction("اعتماد","POST","api/admin/fannis/$id/approve"),
   RowAction("رفض","POST","api/admin/fannis/$id/reject",JsonObject().apply{addProperty("reason","رفض من تطبيق الإدارة")}),
   RowAction("إيقاف","POST","api/admin/fannis/$id/disable",JsonObject().apply{addProperty("reason","إيقاف من تطبيق الإدارة")}),
   RowAction("تفعيل","POST","api/admin/fannis/$id/enable"),
   RowAction("حذف الفني","DELETE","api/admin/fannis/$id")
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
    RowAction("حذف الخدمة","DELETE","api/admin/services/$id")
   )
  }
  AdminSection.CLIENTS->if(phone!=null)listOf(
   RowAction("حظر العميل","POST","api/admin/clients/$phone/block",JsonObject().apply{addProperty("reason","حظر من تطبيق الإدارة")}),
   RowAction("إلغاء الحظر","POST","api/admin/clients/$phone/unblock")
  )else emptyList()
  AdminSection.ORDERS->if(sn!=null)listOf(
   RowAction("إلغاء الطلب","POST","api/admin/orders/$sn/cancel",JsonObject().apply{addProperty("reason","إلغاء من تطبيق الإدارة")}),
   RowAction("أرشفة","POST","api/admin/orders/$sn/archive"),
   RowAction("حذف","DELETE","api/admin/orders/$sn")
  )else emptyList()
  AdminSection.RECOVERY->listOf(
   RowAction("إرسال رد","POST","api/password-recovery/admin/requests/$id/reply",JsonObject(),"text","اكتب الرد للمستخدم"),
   RowAction("رفض الطلب","POST","api/password-recovery/admin/requests/$id/reject",JsonObject(),"reason","سبب الرفض")
  )
  AdminSection.COMPLAINTS->listOf(
   RowAction("قيد المراجعة","PATCH","api/admin/complaints/$id",JsonObject().apply{addProperty("status","قيد المراجعة")}),
   RowAction("حل الشكوى","PATCH","api/admin/complaints/$id",JsonObject().apply{addProperty("status","تم الحل")}),
   RowAction("رفض","PATCH","api/admin/complaints/$id",JsonObject().apply{addProperty("status","مرفوضة")})
  )
  AdminSection.REGIONS->listOf(
   RowAction("تفعيل","PATCH","api/admin/regions/$id",JsonObject().apply{addProperty("isActive",true)}),
   RowAction("استعادة","PATCH","api/admin/regions/$id",JsonObject().apply{addProperty("isDeleted",false)}),
   RowAction("إيقاف","PATCH","api/admin/regions/$id",JsonObject().apply{addProperty("isActive",false)}),
   RowAction("حذف","DELETE","api/admin/regions/$id")
  )
  AdminSection.NOTIFICATIONS->listOf(RowAction("حذف الحملة","DELETE","api/admin/notifications/direct/$id"))
  AdminSection.ROLES->listOf(RowAction("إلغاء صلاحية المشرف","DELETE","api/admin/admin-users/$id"))
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
    return listOf("status", "phone", "clientPhone", "area", "region", "createdAt", "specialties", "message")
        .mapNotNull { k -> item.asJsonObject.get(k)?.takeIf { !it.isJsonNull }?.let { "$k: $it" } }.take(4).joinToString("  •  ")
}
