package com.sonaa.con

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.graphics.Color
import android.view.Gravity
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.content.Context
import android.content.ClipboardManager
import android.content.ClipData
import android.widget.*
import android.media.MediaPlayer
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val api = "https://sonaa-backend-v2.vercel.app/api"
    private val executor = Executors.newSingleThreadExecutor()
    private val navy = Color.rgb(20, 55, 94)
    private val teal = Color.rgb(20, 153, 164)
    private val bg = Color.rgb(244, 248, 252)
    private val white = Color.WHITE
    private var token = ""
    private var profile = JSONObject()
    private var active = "dashboard"
    private var allRows = JSONArray()
    private var contentData = JSONObject()
    private val selectedRows = linkedMapOf<String,JSONObject>()
    private var voicePlayer:MediaPlayer?=null
    private val playedVoice=mutableSetOf<String>()
    private lateinit var root: LinearLayout
    private lateinit var body: LinearLayout
    private lateinit var status: TextView
    private lateinit var searchBox: EditText

    data class Section(val id:String,val label:String,val path:String,val listKeys:List<String> = listOf("data","items","results"))
    private val sections = listOf(
        Section("dashboard","الرئيسية","/admin/counts"),
        Section("stats","الإحصائيات","/admin/reports"),
        Section("reports","التقارير","/admin/reports"),
        Section("orders","الطلبات","/admin/orders?limit=500",listOf("orders","data","items")),
        Section("fannis","الفنيون","/admin/fannis?limit=500",listOf("fannis","data","items")),
        Section("pending","انتظار الاعتماد","/admin/fannis?limit=500",listOf("fannis","data","items")),
        Section("disabled","الفنيون الموقوفون","/admin/fannis?limit=500",listOf("fannis","data","items")),
        Section("offers","عروض الفنيين","/admin/orders?limit=500",listOf("orders","data","items")),
        Section("wallets","محافظ الفنيين","/admin/fannis?limit=500",listOf("fannis","data","items")),
        Section("levels","المستويات والشارات","/admin/fannis?limit=500",listOf("fannis","data","items")),
        Section("profileEdits","تعديل البيانات","/admin/fanni-profile-edits",listOf("requests","edits","data","items")),
        Section("clients","العملاء","/admin/clients?limit=500",listOf("clients","data","items")),
        Section("regions","المناطق","/admin/regions",listOf("regions","items","data")),
        Section("services","الخدمات والمهن","/admin/services",listOf("services","data","items")),
        Section("topups","شحن المحافظ","/admin/topup-requests",listOf("requests","data","items")),
        Section("complaints","الشكاوى","/admin/complaints?limit=500",listOf("complaints","data","items")),
        Section("support","الدعم والمخالفات","/admin/support/violations",listOf("violations","items","data")),
        Section("recovery","استعادة الحساب","/password-recovery/admin/requests",listOf("requests","data","items")),
        Section("notifications","الإشعارات","/admin/notifications/direct",listOf("notifications","items","data")),
        Section("content","الإعلانات والأسئلة","/admin/content"),
        Section("pricing","الأسعار والعمولات","/admin/pricing"),
        Section("settings","إعدادات المنصة","/admin/settings"),
        Section("pageVisits","زيارات الموقع","/admin/page-visits",listOf("recent","summary","visits","items","data")),
        Section("security","سجل التدقيق","/admin/audit-logs",listOf("logs","items","data")),
        Section("roles","صلاحيات المشرفين","/admin/admin-users",listOf("users","data","items"))
    )
    private fun canRead(id:String):Boolean {
        if(profile.optString("adminRoleLabel")=="أدمن رئيسي") return true
        val key=when(id) {
            "dashboard","stats","reports","pageVisits"->"dashboard"
            "fannis","profileEdits","pending","disabled","levels"->"fannis"
            "orders"->"orders"; "clients"->"clients"; "regions"->"regions"; "services"->"services"
            "topups"->"topups"; "complaints"->"complaints"; "support","recovery"->"support"
            "notifications"->"notifications"; "content"->"content"; "pricing"->"pricing"; "settings"->"settings"; "wallets"->"wallet"; "offers"->"offers"
            else->return false
        }
        val perms=profile.optJSONObject("adminPermissions") ?: return profile.optString("adminRole")=="مدير"
        val p=perms.optJSONObject(key) ?: return profile.optString("adminRole")=="مدير"
        return p.optBoolean("read") || p.optBoolean("write")
    }
    private fun canWrite(id:String):Boolean {
        if(profile.optString("adminRoleLabel")=="أدمن رئيسي") return true
        val key=when(id) {
            "dashboard","stats","pageVisits"->"dashboard"; "fannis","profileEdits","pending","disabled","levels"->"fannis"; "orders"->"orders"
            "clients"->"clients"; "regions"->"regions"; "services"->"services"; "topups"->"topups"
            "complaints"->"complaints"; "support","recovery"->"support"; "notifications"->"notifications"
            "content"->"content"; "pricing"->"pricing"; "settings"->"settings"; "wallets"->"wallet"; "offers"->"offers"; else->return false
        }
        val perms=profile.optJSONObject("adminPermissions") ?: return profile.optString("adminRole")=="مدير"
        return perms.optJSONObject(key)?.optBoolean("write") == true
    }

    override fun onCreate(savedInstanceState:Bundle?) {
        super.onCreate(savedInstanceState)
        token=getPreferences(0).getString("token","") ?: ""
        if(token.isNotBlank()) loadProfile() else showLogin()
    }
    private fun column():LinearLayout=LinearLayout(this).apply {
        orientation=LinearLayout.VERTICAL; layoutDirection=View.LAYOUT_DIRECTION_RTL
        setPadding(16,18,16,20); setBackgroundColor(bg)
    }
    private fun text(value:String,size:Float=14f,bold:Boolean=false,color:Int=navy):TextView=TextView(this).apply {
        text=value; textSize=size; setTextColor(color); gravity=Gravity.RIGHT
        if(bold)setTypeface(null,android.graphics.Typeface.BOLD)
        setPadding(2,7,2,7)
    }
    private fun button(label:String,action:()->Unit):Button=Button(this).apply {
        text=label; setTextColor(white); setBackgroundColor(navy); textSize=12f
        setOnClickListener { action() }
    }
    private fun input(hint:String, value:String="", multiline:Boolean=false):EditText=EditText(this).apply {
        this.hint=hint; setText(value); textSize=14f; gravity=Gravity.RIGHT
        setTextColor(navy); setHintTextColor(Color.GRAY); setPadding(14,10,14,10)
        if(multiline){minLines=3; maxLines=6; inputType=android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE}
        else {setSingleLine(true); inputType=android.text.InputType.TYPE_CLASS_TEXT}
        backgroundTintList=android.content.res.ColorStateList.valueOf(teal)
    }
    private fun showLogin(message:String="") {
        val page=column()
        page.gravity=Gravity.CENTER_VERTICAL
        page.addView(text("صُنّاع CON",30f,true))
        page.addView(text("تطبيق إدارة المنصة الأصلي",15f,false,teal))
        page.addView(text("تسجيل الدخول",21f,true))
        val phone=input("رقم هاتف حساب الإدارة")
        val pass=input("كلمة المرور")
        pass.inputType=android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
        page.addView(phone); page.addView(pass)
        if(message.isNotBlank())page.addView(text(message,13f,true,Color.RED))
        page.addView(button("دخول لوحة الإدارة") {
            if(phone.text.isBlank()||pass.text.isBlank()){showLogin("اكتب رقم الهاتف وكلمة المرور");return@button}
            request("/admin/con-login","POST",null,JSONObject().put("phone",phone.text.toString().trim()).put("password",pass.text.toString())) { data,err ->
                val t=data?.optString("token","") ?: ""
                if(err!=null)showLogin(err) else if(t.isBlank())showLogin("بيانات الدخول غير مكتملة") else {
                    token=t;getPreferences(0).edit().putString("token",token).apply();loadProfile()
                }
            }
        })
        setContentView(ScrollView(this).apply{addView(page)})
    }
    private fun loadProfile() {
        request("/admin/me","GET",token,null){data,err->
            if(err!=null||data==null){token="";getPreferences(0).edit().remove("token").apply();showLogin(err ?: "انتهت الجلسة");return@request}
            profile=data;showDashboard()
        }
    }
    private fun showDashboard() {
        root=column()
        val header=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL}
        val brand=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;layoutParams=LinearLayout.LayoutParams(0,-2,1f)}
        brand.addView(text("صُنّاع CON",23f,true));brand.addView(text("أهلًا ${profile.optString("name","بالإدارة")} • ${profile.optString("adminRoleLabel",profile.optString("adminRole",""))}",12f,false,teal))
        header.addView(brand);header.addView(button("خروج"){logout()});root.addView(header)
        val nav=HorizontalScrollView(this).apply{isHorizontalScrollBarEnabled=false}
        val tabs=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL}
        sections.filter{canRead(it.id)}.forEach{section->tabs.addView(button(section.label){active=section.id;selectedRows.clear();loadSection()})}
        nav.addView(tabs);root.addView(nav)
        root.addView(View(this).apply{setBackgroundColor(teal);layoutParams=LinearLayout.LayoutParams(-1,2)})
        status=text("اختر قسمًا من القائمة",13f,true,teal);root.addView(status)
        searchBox=input("بحث في البيانات")
        searchBox.addTextChangedListener(object:android.text.TextWatcher{
            override fun beforeTextChanged(s:CharSequence?,start:Int,count:Int,after:Int){}
            override fun onTextChanged(s:CharSequence?,start:Int,before:Int,count:Int){renderRows()}
            override fun afterTextChanged(s:android.text.Editable?){}
        })
        root.addView(searchBox)
        val controls=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL}
        controls.addView(button("تحديث"){loadSection()})
        controls.addView(button("إجراءات المحدد"){showBulkActions()})
        controls.addView(button("بحث الدعم"){if(active!="support"){showMessage("افتح قسم الدعم أولًا");return@button};val q=searchBox.text.toString().trim();if(q.length<2)showMessage("اكتب كود الطلب أو رقم هاتف للبحث")else request("/admin/support/search?q=${enc(q)}","GET",token,null){d,e->if(e!=null)showMessage(e)else{allRows=extractArray(d?:JSONObject(),listOf("results","orders","complaints","items","data"));renderRows()}}})
        controls.addView(button("إضافة عنصر"){createForActive()})
        root.addView(controls)
        body=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL}
        root.addView(body)
        setContentView(ScrollView(this).apply{addView(root)})
        loadSection()
    }
    private fun loadSection() {
        val section=sections.firstOrNull{it.id==active} ?: sections[0]
        status.text="جاري تحميل ${section.label}..."
        if(section.id=="stats") {
            request("/admin/counts","GET",token,null){counts,err->
                if(err!=null){status.text=err;return@request}
                request("/admin/orders?limit=500","GET",token,null){orders,orderErr->
                    if(orderErr!=null){status.text=orderErr;return@request}
                    request("/admin/topup-requests","GET",token,null){topups,topupErr->
                        if(topupErr!=null){status.text=topupErr;return@request}
                        showAdminStats(counts?:JSONObject(),extractArray(orders?:JSONObject(),listOf("orders","data","items")),extractArray(topups?:JSONObject(),listOf("requests","data","items")))
                    }
                }
            }
            return
        }
        if(section.id=="reports") {
            request("/admin/reports","POST",token,JSONObject()){d,e->if(e!=null)status.text=e else showReport(d?:JSONObject())}
            return
        }
        if(section.id=="wallets") {
            request("/admin/fannis?limit=500","GET",token,null){d,e->if(e!=null)status.text=e else showWalletDirectory(extractArray(d?:JSONObject(),listOf("fannis","data","items")))}
            return
        }
        if(section.id=="pageVisits") {
            request("/admin/page-visits","GET",token,null){d,e->if(e!=null)status.text=e else showPageVisits(d?:JSONObject())}
            return
        }
        if(section.id=="content") {
            request(section.path,"GET",token,null){d,e->if(e!=null)status.text=e else{contentData=d?.optJSONObject("content")?:JSONObject();showContent()}}
            return
        }
        if(section.id=="services") {
            request(section.path,"GET",token,null){d,e->if(e!=null)status.text=e else showServicesNative(extractArray(d?:JSONObject(),listOf("categories","data","items")))}
            return
        }
        if(section.id=="pricing"||section.id=="settings") {
            request(section.path,"GET",token,null){d,e->if(e!=null)status.text=e else showObjectSettings(section.id,d?:JSONObject())}
            return
        }
        request(section.path,"GET",token,null){data,err->
            if(err!=null){status.text=err;body.removeAllViews();return@request}
            val sectionNow=sections.first{it.id==active}
            if(sectionNow.id=="dashboard"||sectionNow.id=="stats"){showMetrics(data?:JSONObject());return@request}
            allRows=extractArray(data?:JSONObject(),sectionNow.listKeys)
            status.text="${sectionNow.label} • ${allRows.length()} سجل"
            renderRows()
        }
    }
    private fun extractArray(data:JSONObject,keys:List<String>):JSONArray {
        for(k in keys){val a=data.optJSONArray(k);if(a!=null)return a}
        val nested=data.optJSONObject("data")
        if(nested!=null)for(k in keys){val a=nested.optJSONArray(k);if(a!=null)return a}
        return JSONArray()
    }
    private fun showReport(data:JSONObject) {
        body.removeAllViews()
        val start=input("من تاريخ YYYY-MM-DD")
        val end=input("إلى تاريخ YYYY-MM-DD")
        val service=input("تصفية باسم الخدمة (اختياري)")
        val area=input("تصفية بالمنطقة (اختياري)")
        body.addView(start);body.addView(end);body.addView(service);body.addView(area)
        body.addView(button("إنشاء التقرير"){request("/admin/reports","POST",token,JSONObject().put("startDate",start.text.toString()).put("endDate",end.text.toString()).put("service",service.text.toString()).put("area",area.text.toString())){d,e->if(e!=null)showMessage(e)else showReport(d?:JSONObject())}})
        val summary=data.optJSONObject("summary")?:JSONObject()
        val labels=listOf("إجمالي الطلبات" to "totalOrders","طلبات مكتملة" to "completedOrders","طلبات ملغاة" to "cancelledOrders","قيد المراجعة" to "pendingOrders","طلبات منشورة" to "publishedOrders","الفنيون المعتمدون" to "approvedTechnicians","العملاء النشطون" to "activeClients")
        labels.forEach{(label,key)->body.addView(text("$label: ${summary.optString(key, "—")}",17f,true))}
        val top=data.optJSONArray("topServices")?:JSONArray()
        body.addView(text("أكثر الخدمات طلبًا",16f,true))
        for(i in 0 until top.length()){val item=top.optJSONObject(i)?:continue;body.addView(text("${item.optString("service")} — ${item.optString("count")}",13f))}
        status.text=data.optString("message","تقرير المنصة")
    }

    private fun showAdminStats(countsData:JSONObject,orders:JSONArray,topups:JSONArray) {
        body.removeAllViews()
        val counts=countsData.optJSONObject("counts")?:countsData
        body.addView(text("إحصائيات المنصة",20f,true))
        listOf("technicians" to "إجمالي الفنيين","verifiedTechnicians" to "الفنيون المعتمدون","clients" to "العملاء المسجلون").forEach{(key,label)->
            body.addView(text(label+" : "+counts.optInt(key,0),18f,true))
        }
        body.addView(text("إجمالي الطلبات المحمّلة: "+orders.length(),18f,true))
        val statuses=linkedMapOf<String,Int>()
        for(i in 0 until orders.length()){
            val item=orders.optJSONObject(i)?:continue
            val statusValue=item.optString("status","غير محدد")
            statuses[statusValue]=(statuses[statusValue]?:0)+1
        }
        body.addView(text("حالة الطلبات",16f,true))
        statuses.forEach{(label,count)->body.addView(text(label+" : "+count,14f,true))}
        var approvedCount=0
        var approvedAmount=0.0
        for(i in 0 until topups.length()){
            val item=topups.optJSONObject(i)?:continue
            if(item.optString("status")=="مقبول"||item.optString("status")=="approved"){
                approvedCount++
                approvedAmount+=item.optDouble("amount",0.0)
            }
        }
        body.addView(text("طلبات شحن المحافظ: "+topups.length(),16f,true))
        body.addView(text("عمليات الشحن المقبولة: "+approvedCount+" • الإجمالي: "+approvedAmount+" جنيه",14f,true))
    }

    private fun showMetrics(data:JSONObject) {
        body.removeAllViews()
        val c=data.optJSONObject("counts")?:data
        val labels=mapOf("technicians" to "إجمالي الفنيين","verifiedTechnicians" to "الفنيون المعتمدون","clients" to "العملاء","orders" to "الطلبات","pendingOrders" to "الطلبات المعلقة","completedOrders" to "الطلبات المكتملة","cancelledOrders" to "الطلبات الملغاة","pendingFannis" to "فنيون بانتظار الاعتماد","topups" to "طلبات شحن المحافظ","complaints" to "الشكاوى")
        c.keys().forEach{k->body.addView(text((labels[k]?:k)+" : "+c.opt(k),17f,true))}
        status.text="مؤشرات المنصة"
    }
    private fun renderRows() {
        if(!::body.isInitialized)return
        body.removeAllViews()
        val q=if(::searchBox.isInitialized)searchBox.text.toString().trim().lowercase() else ""
        for(i in 0 until allRows.length()){
            val item=allRows.optJSONObject(i)?:continue
            val raw=item.toString()
            if(active=="pending"&&(item.optBoolean("isApproved")||item.optBoolean("isDisabled")))continue
            if(active=="disabled"&&!item.optBoolean("isDisabled"))continue
            if(active=="offers"&&(item.optJSONArray("offers")?.length()?:0)==0)continue
            if(q.isNotBlank()&&!raw.lowercase().contains(q))continue
            val card=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(12,8,12,10);setBackgroundColor(white)}
            val name=item.optString("name",item.optString("title",item.optString("sn",item.optString("action","سجل ${i+1}"))))
            card.addView(text(name,16f,true))
            val rowKey=item.optString("_id",item.optString("id",item.optString("sn",i.toString())))
            val selector=CheckBox(this).apply{text="تحديد";isChecked=selectedRows.containsKey("$active:$rowKey")}
            selector.setOnCheckedChangeListener{_,checked->val key="$active:$rowKey";if(checked)selectedRows[key]=item else selectedRows.remove(key)}
            card.addView(selector)
            val skip=setOf("_id","id","__v","passwordHash","voiceRecordingData","token")
            val keys=item.keys()
            var count=0
            while(keys.hasNext()&&count<10){
                val k=keys.next();if(skip.contains(k))continue
                val v=item.opt(k);if(v==null||v==JSONObject.NULL)continue
                val value=when(v){is JSONObject->v.toString();is JSONArray->v.toString();else->v.toString()}
                if(value.isBlank()||value=="{}"||value=="[]")continue
                card.addView(text("$k: ${value.take(240)}",11f,false,Color.DKGRAY));count++
            }
            val actions=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL}
            actionLabels(active,item).forEach{pair->actions.addView(button(pair.first){performAction(pair.second,item)})}
            if(actions.childCount>0)card.addView(actions)
            if(active=="orders" && item.optBoolean("hasVoiceRecording")) {
                val sn=item.optString("sn")
                card.addView(text(if(item.optString("voiceReviewedAt").isNotBlank())"تمت مراجعة التسجيل الصوتي" else "تسجيل صوتي — يجب الاستماع كاملًا قبل النشر",12f,true,teal))
                card.addView(button("▶ استماع للتسجيل الصوتي"){playOrderVoice(sn)})
                if(playedVoice.contains(sn) && item.optString("voiceReviewedAt").isBlank()) {
                    card.addView(button("تأكيد الاستماع ومراجعة التسجيل"){markVoiceReviewed(sn)})
                }
            }
            card.addView(View(this).apply{setBackgroundColor(Color.LTGRAY);layoutParams=LinearLayout.LayoutParams(-1,1)})
            body.addView(card,LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=10})
        }
    }
    private fun actionLabels(section:String,item:JSONObject):List<Pair<String,String>> {
        if(!canWrite(section))return emptyList()
        val id=item.optString("_id",item.optString("id"))
        return when(section){
            "fannis","pending","disabled","levels"->buildList{
                if(!item.optBoolean("isApproved")){add("اعتماد" to "approve");add("رفض" to "reject")}
                if(item.optBoolean("isDisabled"))add("إعادة تفعيل" to "enable") else add("تعطيل" to "disable")
                add("تعديل الملف" to "profile");add("تغيير كلمة السر" to "password")
                add("إضافة رصيد" to "addBalance");add("تسوية الرصيد" to "setBalance")
                add("تجميد المحفظة" to "freeze");add("المستوى المهني" to "level");add("شارة موثوق" to "badge");add("ملاحظة داخلية" to "fanniNote");add("حد العروض" to "limit");add("ضوابط الحساب" to "controls");add("حذف الفني" to "delete")
            }
            "orders"->buildList{val sn=item.optString("sn");if(item.optString("status")=="قيد المراجعة")add("نشر" to "publish");add("إلغاء" to "cancel");add("أرشفة" to "archive");add("تصحيح" to "correct");if(sn.isNotBlank()){add("العروض" to "offers");if(profile.optString("adminRoleLabel")=="أدمن رئيسي")add("تعيين فني" to "assign");add("حذف الطلب" to "deleteOrder")}}
            "topups"->listOf("قبول الشحن" to "approveTopup","رفض الشحن" to "rejectTopup")
            "complaints"->listOf("تحديث الشكوى" to "complaint")
            "clients"->listOf((if(item.optString("status")=="معلق")"إلغاء الحظر" else "حظر العميل") to (if(item.optString("status")=="معلق")"unblock" else "block"),"ملاحظة" to "note","تغيير كلمة السر" to "clientPassword","تعديل البيانات" to "clientProfile","حذف الحساب" to "deleteClient")
            "regions"->listOf("تعديل الاسم" to "editRegion","إظهار/إخفاء" to "toggle","استعادة" to "restoreRegion","حذف" to "deleteRegion")
            "services"->listOf("تعديل الخدمة" to "editService","إخفاء" to "hideService","إظهار" to "showService","حذف" to "deleteService")
            "profileEdits"->listOf("اعتماد التعديل" to "approveEdit","رفض التعديل" to "rejectEdit")
            "support"->listOf("تمت المراجعة" to "review")
            "wallets"->listOf("إضافة رصيد" to "addBalance","تسوية الرصيد" to "setBalance","تجميد المحفظة" to "freeze","حركات المحفظة" to "transactions")
            "offers"->listOf("مراجعة العروض" to "offers")
            "roles"->listOf("تغيير المنصب" to "role","تخصيص الصلاحيات" to "permissions","سحب الصلاحية" to "revoke")
            "recovery"->listOf("إرسال رد" to "recoveryReply","إصدار كود" to "recoveryCode","رفض الطلب" to "recoveryReject")
            "notifications"->listOf("حذف الإشعار" to "deleteNotification")
            else->emptyList()
        }
    }
    private fun performAction(action:String,item:JSONObject) {
        val id=item.optString("_id",item.optString("id"))
        val sn=item.optString("sn")
        when(action){
            "approve"->mutate("/admin/fannis/$id/approve","POST",JSONObject())
            "approveEdit"->mutate("/admin/fanni-profile-edits/$id/approve","POST",JSONObject())
            "rejectEdit"->ask("سبب رفض التعديل","reason"){mutate("/admin/fanni-profile-edits/$id/reject","POST",JSONObject().put("reason",it))}
            "reject"->ask("سبب رفض الفني","reason"){mutate("/admin/fannis/$id/reject","POST",JSONObject().put("reason",it))}
            "disable"->ask("سبب تعطيل الفني","reason"){mutate("/admin/fannis/$id/disable","POST",JSONObject().put("reason",it))}
            "enable"->mutate("/admin/fannis/$id/enable","POST",JSONObject())
            "delete"->confirm("تأكيد حذف الفني؟"){mutate("/admin/fannis/$id","DELETE",null)}
            "deleteRegion"->confirm("حذف المنطقة من الاختيارات؟"){mutate("/admin/regions/$id","DELETE",null)}
            "editRegion"->ask("اسم المنطقة الجديد","name"){mutate("/admin/regions/$id","PATCH",JSONObject().put("name",it))}
            "restoreRegion"->mutate("/admin/regions/$id","PATCH",JSONObject().put("isDeleted",false).put("isActive",true))
            "deleteService"->confirm("حذف الخدمة؟"){mutate("/admin/services/$id","DELETE",null)}
            "editService"->ask("اسم الخدمة الجديد","name"){mutate("/admin/services/${enc(item.optString("name"))}","PATCH",JSONObject().put("name",it))}
            "hideService","showService"->mutate("/admin/services/${enc(item.optString("name"))}/${if(action=="hideService")"hide" else "show"}","POST",JSONObject())
            "unblock"->mutate("/admin/clients/${enc(item.optString("phone"))}/unblock","POST",JSONObject())
            "password"->form("تغيير كلمة السر",listOf("كلمة السر الجديدة","تأكيد كلمة السر")){v->mutate("/admin/fannis/$id/password","PATCH",JSONObject().put("newPassword",v[0]).put("confirmPassword",v[1]))}
            "profile"->form("تعديل بيانات الفني",listOf("رقم الهاتف","التخصصات مفصولة بفاصلة","المناطق مفصولة بفاصلة")){v->mutate("/admin/fannis/$id/profile","PATCH",JSONObject().put("phone",v[0]).put("specialties",JSONArray(v[1].split(",").map{it.trim()}.filter{it.isNotBlank()})).put("areas",JSONArray(v[2].split(",").map{it.trim()}.filter{it.isNotBlank()})))}
            "addBalance","setBalance"->form("قيمة المحفظة",listOf("المبلغ","السبب")){v->mutate("/admin/fannis/$id/${if(action=="addBalance")"add-balance" else "set-balance"}","POST",JSONObject().put("amount",v[0].toDoubleOrNull()?:0).put("reason",v[1]))}
            "freeze"->ask("سبب التجميد (اكتب unfreeze لإلغاء التجميد)","reason"){v->mutate("/admin/wallet/freeze/$id","POST",JSONObject().put("action",if(v=="unfreeze")"unfreeze" else "freeze").put("reason",v))}
            "level"->ask("المستوى المهني","level"){mutate("/admin/fannis/$id/level","PATCH",JSONObject().put("level",it))}
            "badge"->form("إدارة شارة الفني",listOf("الشارة (trusted / top_rated / verified / fast_response / premium / gold)","الإجراء (add / remove / toggle)")){v->mutate("/admin/fannis/$id/badge","PATCH",JSONObject().put("badge",v[0]).put("action",v[1]))}
            "fanniNote"->ask("الملاحظة الداخلية","note"){mutate("/admin/fannis/$id/note","PATCH",JSONObject().put("note",it))}
            "limit"->ask("الحد الأقصى للعروض (maxOffers)","maxOffers"){mutate("/admin/fannis/$id/limit","PATCH",JSONObject().put("maxOffers",it.toIntOrNull()?:0))}
            "controls"->form("ضوابط الثقة والظهور",listOf("درجة الثقة 0-100","موثق؟ true / false","مميز؟ true / false","تاريخ انتهاء التمييز YYYY-MM-DD أو اتركه فارغًا")){v->mutate("/admin/fannis/$id/profile-controls","PATCH",JSONObject().put("trustScore",v[0].toIntOrNull()?:0).put("isVerified",v[1].toBoolean()).put("isFeatured",v[2].toBoolean()).put("featuredUntil",if(v[3].isBlank())JSONObject.NULL else v[3]))}
            "transactions"->request("/admin/wallet/transactions/$id","GET",token,null){d,e->showMessage(if(e!=null)e else d.toString())}
            "recoveryReply"->ask("اكتب الرد","message"){mutate("/password-recovery/admin/requests/$id/reply","POST",JSONObject().put("message",it))}
            "recoveryCode"->ask("ملاحظة أو سبب إصدار الكود","reason"){mutate("/password-recovery/admin/requests/$id/issue-code","POST",JSONObject().put("reason",it))}
            "recoveryReject"->ask("سبب رفض الطلب","reason"){mutate("/password-recovery/admin/requests/$id/reject","POST",JSONObject().put("reason",it))}
            "deleteNotification"->confirm("حذف الإشعار؟"){mutate("/admin/notifications/direct/$id","DELETE",null)}
            "publish"->{if(item.optBoolean("hasVoiceRecording")&&item.optString("voiceReviewedAt").isBlank()){showMessage("لازم تسمع التسجيل الصوتي كاملًا وتؤكد مراجعته قبل نشر الطلب");return};confirm("نشر الطلب ${sn} للفنيين؟"){mutate("/orders/admin/$sn/publish","POST",JSONObject())}}
            "cancel","archive"->ask("سبب الإجراء","reason"){mutate("/admin/orders/$sn/$action","POST",JSONObject().put("reason",it))}
            "deleteOrder"->confirm("حذف الطلب نهائيًا؟"){mutate("/admin/orders/$sn","DELETE",null)}
            "correct"->form("تصحيح الطلب",listOf("اسم العميل","رقم الهاتف","الخدمة","المنطقة","العنوان","وصف الطلب","الميزانية")){v->mutate("/admin/orders/$sn/correct","PATCH",JSONObject().put("clientName",v[0]).put("clientPhone",v[1]).put("service",v[2]).put("area",v[3]).put("address",v[4]).put("description",v[5]).put("budget",v[6]))}
            "offers"->request("/admin/orders/$sn/offers","GET",token,null){d,e->if(e!=null)showMessage(e)else showOffers(sn,d?:JSONObject())}
            "assign"->ask("معرّف العرض Offer ID","offerId"){offerId->ask("سبب التعيين الإداري","reason"){reason->mutate("/admin/orders/$sn/assign","POST",JSONObject().put("offerId",offerId).put("reason",reason))}}
            "approveTopup"->confirm("اعتماد طلب الشحن وإضافة المبلغ إلى محفظة الفني؟"){mutate("/admin/topup-requests/$id/approve","POST",JSONObject())}
            "rejectTopup"->ask("سبب رفض طلب الشحن","reason"){reason->mutate("/admin/topup-requests/$id/reject","POST",JSONObject().put("reason",reason))}
            "complaint"->form("تحديث الشكوى",listOf("الحالة (جديدة / قيد المراجعة / تم الحل / مرفوضة)","ملاحظة الإدارة","الرد على العميل")){v->mutate("/admin/complaints/$id","PATCH",JSONObject().put("status",v[0]).put("adminNote",v[1]).put("adminResponse",v[2]))}
            "block"->ask("سبب حظر العميل","reason"){v->mutate("/admin/clients/${enc(item.optString("phone"))}/block","POST",JSONObject().put("reason",v))}
            "note"->ask("الملاحظة الداخلية","note"){v->mutate("/admin/clients/${enc(item.optString("phone"))}/note","POST",JSONObject().put("note",v))}
            "clientPassword"->form("تغيير كلمة سر العميل",listOf("كلمة السر الجديدة","تأكيد كلمة السر")){v->mutate("/admin/clients/${enc(item.optString("phone"))}/password","PATCH",JSONObject().put("newPassword",v[0]).put("confirmPassword",v[1]))}
            "clientProfile"->form("تعديل بيانات العميل",listOf("الاسم","رقم الهاتف")){v->mutate("/admin/client-accounts/$id/profile","PATCH",JSONObject().put("name",v[0]).put("phone",v[1]))}
            "deleteClient"->confirm("حذف حساب العميل نهائيًا؟"){mutate("/admin/clients/${enc(item.optString("phone"))}/account","DELETE",null)}
            "toggle"->if(active=="regions")mutate("/admin/regions/$id","PATCH",JSONObject().put("isActive",!item.optBoolean("isActive",true))) else mutate("/admin/services/${enc(item.optString("name"))}/${if(item.optBoolean("isActive",true))"hide" else "show"}","POST",JSONObject())
            "review"->mutate("/admin/support/$sn/review","POST",JSONObject())
            "role"->ask("المنصب: مدير أو مشرف أول أو مشرف أو قراءة فقط","role"){mutate("/admin/admin-users/$id/role","PATCH",JSONObject().put("role",it))}
            "permissions"->editPermissions(id,item)
            "revoke"->confirm("سحب الصلاحية الإدارية؟"){mutate("/admin/admin-users/$id","DELETE",null)}
        }
    }




    private fun canReviewVoice():Boolean {
        if(profile.optString("adminRoleLabel")=="أدمن رئيسي")return true
        return profile.optJSONObject("adminPermissions")?.optJSONObject("voiceReview")?.optBoolean("write")==true
    }
    private fun playOrderVoice(sn:String) {
        if(!canReviewVoice()){showMessage("لا تملك صلاحية مراجعة التسجيلات الصوتية");return}
        try {
            voicePlayer?.release()
            val player=MediaPlayer()
            voicePlayer=player
            player.setOnPreparedListener{it.start();showMessage("بدأ تشغيل التسجيل. يجب الاستماع حتى النهاية.")}
            player.setOnCompletionListener{playedVoice.add(sn);renderRows();showMessage("انتهى التسجيل. يمكنك الآن تأكيد المراجعة.")}
            player.setOnErrorListener{_,_,_->showMessage("تعذر تشغيل التسجيل الصوتي");true}
            player.setDataSource(this,Uri.parse("$api/orders/$sn/voice"),mapOf("Authorization" to "Bearer $token"))
            player.prepareAsync()
        } catch(e:Exception) { showMessage(e.message ?: "تعذر تحميل التسجيل") }
    }
    private fun markVoiceReviewed(sn:String) {
        if(!canReviewVoice()){showMessage("لا تملك صلاحية مراجعة التسجيلات الصوتية");return}
        if(!playedVoice.contains(sn)){showMessage("شغّل التسجيل حتى نهايته أولًا");return}
        request("/orders/admin/$sn/voice-reviewed","POST",token,JSONObject()){d,e->
            if(e!=null)showMessage(e) else {playedVoice.remove(sn);showMessage(d?.optString("message","تم تأكيد المراجعة")?:"تم تأكيد المراجعة");loadSection()}
        }
    }

    private fun showBulkActions() {
        val rows=selectedRows.filterKeys{it.startsWith("$active:")}.values.toList()
        if(rows.isEmpty()){showMessage("حدد عناصر أولًا");return}
        val actions=when(active){
            "fannis","pending","disabled"->arrayOf("اعتماد المحدد","رفض المحدد","تعطيل المحدد","إعادة تفعيل المحدد","تجميد المحافظ","إلغاء تجميد المحافظ")
            "topups"->arrayOf("قبول الشحنات المحددة","رفض الشحنات المحددة")
            "complaints"->arrayOf("وضع قيد المراجعة","حل الشكاوى المحددة","رفض الشكاوى المحددة")
            "orders"->arrayOf("نشر الطلبات المحددة","حذف الطلبات المحددة")
            "clients"->arrayOf("حذف حسابات العملاء المحددة")
            "regions"->arrayOf("تعديل أسماء المناطق المحددة","إظهار المناطق المحددة","إخفاء المناطق المحددة","استعادة المناطق المحددة","حذف المناطق المحددة")
            "services"->arrayOf("إظهار الخدمات المحددة","إخفاء الخدمات المحددة","حذف الخدمات المحددة")
            else->arrayOf("لا توجد إجراءات جماعية لهذا القسم")
        }
        AlertDialog.Builder(this).setTitle("إجراءات جماعية • ${rows.size} عنصر").setItems(actions){_,which->
            val action=actions[which]
            if(action.startsWith("لا توجد"))return@setItems
            confirm("تأكيد تنفيذ $action على ${rows.size} عنصر؟"){if(action=="تعديل أسماء المناطق المحددة")bulkRenameRegions(rows,0)else runBulkAction(action,rows,0,0)}
        }.setNegativeButton("إلغاء",null).show()
    }

    private fun bulkRenameRegions(rows:List<JSONObject>,index:Int) {
        if(index>=rows.size){selectedRows.clear();showMessage("تم الانتهاء من تعديل أسماء المناطق");loadSection();return}
        val row=rows[index]
        val id=row.optString("_id",row.optString("id"))
        ask("الاسم الجديد للمنطقة: "+row.optString("name"),"اسم المنطقة"){name->
            if(name.length<2){showMessage("اسم المنطقة يجب أن يكون حرفين على الأقل");return@ask}
            request("/admin/regions/$id","PATCH",token,JSONObject().put("name",name)){_,err->
                if(err!=null)showMessage("تعذر تعديل "+row.optString("name")+": "+err)
                bulkRenameRegions(rows,index+1)
            }
        }
    }

    private fun runBulkAction(action:String,rows:List<JSONObject>,index:Int,failed:Int) {
        if(index>=rows.size){selectedRows.clear();showMessage("انتهى التنفيذ. تعذر تنفيذ $failed من ${rows.size}");loadSection();return}
        val row=rows[index]
        val id=row.optString("_id",row.optString("id"))
        val sn=row.optString("sn")
        val phone=row.optString("phone")
        val path:String
        val method:String
        val payload:JSONObject?
        when(active){
            "fannis","pending","disabled"->{
                path=when(action){
                    "اعتماد المحدد"->"/admin/fannis/$id/approve"
                    "رفض المحدد"->"/admin/fannis/$id/reject"
                    "تعطيل المحدد"->"/admin/fannis/$id/disable"
                    "إعادة تفعيل المحدد"->"/admin/fannis/$id/enable"
                    else->"/admin/wallet/freeze/$id"
                }
                method="POST"
                payload=if(action=="تجميد المحافظ"||action=="إلغاء تجميد المحافظ")JSONObject().put("action",if(action=="تجميد المحافظ")"freeze" else "unfreeze").put("reason","إجراء جماعي من تطبيق الإدارة") else JSONObject()
            }
            "topups"->{path="/admin/topup-requests/$id/${if(action=="قبول الشحنات المحددة")"approve" else "reject"}";method="POST";payload=JSONObject()}
            "complaints"->{path="/admin/complaints/$id";method="PATCH";payload=JSONObject().put("status",when(action){"وضع قيد المراجعة"->"قيد المراجعة";"حل الشكاوى المحددة"->"تم الحل";else->"مرفوضة"})}
            "orders"->{path=if(action=="نشر الطلبات المحددة")"/orders/admin/$sn/publish" else "/admin/orders/$sn";method=if(action=="نشر الطلبات المحددة")"POST" else "DELETE";payload=JSONObject()}
            "clients"->{path="/admin/clients/"+enc(phone)+"/account";method="DELETE";payload=null}
            "regions"->{path="/admin/regions/$id";method=if(action=="حذف المناطق المحددة")"DELETE" else "PATCH";payload=when(action){"إظهار المناطق المحددة"->JSONObject().put("isActive",true);"إخفاء المناطق المحددة"->JSONObject().put("isActive",false);"استعادة المناطق المحددة"->JSONObject().put("isDeleted",false).put("isActive",true);else->null}}
            "services"->{path=if(action=="حذف الخدمات المحددة")"/admin/services/$id" else "/admin/services/${enc(row.optString("name"))}/${if(action=="إظهار الخدمات المحددة")"show" else "hide"}";method=if(action=="حذف الخدمات المحددة")"DELETE" else "POST";payload=JSONObject()}
            else->{showMessage("الإجراء غير مدعوم");return}
        }
        request(path,method,token,payload){_,err->runBulkAction(action,rows,index+1,failed+(if(err==null)0 else 1))}
    }

    private fun showOffers(sn:String,data:JSONObject) {
        val offers=data.optJSONArray("offers")?:JSONArray()
        if(offers.length()==0){showMessage("لا توجد عروض على الطلب $sn");return}
        val labels=Array(offers.length()){i->
            val o=offers.optJSONObject(i)?:JSONObject()
            "${o.optString("fanniName","فني")} — ${o.optString("price","—")} جنيه"
        }
        AlertDialog.Builder(this).setTitle("عروض الطلب $sn").setItems(labels){_,which->
            val offer=offers.optJSONObject(which)?:JSONObject()
            val choices=if(profile.optString("adminRoleLabel")=="أدمن رئيسي")arrayOf("إزالة العرض","رفض العرض","تعيين الفني على الطلب") else arrayOf("إزالة العرض","رفض العرض")
            AlertDialog.Builder(this).setTitle(labels[which]).setItems(choices){_,choice->
                when(choices[choice]){
                    "إزالة العرض"->confirm("إزالة العرض؟"){mutate("/admin/offers/$sn/$which","DELETE",null)}
                    "رفض العرض"->ask("سبب رفض العرض","reason"){mutate("/admin/offers/$sn/$which/reject","POST",JSONObject().put("reason",it))}
                    "تعيين الفني على الطلب"->{
                        val offerId=offer.optString("_id",offer.optString("id"))
                        ask("سبب التعيين الإداري (3 أحرف على الأقل)","reason"){reason->
                            if(reason.length<3){showMessage("سبب التعيين مطلوب من 3 أحرف");return@ask}
                            mutate("/admin/orders/$sn/assign","POST",JSONObject().put("offerId",offerId).put("reason",reason))
                        }
                    }
                }
            }.show()
        }.setNegativeButton("إغلاق",null).show()
    }

    private fun editPermissions(id:String,user:JSONObject) {
        val keys=listOf("dashboard","fannis","orders","publishOrders","voiceReview","passwordRecovery","complaints","services","clients","topups","wallet","pricing","settings","content","support","regions","offers","notifications","clientsData")
        val checks=mutableMapOf<String,Pair<CheckBox,CheckBox>>()
        val role=user.optString("adminRole",if(user.optString("role")=="admin")"مشرف" else "")
        val stored=user.optJSONObject("adminPermissions")?:JSONObject()
        val writeDefaults=when(role){
            "مدير"->keys.toSet()
            "مشرف أول"->setOf("fannis","orders","complaints","services","clients","topups","wallet","support","regions","offers","notifications","clientsData")
            "مشرف"->setOf("orders","complaints","support","offers")
            else->emptySet()
        }
        val readDefaults=when(role){
            "مدير","مشرف أول","قراءة فقط"->keys.toSet()
            else->setOf("dashboard","fannis","orders","voiceReview","passwordRecovery","complaints","services","clients","topups","wallet","pricing","content","support","regions","offers","notifications","clientsData")
        }
        val layout=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(12,8,12,8)}
        keys.forEach{k->
            val row=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL}
            row.addView(text(k,12f,true),LinearLayout.LayoutParams(0,-2,1f))
            val override=stored.optJSONObject(k)
            val defaultRead=readDefaults.contains(k)||writeDefaults.contains(k)
            val defaultWrite=writeDefaults.contains(k)
            val readValue=override?.optBoolean("read") ?: defaultRead
            val writeValue=override?.optBoolean("write") ?: defaultWrite
            val read=CheckBox(this).apply{text="قراءة";isChecked=readValue}
            val write=CheckBox(this).apply{text="تنفيذ";isChecked=writeValue}
            row.addView(read);row.addView(write);layout.addView(row);checks[k]=read to write
        }
        AlertDialog.Builder(this).setTitle("تخصيص الصلاحيات").setView(ScrollView(this).apply{addView(layout)})
            .setNegativeButton("إلغاء",null).setPositiveButton("حفظ"){_,_->
                val perms=JSONObject()
                checks.forEach{(k,p)->perms.put(k,JSONObject().put("read",p.first.isChecked||p.second.isChecked).put("write",p.second.isChecked))}
                mutate("/admin/admin-users/$id/permissions","PATCH",JSONObject().put("permissions",perms))
            }.show()
    }

    private fun createForActive() {
        if(!canWrite(active)){showMessage("لا تملك صلاحية الإضافة في هذا القسم");return}
        when(active){
            "regions"->ask("اسم المنطقة","name"){mutate("/admin/regions","POST",JSONObject().put("name",it))}
            "services"->form("إضافة خدمة",listOf("اسم الخدمة","القسم","رمز تعبيري")){v->mutate("/admin/services","POST",JSONObject().put("name",v[0]).put("category",v[1]).put("emoji",v[2]))}
            "notifications"->form("إرسال إشعار",listOf("الدور (fanni أو client)","نوع الإرسال (single أو group)","رقم الهاتف أو الفئة (all / approved / active / disabled)","العنوان","نص الإشعار")){v->mutate("/admin/notifications/direct","POST",JSONObject().put("recipientRole",v[0]).put("recipientMode",v[1]).put("phone",if(v[1]=="single")v[2] else "").put("audience",if(v[1]=="group")v[2] else "all").put("title",v[3]).put("message",v[4]))}
            "roles"->form("إضافة مشرف أو مدير من الفنيين المعتمدين",listOf("معرّف الفني المعتمد","المنصب: مدير / مشرف أول / مشرف / قراءة فقط")){v->mutate("/admin/admin-users","POST",JSONObject().put("fanniId",v[0]).put("role",v[1]))}
            else->showMessage("الإضافة غير متاحة لهذا القسم من هذا العرض.")
        }
    }

    private fun showWalletDirectory(fannis:JSONArray) {
        body.removeAllViews()
        body.addView(text("محافظ الفنيين",19f,true))
        body.addView(text("اختر فنيًا لعرض كشف حسابه وحركات المحفظة. لا يتم تعديل الرصيد دون سبب موثق.",12f,false,Color.DKGRAY))
        val labels=Array(fannis.length()){i->
            val f=fannis.optJSONObject(i)?:JSONObject()
            f.optString("name","فني")+" • "+f.optString("phone","")+" • "+(f.opt("walletBalance")?:f.opt("balance")?:0)+" جنيه"
        }
        if(labels.isEmpty()){body.addView(text("لا يوجد فنّيون لعرض محافظهم",13f));return}
        body.addView(button("اختيار فني وعرض كشف الحساب"){AlertDialog.Builder(this).setTitle("اختر الفني").setItems(labels){_,which->
            val f=fannis.optJSONObject(which)?:return@setItems
            showWalletLedger(f)
        }.setNegativeButton("إلغاء",null).show()})
        for(i in 0 until fannis.length()){
            val f=fannis.optJSONObject(i)?:continue
            val id=f.optString("_id",f.optString("id"))
            val card=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(12,8,12,8);setBackgroundColor(white)}
            card.addView(text(f.optString("name","فني"),15f,true))
            card.addView(text("الهاتف: "+f.optString("phone","—")+" • الرصيد: "+(f.opt("walletBalance")?:f.opt("balance")?:0)+" جنيه",12f))
            card.addView(button("كشف الحساب والحركات"){showWalletLedger(f)})
            card.addView(button(if(f.optBoolean("isFrozen"))"إلغاء تجميد المحفظة" else "تجميد المحفظة"){
                ask("سبب الإجراء المالي","reason"){reason->
                    if(reason.length<2){showMessage("اكتب سببًا واضحًا");return@ask}
                    mutate("/admin/wallet/freeze/"+id,"POST",JSONObject().put("action",if(f.optBoolean("isFrozen"))"unfreeze" else "freeze").put("reason",reason))
                }
            })
            body.addView(card,LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=8})
        }
    }
    private fun showWalletLedger(fanni:JSONObject) {
        val id=fanni.optString("_id",fanni.optString("id"))
        status.text="كشف حساب "+fanni.optString("name","الفني")
        body.removeAllViews()
        body.addView(text("الرصيد الحالي: "+(fanni.opt("walletBalance")?:fanni.opt("balance")?:0)+" جنيه",18f,true))
        body.addView(button("إضافة رصيد"){form("إضافة رصيد للمحفظة",listOf("المبلغ","سبب الإضافة")){v->
            val amount=v[0].toDoubleOrNull()
            if(amount==null||amount<=0){showMessage("أدخل مبلغًا صحيحًا أكبر من صفر");return@form}
            mutate("/admin/fannis/"+id+"/add-balance","POST",JSONObject().put("amount",amount).put("reason",v[1]))
        }})
        body.addView(button("تسوية الرصيد"){form("تسوية رصيد المحفظة",listOf("الرصيد الجديد","سبب التسوية")){v->
            val amount=v[0].toDoubleOrNull()
            if(amount==null||amount<0){showMessage("أدخل رصيدًا صحيحًا غير سالب");return@form}
            mutate("/admin/fannis/"+id+"/set-balance","POST",JSONObject().put("amount",amount).put("reason",v[1]))
        }})
        request("/admin/wallet/transactions/"+id,"GET",token,null){d,e->
            if(e!=null){showMessage(e);return@request}
            val transactions=extractArray(d?:JSONObject(),listOf("transactions","data","items"))
            body.addView(text("سجل الحركات • "+transactions.length()+" حركة",16f,true))
            for(i in 0 until transactions.length()){
                val item=transactions.optJSONObject(i)?:continue
                val card=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(10,6,10,6);setBackgroundColor(white)}
                card.addView(text(item.optString("type",item.optString("action","حركة مالية"))+" • "+(item.opt("amount")?:item.opt("value")?:0)+" جنيه",13f,true))
                card.addView(text("السبب: "+item.optString("reason","—")+" • "+item.optString("createdAt",""),11f,false,Color.DKGRAY))
                body.addView(card)
            }
        }
    }
    private fun showPageVisits(data:JSONObject) {
        body.removeAllViews()
        val summary=data.optJSONArray("summary")?:JSONArray()
        body.addView(text("ملخص زيارات الموقع",18f,true))
        for(i in 0 until summary.length()){
            val item=summary.optJSONObject(i)?:continue
            body.addView(text(item.optString("pageName",item.optString("pageKey","صفحة"))+" • "+item.optInt("visits",0)+" زيارة • آخر زيارة: "+item.optString("lastVisit","—"),13f,true))
        }
        body.addView(text("إجمالي الزيارات: "+data.optInt("total",0),14f,true))
        val recent=extractArray(data,listOf("recent","visits","items","data"))
        body.addView(text("آخر الزيارات • "+recent.length(),16f,true))
        for(i in 0 until recent.length()){
            val item=recent.optJSONObject(i)?:continue
            val card=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(10,7,10,7);setBackgroundColor(white)}
            card.addView(text(item.optString("pageName",item.optString("path","زيارة")),13f,true))
            card.addView(text("المسار: "+item.optString("path","—")+" • المُحيل: "+item.optString("referrer","—")+" • الوقت: "+item.optString("visitedAt","—"),11f,false,Color.DKGRAY))
            body.addView(card,LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=6})
        }
    }
    private fun showServicesNative(categories:JSONArray) {
        body.removeAllViews()
        body.addView(text("إدارة الخدمات والمهن والتخصصات",18f,true))
        body.addView(text("إضافة الخدمات وتعديلها وإخفاؤها وترتيب الأقسام والخدمات أو حذفها من الاختيارات الجديدة.",12f,false,Color.DKGRAY))
        body.addView(button("إضافة خدمة جديدة"){form("إضافة خدمة",listOf("اسم الخدمة","القسم (اختياري)","رمز تعبيري")){v->
            if(v[0].isBlank()){showMessage("اسم الخدمة مطلوب");return@form}
            mutate("/admin/services","POST",JSONObject().put("name",v[0]).put("category",v[1]).put("emoji",v[2].ifBlank{"🔧"}))
        }})
        val categoryNames=Array(categories.length()){i->
            val cat=categories.optJSONObject(i)?:JSONObject()
            cat.optString("label",cat.optString("name","قسم"))
        }
        for(i in 0 until categories.length()){
            val cat=categories.optJSONObject(i)?:continue
            val category=cat.optString("label",cat.optString("name","قسم"))
            val list=cat.optJSONArray("_detailed")?.takeIf{it.length()>0}?:cat.optJSONArray("services")?:JSONArray()
            val card=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(12,9,12,10);setBackgroundColor(white)}
            card.addView(text(cat.optString("emoji","🔧")+"  "+category+" • "+list.length()+" خدمة",16f,true))
            val catActions=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL}
            if(i>0)catActions.addView(button("ترتيب ↑"){val names=categoryNames.toMutableList();val tmp=names[i-1];names[i-1]=names[i];names[i]=tmp;mutate("/admin/services/categories/order","PATCH",JSONObject().put("categories",JSONArray(names)))})
            if(i<categories.length()-1)catActions.addView(button("ترتيب ↓"){val names=categoryNames.toMutableList();val tmp=names[i+1];names[i+1]=names[i];names[i]=tmp;mutate("/admin/services/categories/order","PATCH",JSONObject().put("categories",JSONArray(names)))})
            card.addView(catActions)
            for(j in 0 until list.length()){
                val raw=list.opt(j)
                val item=if(raw is JSONObject)raw else JSONObject().put("name",raw.toString())
                val name=item.optString("name",raw.toString())
                val key=item.optString("dbId",name)
                val activeFlag=item.optBoolean("isActive",true)
                val row=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(8,7,8,7)}
                row.addView(text(name+(if(activeFlag)" • ظاهرة" else " • مخفية"),13f,true))
                val actions=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL}
                actions.addView(button("تعديل"){ask("اسم الخدمة الجديد",name){newName->
                    mutate("/admin/services/"+enc(key)+"?category="+enc(category),"PATCH",JSONObject().put("name",newName).put("category",category))
                }})
                actions.addView(button(if(activeFlag)"إخفاء" else "إظهار"){mutate("/admin/services/"+enc(key)+"/"+(if(activeFlag)"hide" else "show")+"?category="+enc(category),"POST",JSONObject().put("category",category))})
                actions.addView(button("حذف"){confirm("حذف الخدمة "+name+" من قسم "+category+"؟"){mutate("/admin/services/"+enc(key)+"?category="+enc(category),"DELETE",null)}})
                if(j>0)actions.addView(button("↑"){moveNativeService(list,category,j,-1)})
                if(j<list.length()-1)actions.addView(button("↓"){moveNativeService(list,category,j,1)})
                row.addView(actions);card.addView(row)
            }
            body.addView(card,LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=10})
        }
    }
    private fun moveNativeService(list:JSONArray,category:String,index:Int,direction:Int) {
        val items=mutableListOf<JSONObject>()
        for(i in 0 until list.length()){
            val raw=list.opt(i)
            items.add(if(raw is JSONObject)JSONObject(raw.toString()) else JSONObject().put("name",raw.toString()))
        }
        val next=index+direction
        if(index !in items.indices||next !in items.indices)return
        val tmp=items[index];items[index]=items[next];items[next]=tmp
        val payload=JSONArray()
        items.forEachIndexed{idx,item->payload.put(JSONObject().put("name",item.optString("name")).put("sortOrder",(idx+1)*10).put("emoji",item.optString("emoji","🔧")).put("isActive",item.optBoolean("isActive",true)))}
        mutate("/admin/services/order","PATCH",JSONObject().put("category",category).put("items",payload))
    }

    private fun showContent() {
        body.removeAllViews()
        val announcement=input("نص الإعلان",contentData.optString("announcement"),true);body.addView(text("إعلان الواجهة",16f,true));body.addView(announcement)
        body.addView(button("حفظ الإعلان"){mutate("/admin/content/announcement","PATCH",JSONObject().put("announcement",announcement.text.toString()))})
        val faqs=contentData.optJSONArray("faqs")?:JSONArray()
        body.addView(text("الأسئلة الشائعة: ${faqs.length()}",16f,true))
        for(i in 0 until faqs.length()){val f=faqs.optJSONObject(i)?:continue;body.addView(text("${i+1}) ${f.optString("question")}\n${f.optString("answer")}",12f));body.addView(button("حذف السؤال"){mutate("/admin/content/faqs/$i","DELETE",null)})}
        body.addView(button("إضافة سؤال شائع"){form("إضافة سؤال",listOf("السؤال","الإجابة")){v->val next=JSONArray();for(j in 0 until faqs.length())next.put(faqs.opt(j));next.put(JSONObject().put("question",v[0]).put("answer",v[1]).put("active",true));mutate("/admin/content","PUT",JSONObject().put("announcement",announcement.text.toString()).put("faqs",next))}})
    }
    private fun showObjectSettings(section:String,data:JSONObject) {
        body.removeAllViews()
        val obj=data.optJSONObject(if(section=="pricing")"pricing" else "settings")?:data
        val fields=if(section=="settings")listOf("siteName","maintenance","maintenanceMessage","maxFanniSignupAttempts","walletPhone1","walletPhone2") else obj.keys().asSequence().toList()
        val edits=mutableMapOf<String,EditText>()
        fields.forEach{k->val v=obj.opt(k);body.addView(text(k,12f,true));val e=input(k,if(v is JSONObject||v is JSONArray) v.toString() else v?.toString()?: "");edits[k]=e;body.addView(e)}
        body.addView(button("حفظ التعديلات"){val out=JSONObject();edits.forEach{(k,e)->val old=obj.opt(k);val value=e.text.toString();out.put(k,when(old){is Boolean->value.equals("true",true);is Int->value.toIntOrNull()?:0;is Double->value.toDoubleOrNull()?:0.0;else->value})};mutate(if(section=="settings")"/admin/settings" else "/admin/pricing",if(section=="settings")"PUT" else "PUT",out)})
    }
    private fun mutate(path:String,method:String,bodyData:JSONObject?) {
        if(!canWrite(active)&&active!="dashboard"){showMessage("لا تملك صلاحية التنفيذ في هذا القسم");return}
        request(path,method,token,bodyData){d,e->if(e!=null)showMessage(e)else{showMessage(d?.optString("message","تم تنفيذ العملية بنجاح")?:"تم");loadSection()}}
    }
    private fun form(title:String,labels:List<String>,done:(List<String>)->Unit) {
        val fields=labels.map{input(it)}
        val layout=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(18,8,18,8);fields.forEach{addView(it)}}
        AlertDialog.Builder(this).setTitle(title).setView(ScrollView(this).apply{addView(layout)}).setNegativeButton("إلغاء",null).setPositiveButton("حفظ"){_,_->done(fields.map{it.text.toString().trim()})}.show()
    }
    private fun ask(title:String,hint:String,done:(String)->Unit){val e=input(hint);AlertDialog.Builder(this).setTitle(title).setView(e).setNegativeButton("إلغاء",null).setPositiveButton("تأكيد"){_,_->done(e.text.toString().trim())}.show()}
    private fun confirm(message:String,done:()->Unit){AlertDialog.Builder(this).setMessage(message).setNegativeButton("إلغاء",null).setPositiveButton("تأكيد"){_,_->done()}.show()}
    private fun showMessage(message:String){runOnUiThread{AlertDialog.Builder(this).setMessage(message).setPositiveButton("حسنًا",null).show()}}
    private fun logout(){token="";getPreferences(0).edit().remove("token").apply();showLogin()}
    private fun enc(s:String)=URLEncoder.encode(s,"UTF-8")
    private fun request(path:String,method:String,auth:String?,bodyData:JSONObject?,done:(JSONObject?,String?)->Unit) {
        executor.execute {
            var result:JSONObject?=null;var error:String?=null
            try {
                val conn=URL(api+path).openConnection() as HttpURLConnection
                conn.requestMethod=method;conn.connectTimeout=25000;conn.readTimeout=25000
                conn.setRequestProperty("Accept","application/json");conn.setRequestProperty("Content-Type","application/json")
                if(!auth.isNullOrBlank())conn.setRequestProperty("Authorization","Bearer $auth")
                if(bodyData!=null){conn.doOutput=true;conn.outputStream.use{it.write(bodyData.toString().toByteArray(Charsets.UTF_8))}}
                val code=conn.responseCode;val stream=if(code in 200..299)conn.inputStream else conn.errorStream
                val raw=stream?.bufferedReader()?.use{it.readText()}?:"{}"
                val json=JSONObject(raw.ifBlank{"{}"})
                if(code !in 200..299)error=json.optString("message",json.optString("error","HTTP $code")) else result=json
                conn.disconnect()
            }catch(e:Exception){error=e.message?:"تعذر الاتصال بالخادم"}
            runOnUiThread{done(result,error)}
        }
    }
    override fun onDestroy(){voicePlayer?.release();voicePlayer=null;super.onDestroy();executor.shutdown()}
}
