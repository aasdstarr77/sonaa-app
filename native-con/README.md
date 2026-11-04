# Sonaa CON — Native Kotlin Android

This is the native Android/Kotlin application workspace for the CON admin product.
It is isolated under `native-con/`; the existing customer/technician application remains unchanged.

The first build milestone establishes a native Android app, authenticated CON login, persisted admin session, profile validation, and dashboard counts. Admin sections and their write workflows are being ported from the existing CON feature branch in subsequent implementation passes.

Build: `gradle assembleDebug` from this directory (Android SDK required).
