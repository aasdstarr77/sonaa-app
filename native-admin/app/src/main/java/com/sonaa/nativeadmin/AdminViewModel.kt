package com.sonaa.nativeadmin
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
data class AdminUiState(val checking:Boolean=true,val authenticated:Boolean=false,val busy:Boolean=false,val error:String?=null,val section:AdminSection=AdminSection.DASHBOARD,val stats:JsonElement?=null,val items:List<JsonElement> = emptyList(),val actionMessage:String?=null,val payload:JsonElement?=null,val voicePath:String?=null)
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
 fun loadVoice(sn:String)=viewModelScope.launch{_state.value=_state.value.copy(busy=true,error=null);try{val file=repo.downloadVoice(sn);_state.value=_state.value.copy(busy=false,voicePath=file.absolutePath)}catch(e:Exception){_state.value=_state.value.copy(busy=false,error=e.message?: "تعذر تحميل التسجيل الصوتي")}}
 fun retry(){load(_state.value.section)}
 fun logout()=viewModelScope.launch{repo.logout();_state.value=AdminUiState(checking=false)}
 fun registerFcm(token:String)=viewModelScope.launch{runCatching{repo.registerFcm(token)}}
}
