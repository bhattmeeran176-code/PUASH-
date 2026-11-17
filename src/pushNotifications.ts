import { Capacitor } from '@capacitor/core';
import { PushNotifications, type PluginListenerHandle } from '@capacitor/push-notifications';
import { supabase } from './supabase';

export async function registerPuashPushNotifications(userId: string): Promise<() => void> {
  if (!Capacitor.isNativePlatform() || !userId) return () => {};

  const listeners: PluginListenerHandle[] = [];
  try {
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive !== 'granted') {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') return () => {};

    if (Capacitor.getPlatform() === 'android') {
      await PushNotifications.createChannel({
        id: 'puash-updates',
        name: 'PUASH Updates',
        description: 'Order, delivery and account updates',
        importance: 5,
        sound: 'default',
        vibration: true,
      });
    }

    listeners.push(await PushNotifications.addListener('registration', async ({ value }) => {
      const { error } = await supabase.functions.invoke('register-push-token', {
        body: { token: value, platform: Capacitor.getPlatform() },
      });
      if (error) console.error('PUASH push token registration failed:', error.message);
    }));

    listeners.push(await PushNotifications.addListener('registrationError', error => {
      console.error('PUASH push registration error:', error);
    }));

    listeners.push(await PushNotifications.addListener('pushNotificationReceived', notification => {
      window.dispatchEvent(new CustomEvent('puash:push-notification', { detail: notification }));
    }));

    listeners.push(await PushNotifications.addListener('pushNotificationActionPerformed', action => {
      const target = action.notification.data?.url;
      if (typeof target === 'string' && target.startsWith('/')) window.location.assign(target);
    }));

    await PushNotifications.register();
  } catch (error) {
    console.error('PUASH push notifications could not be initialized:', error);
  }

  return () => {
    listeners.forEach(listener => { void listener.remove(); });
  };
}
