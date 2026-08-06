// Service Worker for Dr. Rajeev Bedi OPD Alerts
self.addEventListener('install', function(event) {
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
    var data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { title: 'New OPD Alert', body: event.data ? event.data.text() : 'You have a new notification.' };
    }

    var title = data.title || "Dr. Bedi OPD";
    var options = {
        body: data.body || "New client or chat update received.",
        icon: data.icon || "https://drrajeevbedi.com/booking/favicon.ico",
        data: data.url || "https://drrajeevbedi.com/booking/"
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data || '/')
    );
});
