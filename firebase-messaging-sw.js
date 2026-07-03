importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCF09qr8P8_BOzWt53wopZlavHFZb7sBnM",
    authDomain: "starlife-advert-a6587.firebaseapp.com",
    projectId: "starlife-advert-a6587",
    storageBucket: "starlife-advert-a6587.firebasestorage.app",
    messagingSenderId: "946780590831",
    appId: "1:946780590831:web:dd22e4879ec0786a31011a"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    const { title = 'Starlife', body = '', icon } = notification;
    self.registration.showNotification(title, {
        body,
        icon: icon || '/icon-192.png',
        badge: '/icon-72.png',
        data: payload.data || {}
    });
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || 'https://starlifeadvert.com/#';
    event.waitUntil(clients.openWindow(url));
});
