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
        body: data.body || "New patient or chat update received.",
        icon: "/apple-touch-icon.png", 
        data: data.url || "/admin", 
        tag: data.tag || "bedi-alert",
        renotify: true
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const targetUrl = event.notification.data || '/admin';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            // If the admin inbox tab is already open, focus it
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url.includes('/admin') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise, open a new tab to the inbox
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});