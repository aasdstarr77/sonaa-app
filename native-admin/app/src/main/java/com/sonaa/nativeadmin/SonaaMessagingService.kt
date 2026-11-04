package com.sonaa.nativeadmin
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
class SonaaMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        getSharedPreferences("sonaa_admin_session", Context.MODE_PRIVATE).edit().putString("pending_fcm_token", token).apply()
    }
    override fun onMessageReceived(message: RemoteMessage) {
        val type = message.data["type"].orEmpty()
        val channel = channelFor(type)
        val title = message.notification?.title ?: message.data["title"] ?: "إشعار من صُنّاع"
        val body = message.notification?.body ?: message.data["message"] ?: ""
        val destination = when (channel) {
            "order_new" -> "orders"
            "fanni_register" -> "technicians"
            "client_register", "password_reset" -> "clients"
            "support" -> "complaints"
            "wallet_charge" -> "technicians"
            else -> "dashboard"
        }
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("destination", destination)
        }
        val pending = PendingIntent.getActivity(this, type.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(this, channel)
            .setSmallIcon(R.drawable.sonaa_logo).setContentTitle(title).setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body)).setAutoCancel(true).setContentIntent(pending)
            .setPriority(NotificationCompat.PRIORITY_HIGH).build()
        getSystemService(NotificationManager::class.java).notify(type.hashCode(), notification)
    }
    private fun channelFor(type: String) = when (type) {
        "order_new", "new_order", "admin_new_order" -> "order_new"
        "fanni_register", "new_fanni", "admin_new_technician" -> "fanni_register"
        "client_register", "new_client", "admin_new_client" -> "client_register"
        "password_reset", "admin_password_recovery" -> "password_reset"
        "support", "new_complaint", "admin_support_request", "admin_new_complaint" -> "support"
        "wallet_charge", "topup_request", "admin_new_topup" -> "wallet_charge"
        else -> "support"
    }
    companion object {
        fun createChannels(manager: NotificationManager) {
            if (Build.VERSION.SDK_INT >= 26) listOf(
                "order_new" to "طلبات جديدة", "fanni_register" to "تسجيل فني جديد",
                "client_register" to "تسجيل عميل جديد", "password_reset" to "استعادة كلمة المرور",
                "support" to "الدعم والشكاوى", "wallet_charge" to "شحن المحفظة"
            ).forEach { (id, name) -> manager.createNotificationChannel(NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH)) }
        }
    }
}
