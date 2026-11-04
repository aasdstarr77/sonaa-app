package com.sonaa.con

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.graphics.Color
import android.view.Gravity
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.content.Context
import android.widget.*
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
    private lateinit var root: LinearLayout
    private lateinit var body: LinearLayout
    private lateinit var status: TextView
    private lateinit var searchBox: EditText

    data class Section(val id:String,val label:String,val path:String,val listKeys:List<String> = listOf("data","items","results"))
    private val sections = listOf(
        Section("dashboard","الرئيسية","/admin/counts"),
        Section("stats","الإحصائيات","/admin/reports"),
        Section("orders","الطلبات","/admin/orders?limit=500",listOf("orders","data","items")),
        Section("fannis","الفنيون","/admin/fannis?limit=500",listOf("fannis","data","items")),\n        Section("pending","انتظار الاعتماد","/admin/fannis?limit=500",listOf("fannis","data","items")),\n        Section("disabled","الفنيون الموقوفون","/admin/fannis?limit=500",listOf("fannis","data","items")),\n        Section("offers","عروض الفنيين","/admin/orders?limit=500",listOf("orders","data","items")),\n        Section("wallets","محافظ الفنيين","/admin/fannis?limit=500",listOf("fannis","data","items")),\n        Section("levels","المستويات والشارات","/admin/fannis?limit=500",listOf("fannis","data","items")),
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
        Section("pageVisits","زيارات الموقع","/admin/page-visits",listOf("visits","items","data")),
        Section("security","سجل التدقيق","/admin/audit-logs",listOf("logs","items","data")),
        Section("roles","صلاحيات المشرفين","/admin/admin-users",listOf("users","data","items"))
    )
    private fun canRead(id:String):Boolean {
        if(profile.optString("adminRoleLabel")=="أدمن رئيسي") return true
        val key=when(id) {
            "dashboard","stats","pageVisits"->"dashboard"
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
        sections.filter{canRead(it.id)}.forEach{section->tabs.addView(button(section.label){active=section.id;loadSection()})}
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
        if(section.id=="content") {
            request(section.path,"GET",token,null){d,e->if(e!=null)status.text=e else{contentData=d?.optJSONObject("content")?:JSONObject();showContent()}}
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
    private fun showMetrics(data:JSONObject) {
        body.removeAllViews()
        val c=data.optJSONObject("counts")?:data
        listOf("إجمالي الفنيين" to c.optString("technicians","—"),"الفنيون المعتمدون" to c.optString("verifiedTechnicians","—"),"العملاء" to c.optString("clients","—")).forEach{body.addView(text(it.first+" : "+it.second,18f,true))}
        status.text="مؤشرات المنصة"
    }
    private fun renderRows() {
        if(!::body.isInitialized)return
        body.removeAllViews()
        val q=if(::searchBox.isInitialized)searchBox.text.toString().trim().lowercase() else ""
        for(i in 0 until allRows.length()){
            val item=allRows.optJSONObject(i)?:continue
            val raw=item.toString()
            if(q.isNotBlank()&&!raw.lowercase().contains(q))continue
            val card=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(12,8,12,10);setBackgroundColor(white)}
            val name=item.optString("name",item.optString("title",item.optString("sn",item.optString("action","سجل ${i+1}"))))
            card.addView(text(name,16f,true))
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
            card.addView(View(this).apply{setBackgroundColor(Color.LTGRAY);layoutParams=LinearLayout.LayoutParams(-1,1)})
            body.addView(card,LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=10})
        }
    }
    private fun actionLabels(section:String,item:JSONObject):List<Pair<String,String>> {
        if(!canWrite(section))return emptyList()
        val id=item.optString("_id",item.optString("id"))
        return when(section){
            "fannis"->buildList{
                if(!item.optBoolean("isApproved"))add("اعتماد" to "approve")
                if(item.optBoolean("isDisabled"))add("إعادة تفعيل" to "enable") else add("تعطيل" to "disable")
                add("تعديل الملف" to "profile");add("تغيير كلمة السر" to "password")
                add("إضافة رصيد" to "addBalance");add("تسوية الرصيد" to "setBalance")
                add("تجميد المحفظة" to "freeze");add("المستوى المهني" to "level");add("شارة موثوق" to "badge");add("ملاحظة داخلية" to "fanniNote");add("حد العروض" to "limit");add("ضوابط الحساب" to "controls");add("حذف الفني" to "delete")
            }
            "orders"->buildList{val sn=item.optString("sn");if(item.optString("status")=="قيد المراجعة")add("نشر" to "publish");add("إلغاء" to "cancel");add("أرشفة" to "archive");add("تصحيح" to "correct");if(sn.isNotBlank()){add("العروض" to "offers");add("تعيين فني" to "assign");add("حذف الطلب" to "deleteOrder")}}
            "topups"->listOf("قبول الشحن" to "approveTopup","رفض الشحن" to "rejectTopup")
            "complaints"->listOf("تحديث الشكوى" to "complaint")
            "clients"->listOf((if(item.optString("status")=="معلق")"إلغاء الحظر" else "حظر العميل") to (if(item.optString("status")=="معلق")"unblock" else "block"),"ملاحظة" to "note","حذف الحساب" to "deleteClient")
            "regions"->listOf("إظهار/إخفاء" to "toggle","حذف" to "deleteRegion")
            "services"->listOf("إخفاء" to "hideService","إظهار" to "showService","حذف" to "deleteService")
            "support"->listOf("تمت المراجعة" to "review")\n            "wallets"->listOf("إضافة رصيد" to "addBalance","تسوية الرصيد" to "setBalance","تجميد المحفظة" to "freeze","حركات المحفظة" to "transactions")\n            "offers"->listOf("مراجعة العروض" to "offers")
            "roles"->listOf("تغيير المنصب" to "role","تخصيص الصلاحيات" to "permissions","سحب الصلاحية" to "revoke")
            else->emptyList()
        }
    }
    private fun performAction(action:String,item:JSONObject) {
        val id=item.optString("_id",item.optString("id"))
        val sn=item.optString("sn")
        when(action){
            "approve"->mutate("/admin/fannis/$id/approve","POST",JSONObject())\n            "approveEdit"->mutate("/admin/fanni-profile-edits/$id/approve","POST",JSONObject())\n            "rejectEdit"->ask("سبب رفض التعديل","reason"){mutate("/admin/fanni-profile-edits/$id/reject","POST",JSONObject().put("reason",it))}
            "disable"->ask("سبب تعطيل الفني","reason"){mutate("/admin/fannis/$id/disable","POST",JSONObject().put("reason",it))}
            "enable"->mutate("/admin/fannis/$id/enable","POST",JSONObject())
            "delete"->confirm("تأكيد حذف الفني؟"){mutate("/admin/fannis/$id","DELETE",null)}\n            "deleteRegion"->confirm("حذف المنطقة من الاختيارات؟"){mutate("/admin/regions/$id","DELETE",null)}\n            "deleteService"->confirm("حذف الخدمة؟"){mutate("/admin/services/$id","DELETE",null)}\n            "hideService","showService"->mutate("/admin/services/${enc(item.optString("name"))}/${if(action=="hideService")"hide" else "show"}","POST",JSONObject())\n            "unblock"->mutate("/admin/clients/${enc(item.optString("phone"))}/unblock","POST",JSONObject())\n            "deleteClient"->confirm("حذف حساب العميل؟"){mutate("/admin/clients/${enc(item.optString("phone"))}/account","DELETE",null)}
            "password"->form("تغيير كلمة السر",listOf("كلمة السر الجديدة","تأكيد كلمة السر")){v->mutate("/admin/fannis/$id/password","PATCH",JSONObject().put("newPassword",v[0]).put("confirmPassword",v[1]))}
            "profile"->form("تعديل بيانات الفني",listOf("رقم الهاتف","التخصصات مفصولة بفاصلة","المناطق مفصولة بفاصلة")){v->mutate("/admin/fannis/$id/profile","PATCH",JSONObject().put("phone",v[0]).put("specialties",JSONArray(v[1].split(",").map{it.trim()}.filter{it.isNotBlank()})).put("areas",JSONArray(v[2].split(",").map{it.trim()}.filter{it.isNotBlank()})))}
            "addBalance","setBalance"->form("قيمة المحفظة",listOf("المبلغ","السبب")){v->mutate("/admin/fannis/$id/${if(action=="addBalance")"add-balance" else "set-balance"}","POST",JSONObject().put("amount",v[0].toDoubleOrNull()?:0).put("reason",v[1]))}
            "freeze"->ask("سبب التجميد (اكتب unfreeze لإلغاء التجميد)","reason"){v->mutate("/admin/wallet/freeze/$id","POST",JSONObject().put("action",if(v=="unfreeze")"unfreeze" else "freeze").put("reason",v))}\n            "level"->ask("المستوى المهني","level"){mutate("/admin/fannis/$id/level","PATCH",JSONObject().put("level",it))}\n            "badge"->ask("نوع الشارة (trusted لإضافة موثوق / none للإزالة)","badge"){mutate("/admin/fannis/$id/badge","PATCH",JSONObject().put("badge",it))}\n            "fanniNote"->ask("الملاحظة الداخلية","note"){mutate("/admin/fannis/$id/note","PATCH",JSONObject().put("note",it))}\n            "limit"->ask("الحد الأقصى للعروض","limit"){mutate("/admin/fannis/$id/limit","PATCH",JSONObject().put("limit",it.toIntOrNull()?:0))}\n            "controls"->form("ضوابط حساب الفني",listOf("السماح باستقبال الطلبات (true/false)","سبب التعديل")){v->mutate("/admin/fannis/$id/profile-controls","PATCH",JSONObject().put("isAvailable",v[0].toBoolean()).put("reason",v[1]))}\n            "transactions"->request("/admin/wallet/transactions/$id","GET",token,null){d,e->showMessage(if(e!=null)e else d.toString())}
            "publish"->confirm("نشر الطلب ${sn} للفنيين؟"){mutate("/orders/admin/$sn/publish","POST",JSONObject())}
            "cancel","archive"->ask("سبب الإجراء","reason"){mutate("/admin/orders/$sn/$action","POST",JSONObject().put("reason",it))}
            "deleteOrder"->confirm("حذف الطلب نهائيًا؟"){mutate("/admin/orders/$sn","DELETE",null)}\n            "correct"->form("تصحيح الطلب",listOf("اسم العميل","رقم الهاتف","الخدمة","المنطقة","العنوان","وصف الطلب","الميزانية")){v->mutate("/admin/orders/$sn/correct","PATCH",JSONObject().put("clientName",v[0]).put("clientPhone",v[1]).put("service",v[2]).put("area",v[3]).put("address",v[4]).put("description",v[5]).put("budget",v[6]))}
            "offers"->request("/admin/orders/$sn/offers","GET",token,null){d,e->showMessage(if(e!=null)e else d.toString())}\n            "assign"->ask("معرّف العرض Offer ID","offerId"){offerId->ask("سبب التعيين الإداري","reason"){reason->mutate("/admin/orders/$sn/assign","POST",JSONObject().put("offerId",offerId).put("reason",reason))}}
            "approveTopup","rejectTopup"->mutate("/admin/topup-requests/$id/${if(action=="approveTopup")"approve" else "reject"}","POST",JSONObject())
            "complaint"->form("تحديث الشكوى",listOf("الحالة (جديدة / قيد المراجعة / تم الحل / مرفوضة)","ملاحظة الإدارة","الرد على العميل")){v->mutate("/admin/complaints/$id","PATCH",JSONObject().put("status",v[0]).put("adminNote",v[1]).put("adminResponse",v[2]))}
            "block"->ask("سبب حظر العميل","reason"){v->mutate("/admin/clients/${enc(item.optString("phone"))}/block","POST",JSONObject().put("reason",v))}
            "note"->ask("الملاحظة الداخلية","note"){v->mutate("/admin/clients/${enc(item.optString("phone"))}/note","POST",JSONObject().put("note",v))}
            "toggle"->mutate("/admin/${if(active=="regions")"regions" else "services"}/$id","PATCH",JSONObject().put(if(active=="regions")"isActive" else "isActive",!item.optBoolean("isActive",true)))
            "review"->mutate("/admin/support/$sn/review","POST",JSONObject())
            "role"->ask("المنصب: مدير أو مشرف أول أو مشرف أو قراءة فقط","role"){mutate("/admin/admin-users/$id/role","PATCH",JSONObject().put("role",it))}
            "permissions"->showMessage("تخصيص الصلاحيات التفصيلي متاح بعد اختيار حساب المشرف من قسم الصلاحيات.")
            "revoke"->confirm("سحب الصلاحية الإدارية؟"){mutate("/admin/admin-users/$id","DELETE",null)}
        }
    }
    private fun createForActive() {
        if(!canWrite(active)){showMessage("لا تملك صلاحية الإضافة في هذا القسم");return}
        when(active){
            "regions"->ask("اسم المنطقة","name"){mutate("/admin/regions","POST",JSONObject().put("name",it))}
            "services"->form("إضافة خدمة",listOf("اسم الخدمة","القسم","رمز تعبيري")){v->mutate("/admin/services","POST",JSONObject().put("name",v[0]).put("category",v[1]).put("emoji",v[2]))}
            "notifications"->form("إرسال إشعار",listOf("دور المستلم (client / fanni)","معرّف المستلم","العنوان","نص الإشعار")){v->mutate("/admin/notifications/direct","POST",JSONObject().put("recipientRole",v[0]).put("recipientId",v[1]).put("title",v[2]).put("message",v[3]))}
            else->showMessage("الإضافة غير متاحة لهذا القسم من هذا العرض.")
        }
    }
    private fun showContent() {
        body.removeAllViews()
        val announcement=input("نص الإعلان",contentData.optString("announcement"),true);body.addView(text("إعلان الواجهة",16f,true));body.addView(announcement)
        body.addView(button("حفظ الإعلان"){mutate("/admin/content/announcement","PATCH",JSONObject().put("announcement",announcement.text.toString()))})
        val faqs=contentData.optJSONArray("faqs")?:JSONArray()
        body.addView(text("الأسئلة الشائعة: ${faqs.length()}",16f,true))
        for(i in 0 until faqs.length()){val f=faqs.optJSONObject(i)?:continue;body.addView(text("${i+1}) ${f.optString("question")}\n${f.optString("answer")}",12f));body.addView(button("حذف السؤال"){mutate("/admin/content/faqs/$i","DELETE",null)})}
        body.addView(button("إضافة سؤال شائع"){form("إضافة سؤال",listOf("السؤال","الإجابة")){v->val next=JSONArray(faqs).put(JSONObject().put("question",v[0]).put("answer",v[1]).put("active",true));mutate("/admin/content","PUT",JSONObject().put("announcement",announcement.text.toString()).put("faqs",next))}})
    }
    private fun showObjectSettings(section:String,data:JSONObject) {
        body.removeAllViews()
        val obj=data.optJSONObject(if(section=="pricing")"pricing" else "settings")?:data
        val fields=if(section=="settings")listOf("siteName","maintenance","maintenanceMessage","maxFanniSignupAttempts","walletPhone1","walletPhone2") else obj.keys().asSequence().toList()
        val edits=mutableMapOf<String,EditText>()
        fields.forEach{k->val v=obj.opt(k);body.addView(text(k,12f,true));val e=input(k,if(v is JSONObject||v is JSONArray) v.toString() else v?.toString()?: "");edits[k]=e;body.addView(e)}
        body.addView(button("حفظ التعديلات"){val out=JSONObject();edits.forEach{(k,e)->val old=obj.opt(k);val value=e.text.toString();out.put(k,when(old){is java.lang.Boolean->value.equals("true",true);is java.lang.Integer->value.toIntOrNull()?:0;is java.lang.Double->value.toDoubleOrNull()?:0.0;else->value})};mutate(if(section=="settings")"/admin/settings" else "/admin/pricing",if(section=="settings")"PUT" else "PUT",out)})
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
    override fun onDestroy(){super.onDestroy();executor.shutdown()}
}
