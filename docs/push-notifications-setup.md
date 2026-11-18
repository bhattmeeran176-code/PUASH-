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

The `send-order-push` Edge Function sends an FCM HTTP v1 notification to a customer's registered Android devices after an admin changes an order status. It verifies the caller's Supabase JWT and checks the caller's `profiles.role` is `admin`, then confirms the submitted status matches the saved order before sending. The Firebase service-account JSON must be stored as the Supabase Edge Function secret `FIREBASE_SERVICE_ACCOUNT`. The private key must never be added to the app or Git repository. The admin UI invokes this function after a successful order status update.

Never commit Firebase service-account private keys or Supabase service-role keys.
