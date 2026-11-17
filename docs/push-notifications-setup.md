# PUASH Android push notifications setup

The app uses Capacitor 7's official push notification plugin and the Firebase Cloud Messaging (FCM) Android transport.

## Firebase app registration

1. Create or open the Firebase project used by PUASH.
2. Register an Android app with the exact package ID `com.puash.app`.
3. Download the Android `google-services.json` file.
4. Place it at `android/app/google-services.json` before building the Android app. The current CI workflow creates the Android platform during the build, so the file must be injected after `npx cap add android` and before Gradle runs.

## Supabase

The `register-push-token` Edge Function verifies the signed-in Supabase user before saving or removing that user's FCM registration token. The `push_device_tokens` table has row-level security enabled.

## Important

This foundation registers the device and stores its token. It does not yet send order or delivery push messages while PUASH is closed. Server-side FCM sending and wiring notification events to the sender require the Firebase service-account credentials to be stored as Supabase Edge Function secrets, never in the app or Git repository.

Never commit Firebase service-account private keys or Supabase service-role keys.
