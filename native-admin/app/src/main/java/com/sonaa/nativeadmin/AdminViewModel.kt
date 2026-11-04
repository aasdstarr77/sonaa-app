package com.sonaa.nativeadmin
import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
data class AdminUiState(val checking:Boolean=true,val authenticated:Boolean=false,val busy:Boolean=false,val error:String?=null,val section:AdminSection=AdminSection.DASHBOARD,val stats:JsonElement?=null,val items:List<JsonElement> = emptyList(),val actionMessage:String?=null,val payload:JsonElement?=null,val voicePath:String?=null,val editingProfile:JsonElement?=null,val editingProfileId:String?=null,val walletFanniId:String?=null,val walletTransactions:List<JsonElement> = emptyList(),val editingClient:JsonElement?=null,val editingClientId:String?=null,val recoveryDetail:JsonElement?=null,val recoveryDetailId:String?=null)
class AdminViewModel(app:Application):AndroidViewModel(app){
 private val repo=AdminRepository(app)
 private val _state=MutableStateFlow(AdminUiState())
 val state=_state.asStateFlow()
 fun restore()=viewModelScope.launch{val ok=repo.hasSession();_state.value=_state.value.copy(checking=false,authenticated=ok);if(ok)refresh()}
 fun login(phone:String,password:String)=viewModelScope.launch{
  _state.value=_state.value.copy(busy=true,error=null)
  try{repo.login(phone,password);_state.value=_state.value.copy(busy=false,authenticated=true);refresh()}
  catch(e:Exception){_state.value=_state.value.copy(busy=false,error=e.message?: "تعذر تسجيل الدخول")}
 }
 fun refresh()=load(AdminSection.DASHBOARD)
 fun open(section:AdminSection)=load(section)
 private fun load(section:AdminSection,preserveMessage:Boolean=false)=viewModelScope.launch{
  _state.value=_state.value.copy(section=section,busy=true,error=null,items=emptyList(),actionMessage=if(preserveMessage)_state.value.actionMessage else null)
  try{val data=repo.get(section);val loaded=section.extract(data);val visible=when(section){AdminSection.PENDING->loaded.filter{it.isJsonObject&&it.asJsonObject.get("isApproved")?.asBoolean!=true&&it.asJsonObject.get("isDisabled")?.asBoolean!=true&&it.asJsonObject.get("status")?.asString!="rejected"};AdminSection.DISABLED->loaded.filter{it.isJsonObject&&(it.asJsonObject.get("isDisabled")?.asBoolean==true||it.asJsonObject.get("status")?.asString=="disabled")};AdminSection.OFFERS->loaded.filter{it.isJsonObject&&it.asJsonObject.get("offers")?.let{v->v.isJsonArray&&v.asJsonArray.size()>0}==true};else->loaded};_state.value=_state.value.copy(busy=false,stats=if(section==AdminSection.DASHBOARD||section==AdminSection.STATS)data else _state.value.stats,items=visible,payload=data)}
  catch(e:Exception){_state.value=_state.value.copy(busy=false,error=e.message?: "تعذر تحميل البيانات")}
 }
 fun mutate(method:String,path:String,body:JsonObject=JsonObject())=viewModelScope.launch{
  _state.value=_state.value.copy(busy=true,error=null,actionMessage=null)
  try{
   val result=repo.mutate(method,path,body)
   if(_state.value.section==AdminSection.REPORTS)_state.value=_state.value.copy(busy=false,payload=result,actionMessage=result.toString())
   else{_state.value=_state.value.copy(busy=false,actionMessage=result.toString());load(_state.value.section,true)}
  }catch(e:Exception){_state.value=_state.value.copy(busy=false,error=e.message?: "تعذر تنفيذ العملية")}
 }
 fun openFanniProfile(id:String)=viewModelScope.launch{
  _state.value=_state.value.copy(busy=true,error=null,editingProfile=null,editingProfileId=null)
  try{val data=repo.get("api/admin/fannis/$id/profile");_state.value=_state.value.copy(busy=false,editingProfile=data,editingProfileId=id)}
  catch(e:Exception){_state.value=_state.value.copy(busy=false,error=e.message?: "تعذر تحميل بيانات الفني")}
 }
 fun closeProfile(){_state.value=_state.value.copy(editingProfile=null,editingProfileId=null)}
 fun openRecovery(id:String)=viewModelScope.launch{
  _state.value=_state.value.copy(busy=true,error=null,recoveryDetail=null,recoveryDetailId=id)
  try{val data=repo.get("api/password-recovery/admin/requests/$id");_state.value=_state.value.copy(busy=false,recoveryDetail=data)}
  catch(e:Exception){_state.value=_state.value.copy(busy=false,error=e.message?: "تعذر تحميل محادثة الاستعادة")}
 }
 fun closeRecovery(){_state.value=_state.value.copy(recoveryDetail=null,recoveryDetailId=null)}
 fun recoveryAction(method:String,path:String,body:JsonObject=JsonObject())=viewModelScope.launch{
  val id=_state.value.recoveryDetailId?:return@launch
  _state.value=_state.value.copy(busy=true,error=null,actionMessage=null)
  try{
   val result=repo.mutate(method,path,body)
   val detail=repo.get("api/password-recovery/admin/requests/$id")
   val obj=result.takeIf{it.isJsonObject}?.asJsonObject
   val message=obj?.get("message")?.asString?: "تم تنفيذ الإجراء"
   val code=obj?.get("code")?.takeIf{!it.isJsonNull}?.asString
   _state.value=_state.value.copy(busy=false,recoveryDetail=detail,actionMessage=message+(code?.let{" — رمز الاستعادة: $it"}?:""))
  }catch(e:Exception){_state.value=_state.value.copy(busy=false,error=e.message?: "تعذر تنفيذ إجراء الاستعادة")}
 }

 fun openClientProfile(id:String)=viewModelScope.launch{
  _state.value=_state.value.copy(busy=true,error=null,editingClient=null,editingClientId=null)
  try{val data=repo.get("api/admin/client-accounts/$id/profile");_state.value=_state.value.copy(busy=false,editingClient=data,editingClientId=id)}
  catch(e:Exception){_state.value=_state.value.copy(busy=false,error=e.message?: "تعذر تحميل بيانات العميل")}
 }
 fun closeClientProfile(){_state.value=_state.value.copy(editingClient=null,editingClientId=null)}
 fun openWalletTransactions(id:String)=viewModelScope.launch{_state.value=_state.value.copy(busy=true,error=null,walletFanniId=id);try{val data=repo.get("api/admin/wallet/transactions/$id");val rows=if(data.isJsonObject)data.asJsonObject.get("transactions")?.takeIf{it.isJsonArray}?.asJsonArray?.map{it}?:emptyList() else emptyList();_state.value=_state.value.copy(busy=false,walletTransactions=rows)}catch(e:Exception){_state.value=_state.value.copy(busy=false,error=e.message?: "تعذر تحميل حركات المحفظة")}}
 fun closeWalletTransactions(){_state.value=_state.value.copy(walletFanniId=null,walletTransactions=emptyList())}
 fun searchSupport(query:String)=viewModelScope.launch{
  if(query.trim().length<2){_state.value=_state.value.copy(error="اكتب رقم طلب أو هاتفًا من حرفين على الأقل");return@launch}
  _state.value=_state.value.copy(busy=true,error=null,section=AdminSection.SUPPORT)
  try{
   val data=repo.get("api/admin/support/search?q="+Uri.encode(query.trim()))
   val obj=data.asJsonObject
   val rows=mutableListOf<JsonElement>()
   listOf("orders","complaints").forEach{key->obj.get(key)?.takeIf{it.isJsonArray}?.asJsonArray?.forEach{entry->rows.add(entry)}}
   _state.value=_state.value.copy(busy=false,items=rows,payload=data)
  }catch(e:Exception){_state.value=_state.value.copy(busy=false,error=e.message?: "تعذر البحث في أدوات الدعم")}
 }
 fun bulkAction(section:AdminSection,ids:List<String>,action:String,reason:String="إجراء جماعي موثق من تطبيق الإدارة")=viewModelScope.launch{
  if(ids.isEmpty())return@launch
  _state.value=_state.value.copy(busy=true,error=null,actionMessage=null)
  var succeeded=0
  var failed=0
  val errors=mutableListOf<String>()
  for(raw in ids.distinct()){
   try{
    when(section){
     AdminSection.TECHNICIANS,AdminSection.PENDING,AdminSection.DISABLED->{
      if(action=="freeze"||action=="unfreeze")repo.mutate("POST","api/admin/wallet/freeze/$raw",JsonObject().apply{addProperty("action",action);addProperty("reason",reason)})
      else{
       val method=if(action=="delete")"DELETE" else "POST"
       val body=JsonObject().apply{if(action in listOf("reject","disable"))addProperty("reason",reason)}
       repo.mutate(method,"api/admin/fannis/$raw"+if(action=="delete")"" else "/$action",body)
      }
     }
     AdminSection.WALLETS->repo.mutate("POST","api/admin/wallet/freeze/$raw",JsonObject().apply{addProperty("action",action);addProperty("reason",reason)})
     AdminSection.TOPUPS->repo.mutate("POST","api/admin/topup-requests/$raw/$action",JsonObject().apply{if(action=="reject")addProperty("reason",reason)})
     AdminSection.CLIENTS->repo.mutate("DELETE","api/admin/clients/$raw/account")
     AdminSection.COMPLAINTS->repo.mutate("PATCH","api/admin/complaints/$raw",JsonObject().apply{addProperty("status",action)})
     AdminSection.OFFERS->{
      val parts=raw.split("|")
      if(parts.size!=2)error("معرّف العرض غير صالح")
      repo.mutate("POST","api/admin/offers/"+parts[0]+"/"+parts[1]+"/reject",JsonObject().apply{addProperty("reason",reason)})
     }
     AdminSection.REGIONS->when(action){
      "delete"->repo.mutate("DELETE","api/admin/regions/$raw")
      "restore"->repo.mutate("PATCH","api/admin/regions/$raw",JsonObject().apply{addProperty("isDeleted",false)})
      "activate"->repo.mutate("PATCH","api/admin/regions/$raw",JsonObject().apply{addProperty("isActive",true)})
      else->repo.mutate("PATCH","api/admin/regions/$raw",JsonObject().apply{addProperty("isActive",false)})
     }
     else->error("الإجراء الجماعي غير متاح لهذا القسم")
    }
    succeeded++
   }catch(e:Exception){failed++;if(errors.size<3)errors.add(raw+": "+(e.message?: "تعذر التنفيذ"))}
  }
  _state.value=_state.value.copy(busy=false,actionMessage="نجح $succeeded — تعذر $failed"+if(errors.isEmpty())"" else " — "+errors.joinToString(" | "))
  load(_state.value.section,true)
 }
 fun bulkPublish(sns:List<String>)=viewModelScope.launch{
  if(sns.isEmpty())return@launch
  _state.value=_state.value.copy(busy=true,error=null,actionMessage=null)
  var published=0
  var failed=0
  val errors=mutableListOf<String>()
  for(sn in sns.distinct()){
   try{repo.mutate("POST","api/orders/admin/$sn/publish",JsonObject());published++}
   catch(e:Exception){failed++;if(errors.size<3)errors.add("$sn: "+(e.message?: "تعذر النشر"))}
  }
  _state.value=_state.value.copy(busy=false,actionMessage="تم نشر $published طلب، وتعذر نشر $failed"+if(errors.isEmpty())"" else " — "+errors.joinToString(" | "))
  load(_state.value.section,true)
 }
 fun loadVoice(sn:String)=viewModelScope.launch{_state.value=_state.value.copy(busy=true,error=null);try{val file=repo.downloadVoice(sn);_state.value=_state.value.copy(busy=false,voicePath=file.absolutePath)}catch(e:Exception){_state.value=_state.value.copy(busy=false,error=e.message?: "تعذر تحميل التسجيل الصوتي")}}
 fun retry(){load(_state.value.section)}
 fun logout()=viewModelScope.launch{repo.logout();_state.value=AdminUiState(checking=false)}
 fun registerFcm(token:String)=viewModelScope.launch{runCatching{repo.registerFcm(token)}}
}
