window.wsBridge = {
    connect: function (url, dotnetObj) {
        if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
            this.socket.onmessage = null;
            this.socket.onopen = null;
            this.socket.onclose = null;
            this.socket.close();
        }

        const socket = new WebSocket(url);
        let incomingChunks = {};

        socket.onopen = () => dotnetObj.invokeMethodAsync("HandleOpen");
        socket.onclose = () => dotnetObj.invokeMethodAsync("HandleClose");
        socket.onmessage = (e) => {
            const msg = e.data;
            if (msg.startsWith("CHUNK|")) {
                const parts = msg.split('|');
                const msgId = parts[1];
                const index = parseInt(parts[2]);
                const total = parseInt(parts[3]);
                const payload = parts.slice(4).join('|');

                if (!incomingChunks[msgId]) incomingChunks[msgId] = { total, chunks: {} };
                incomingChunks[msgId].chunks[index] = payload;

                if (Object.keys(incomingChunks[msgId].chunks).length === total) {
                    let assembled = '';
                    for (let i = 0; i < total; i++) {
                        assembled += incomingChunks[msgId].chunks[i];
                    }
                    delete incomingChunks[msgId];
                    dotnetObj.invokeMethodAsync("HandleMessage", assembled);
                }
            } else {
                dotnetObj.invokeMethodAsync("HandleMessage", msg);
            }
        };

        this.socket = socket;
        this.dotnetObj = dotnetObj;
    },

    send: function (msg) {
        if (!this.socket) return;
        const CHUNK_SIZE = 896; // increase from 400 — fewer frames = fewer drops
        if (msg.length <= CHUNK_SIZE) {
            this.socket.send(msg);
            return;
        }
        const total = Math.ceil(msg.length / CHUNK_SIZE);
        const msgId = Math.random().toString(36).substring(2, 9);
        for (let i = 0; i < total; i++) {
            const payload = msg.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            // stagger sends so ESP32 async queue doesn't overflow
            setTimeout(() => {
                this.socket.send(`CHUNK|${msgId}|${i}|${total}|${payload}`);
            }, i * 20); // 20ms between each chunk
        }
    },

    close: function () {
        if (this.socket) this.socket.close();
    }
};

window.getOrCreateClientId = function () {
    let id = localStorage.getItem('chatClientId');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('chatClientId', id);
    }
    return id;
};

window.getStoredUsername = function () {
    return localStorage.getItem('chatUsername') || '';
};

window.saveUsername = function (name) {
    localStorage.setItem('chatUsername', name);
};

window.scrollToBottom = function (id) {
    const el = document.getElementById(id);
    if (el) el.scrollTop = el.scrollHeight;
};

window.compressImage = function (dataUrl, maxWidth, quality) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round(height * maxWidth / width);
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const result = canvas.toDataURL('image/jpeg', quality);
            console.log(`Compressed size: ${result.length} bytes`);
            resolve(result);
        };
        img.src = dataUrl;
    });
};