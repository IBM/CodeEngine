/**
 * single-session.js — Standalone browser client for Remote Bob v4.
 *
 * Loaded by single-session.html from a file:// URL (no webserver). Reads
 * apiHost and agent from the URL query (identifiers only), prompts for the
 * gateway password, logs in via POST {apiHost}/auth/login (Basic auth,
 * username admin), then connects to /ws/browser and speaks the ttyd binary
 * protocol directly:
 *
 *   client → server: 0x30 + UTF-8 input bytes
 *                    0x31 + JSON {"columns":N,"rows":N} resize
 *   server → client: 0x30 + terminal output bytes
 *                    0x31 + UTF-8 window title
 *                    0x32 + JSON preferences (ignored)
 *
 * The password is kept in memory only — never in localStorage, the URL, or
 * console output. On WS close the page shows a disconnect overlay and
 * reconnects automatically: after an established session it always re-logins
 * for a fresh single-use WS token (no re-prompt); the existing token is
 * reused only for a retry after a first connect that never consumed it.
 *
 * To end a session use:  ./remote-bob --end-session --config=.env
 */

(function () {
    'use strict';

    // ── Query-string parsing (identifiers only, never credentials) ──────

    var params = new URLSearchParams(window.location.search);
    var apiHost = params.get('apiHost');
    var agent = params.get('agent');

    // ── DOM references ─────────────────────────────────────────────────

    var errorOverlay = document.getElementById('error-overlay');
    var errorIcon = document.getElementById('error-icon');
    var errorMessage = document.getElementById('error-message');
    var loginOverlay = document.getElementById('login-overlay');
    var loginForm = document.getElementById('login-form');
    var passwordInput = document.getElementById('password-input');
    var loginButton = document.getElementById('login-button');
    var loginError = document.getElementById('login-error');
    var loginAgent = document.getElementById('login-agent');
    var disconnectOverlay = document.getElementById('disconnect-overlay');
    var disconnectMessage = document.getElementById('disconnect-message');
    var disconnectSubmessage = document.getElementById('disconnect-submessage');
    var retryButton = document.getElementById('retry-button');
    var toolbarTitle = document.getElementById('toolbar-title');
    var bellFlash = document.getElementById('bell-flash');

    // ── Overlay helpers ─────────────────────────────────────────────────

    function showError(msg) {
        if (errorOverlay && errorMessage) {
            errorMessage.textContent = msg;
            errorOverlay.classList.add('visible');
        }
    }

    function showLogin() {
        if (loginOverlay) {
            loginOverlay.classList.add('visible');
            passwordInput.value = '';
            passwordInput.focus();
        }
    }

    function hideLogin() {
        if (loginOverlay) {
            loginOverlay.classList.remove('visible');
        }
    }

    function showLoginError(msg) {
        if (loginError) {
            loginError.textContent = msg;
        }
    }

    function clearLoginError() {
        if (loginError) {
            loginError.textContent = '';
        }
    }

    function showDisconnect(msg, sub, showRetry) {
        if (disconnectOverlay) {
            disconnectMessage.textContent = msg;
            disconnectSubmessage.textContent = sub;
            retryButton.style.display = showRetry ? 'block' : 'none';
            disconnectOverlay.classList.add('visible');
        }
    }

    function hideDisconnect() {
        if (disconnectOverlay) {
            disconnectOverlay.classList.remove('visible');
        }
    }

    // ── Validate required parameters ────────────────────────────────────

    if (!apiHost) {
        showError('Missing required parameter: apiHost. Open this page with ?apiHost=<host:port>&agent=<agent-id>.');
        return;
    }
    if (!agent) {
        showError('Missing required parameter: agent. Open this page with ?apiHost=<host:port>&agent=<agent-id>.');
        return;
    }

    // ── URL helpers ──────────────────────────────────────────────────────

    // httpBase returns the http(s) base URL for the apiHost. apiHost may be
    // passed with or without a scheme; localhost/loopback defaults to http,
    // anything else to https.
    function httpBase(host) {
        if (/^https?:\/\//i.test(host)) {
            return host;
        }
        if (/^localhost|^127\.|^\[?::1\]?/i.test(host)) {
            return 'http://' + host;
        }
        return 'https://' + host;
    }

    // wsBase derives the ws(s) base URL from the apiHost scheme.
    function wsBase(host) {
        return httpBase(host).replace(/^http/, 'ws');
    }

    // ── Terminal setup ───────────────────────────────────────────────────

    var term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        scrollback: 5000,
        bellStyle: 'none',
        theme: {
            background: '#000000',
            foreground: '#ffffff',
            cursor: '#ffffff',
            cursorAccent: '#000000',
            selection: 'rgba(255, 255, 255, 0.3)',
            black: '#000000',
            red: '#cd3131',
            green: '#0dbc79',
            yellow: '#e5e510',
            blue: '#2472c8',
            magenta: '#bc3fbc',
            cyan: '#11a8cd',
            white: '#e5e5e5',
            brightBlack: '#666666',
            brightRed: '#f14c4c',
            brightGreen: '#23d18b',
            brightYellow: '#f5f543',
            brightBlue: '#3b8eea',
            brightMagenta: '#d670d6',
            brightCyan: '#29b8db',
            brightWhite: '#e5e5e5'
        }
    });

    var fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);

    var terminalEl = document.getElementById('terminal');
    term.open(terminalEl);
    fitAddon.fit();

    // cleanTitle strips internal tmux command strings from the window title
    // (ttyd sets the title to the full tmux attach command which is noisy).
    // Anything that looks like a tmux invocation is replaced with "Remote Bob".
    function cleanTitle(raw) {
        if (!raw) { return 'Remote Bob'; }
        // Match "tmux ..." or lines containing tmux subcommands.
        if (/^\s*tmux\b/i.test(raw)) { return 'Remote Bob'; }
        return raw;
    }

    // Terminal title changes (OSC 0/2) propagate to the document title
    // and the toolbar label.
    term.onTitleChange(function (title) {
        if (title) {
            var clean = cleanTitle(title);
            document.title = clean;
            if (toolbarTitle) {
                toolbarTitle.textContent = clean;
            }
        }
    });

    // BEL → visual bell (flash overlay). The vendored xterm.js has no
    // built-in visual bell, so we implement one via the onBell event.
    var bellTimer = null;
    term.onBell(function () {
        bellFlash.classList.add('visible');
        if (bellTimer) {
            clearTimeout(bellTimer);
        }
        bellTimer = setTimeout(function () {
            bellFlash.classList.remove('visible');
            bellTimer = null;
        }, 200);
    });

    // ── Connection state ─────────────────────────────────────────────────

    var password = null;       // in-memory only; never persisted or logged
    var wsToken = null;        // current single-use WS token
    var socket = null;         // current WebSocket
    var connecting = false;   // a WS connect attempt is in progress
    var loginInFlight = false; // a login request is in progress
    var everConnected = false; // a WS has reached OPEN at least once
    var tokenRetried = false;  // the current token was reused for one retry
    var reconnectAttempt = 0;  // consecutive failed reconnect attempts
    var reconnectTimer = null; // pending reconnect timeout

    var MAX_RECONNECT_ATTEMPTS = 10;
    var BACKOFF_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

    function backoffDelay(attempt) {
        return BACKOFF_DELAYS_MS[Math.min(attempt, BACKOFF_DELAYS_MS.length - 1)];
    }

    // ── ttyd binary protocol frames ──────────────────────────────────────

    var OPCODE_INPUT = 0x30;
    var OPCODE_RESIZE = 0x31;
    var OPCODE_OUTPUT = 0x30;
    var OPCODE_TITLE = 0x31;
    var OPCODE_PREFS = 0x32;

    var textEncoder = new TextEncoder();
    var textDecoder = new TextDecoder();

    function sendInput(data) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }
        var bytes = textEncoder.encode(data);
        var frame = new Uint8Array(bytes.length + 1);
        frame[0] = OPCODE_INPUT;
        frame.set(bytes, 1);
        socket.send(frame);
    }

    function sendResize(cols, rows) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }
        if (!cols || !rows) {
            return;
        }
        var payload = textEncoder.encode(JSON.stringify({ columns: cols, rows: rows }));
        var frame = new Uint8Array(payload.length + 1);
        frame[0] = OPCODE_RESIZE;
        frame.set(payload, 1);
        socket.send(frame);
    }

    // ── Terminal I/O wiring ──────────────────────────────────────────────

    term.onData(function (data) {
        sendInput(data);
    });

    term.onResize(function (size) {
        sendResize(size.cols, size.rows);
    });

    window.addEventListener('resize', function () {
        fitAddon.fit();
    });

    // ── Login ───────────────────────────────────────────────────────────

    function basicAuthHeader(username, pass) {
        var bytes = textEncoder.encode(username + ':' + pass);
        var binary = '';
        for (var i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // userError marks errors that already carry a user-readable message so
    // the network-error fallback does not overwrite them.
    function userError(msg) {
        var e = new Error(msg);
        e.isUserError = true;
        return e;
    }

    // shutdownError is a sentinel thrown when the server returns 503
    // "shutting_down". The caller should show the shutting-down overlay
    // instead of retrying.
    function shutdownError() {
        var e = new Error('shutting_down');
        e.isShutdown = true;
        return e;
    }

    // doLogin performs POST {apiHost}/auth/login with Basic auth and
    // resolves to the WS token. Rejects with a user-readable message.
    function doLogin(pass) {
        return fetch(httpBase(apiHost) + '/auth/login', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + basicAuthHeader('admin', pass)
            }
        }).then(function (resp) {
            if (resp.status === 401) {
                throw userError('Invalid password. Please try again.');
            }
            if (resp.status === 503) {
                // Server is shutting down — check the body for our sentinel.
                return resp.json().then(function (json) {
                    if (json && json.error === 'shutting_down') {
                        throw shutdownError();
                    }
                    throw userError('Server is unavailable (503). Please try again later.');
                }).catch(function (e) {
                    if (e && e.isShutdown) { throw e; }
                    throw userError('Server is unavailable (503). Please try again later.');
                });
            }
            if (!resp.ok) {
                throw userError('Login failed (HTTP ' + resp.status + ').');
            }
            return resp.json();
        }).then(function (json) {
            if (!json || typeof json.token !== 'string' || json.token === '') {
                throw userError('Server returned an invalid login response.');
            }
            return json.token;
        }).catch(function (err) {
            if (err && (err.isUserError || err.isShutdown)) {
                throw err;
            }
            throw userError('Could not reach the server at ' + apiHost + '. Check that it is running and reachable.');
        });
    }

    loginAgent.textContent = agent;
    // Show the agent name in the toolbar immediately (before login).
    if (toolbarTitle) {
        toolbarTitle.textContent = agent;
    }

    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (loginInFlight) {
            return;
        }
        var pw = passwordInput.value;
        if (!pw) {
            showLoginError('Please enter a password.');
            return;
        }
        clearLoginError();
        loginInFlight = true;
        loginButton.disabled = true;
        doLogin(pw).then(function (token) {
            // Login succeeded — authenticate before probing so a wrong password
            // is rejected first. Now check whether the agent still exists before
            // attempting the WS connect (avoids the "Connection failed" loop when
            // the session ended while the browser was away or on a fresh open).
            return probeAgent().then(function (state) {
                loginInFlight = false;
                loginButton.disabled = false;
                if (state === 'shutdown') {
                    hideLogin();
                    showShuttingDown();
                    return;
                }
                if (state === 'gone') {
                    hideLogin();
                    showSessionEnded();
                    return;
                }
                // Agent alive — proceed.
                password = pw;
                wsToken = token;
                hideLogin();
                fitAddon.fit();
                term.focus();
                connectWS();
            });
        }).catch(function (err) {
            loginInFlight = false;
            loginButton.disabled = false;
            showLoginError(err.message);
            passwordInput.focus();
            passwordInput.select();
        });
    });

    // ── WebSocket connect / reconnect ───────────────────────────────────

    function connectWS() {
        if (connecting || !wsToken) {
            return;
        }
        connecting = true;
        var url = wsBase(apiHost) + '/ws/browser?token=' + encodeURIComponent(wsToken) +
            '&agent=' + encodeURIComponent(agent) + '&service=ttyd';
        var s = new WebSocket(url);
        s.binaryType = 'arraybuffer';
        socket = s;

        s.addEventListener('open', function () {
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            connecting = false;
            everConnected = true;
            reconnectAttempt = 0;
            tokenRetried = false;
            hideDisconnect();
            fitAddon.fit();
            // The first frame after open must be a resize frame so the
            // remote terminal adopts the current size.
            sendResize(term.cols, term.rows);
            term.focus();
        });

        s.addEventListener('message', function (event) {
            if (typeof event.data === 'string') {
                return; // ttyd speaks binary frames only; ignore text
            }
            var bytes = new Uint8Array(event.data);
            if (bytes.length === 0) {
                return;
            }
            var opcode = bytes[0];
            var payload = new Uint8Array(bytes.subarray(1));
            switch (opcode) {
                case OPCODE_OUTPUT:
                    term.write(payload);
                    break;
                case OPCODE_TITLE: {
                    var rawTitle = textDecoder.decode(payload);
                    var cleanedTitle = cleanTitle(rawTitle);
                    document.title = cleanedTitle;
                    if (toolbarTitle) {
                        toolbarTitle.textContent = cleanedTitle;
                    }
                    break;
                }
                case OPCODE_PREFS:
                    // ttyd preferences JSON — not needed; ignore.
                    break;
                default:
                    break;
            }
        });

        s.addEventListener('error', function () {
            // The close event always follows; handle state there.
        });

        s.addEventListener('close', function (event) {
            connecting = false;
            socket = null;
            // Close code 4000 means the agent exited deliberately (e.g. /exit,
            // idle timeout, or End Session). Show the ended screen instead of
            // trying to reconnect.
            if (event.code === 4000) {
                showSessionEnded();
                return;
            }
            // If the server is shutting down, show the shutting-down overlay
            // instead of reconnecting (HTTP 503 on the next login would catch
            // it too, but the WS close gives us earlier feedback).
            if (event.code === 1001 || event.code === 1006) {
                // Could be a normal close or network drop. Check if we already
                // know the server is shutting down.
                if (serverShuttingDown) {
                    showShuttingDown();
                    return;
                }
            }
            scheduleReconnect();
        });
    }

    // ── Shutting-down state ──────────────────────────────────────────────
    // Set when the server returns 503 shutting_down. Blocks all reconnects.

    var serverShuttingDown = false;

    function showShuttingDown() {
        if (serverShuttingDown && sessionEndedShown) { return; }
        serverShuttingDown = true;
        if (socket) {
            socket.close();
            socket = null;
        }
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (disconnectOverlay) {
            disconnectOverlay.classList.remove('visible');
        }
        if (toolbarTitle) {
            toolbarTitle.textContent = 'Shutting down…';
        }
        document.title = 'Remote Bob — Shutting Down';
        // Reuse the disconnect overlay to show the shutting-down message with
        // no retry button. Poll until the server goes away, then show ended.
        if (disconnectOverlay) {
            disconnectMessage.textContent = 'Session is shutting down…';
            disconnectSubmessage.textContent = 'Please wait. This window will update when the session has ended.';
            retryButton.style.display = 'none';
            disconnectOverlay.classList.add('visible');
        }
        pollUntilGone();
    }

    // pollUntilGone polls /healthz every 2 s. When the server stops
    // responding (network error), the session has ended — show ended screen.
    function pollUntilGone() {
        var pollTimer = setInterval(function () {
            fetch(httpBase(apiHost) + '/healthz').then(function (resp) {
                if (resp.status === 503 || !resp.ok) {
                    // Still alive but unhealthy — keep waiting.
                }
                // Still responding 200 — keep waiting.
            }).catch(function () {
                // Network error: server is gone.
                clearInterval(pollTimer);
                showSessionEnded();
            });
        }, 2000);
    }

    // probeAgent checks whether the agent is still registered on the server.
    // Resolves to "alive", "shutdown", or "gone" (agent not found / server gone).
    function probeAgent() {
        return fetch(httpBase(apiHost) + '/agents/' + encodeURIComponent(agent))
            .then(function (resp) {
                if (resp.status === 503) {
                    return resp.json().then(function (json) {
                        if (json && json.error === 'shutting_down') { return 'shutdown'; }
                        return 'shutdown';
                    }).catch(function () { return 'shutdown'; });
                }
                if (resp.status === 404) { return 'gone'; }
                if (resp.ok) { return 'alive'; }
                return 'gone';
            })
            .catch(function () {
                // Network error — server is unreachable (scaling down or gone).
                return 'gone';
            });
    }

    function scheduleReconnect() {
        if (reconnectTimer) {
            return;
        }
        if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
            showDisconnect(
                everConnected ? 'Connection lost' : 'Connection failed',
                'Could not reconnect after ' + MAX_RECONNECT_ATTEMPTS + ' attempts. Click Retry to try again.',
                true
            );
            return;
        }
        var delay = backoffDelay(reconnectAttempt);
        reconnectAttempt++;
        showDisconnect(
            everConnected ? 'Connection lost' : 'Connection failed',
            'Reconnecting… (attempt ' + reconnectAttempt + ')'
        );
        reconnectTimer = setTimeout(function () {
            reconnectTimer = null;
            doReconnect();
        }, delay);
    }

    function doReconnect() {
        if (everConnected) {
            // The single-use token was consumed by the successful connect;
            // always re-login for a fresh token (password in memory).
            reloginAndConnect();
        } else if (!tokenRetried) {
            // The first connect never succeeded, so the token may not have
            // been consumed — reuse it for one retry.
            tokenRetried = true;
            connectWS();
        } else {
            reloginAndConnect();
        }
    }

    function reloginAndConnect() {
        if (loginInFlight) {
            return; // a re-login is already in flight; do not duplicate
        }
        if (!password) {
            // Password is gone (should not happen) — re-prompt the user.
            showLogin();
            return;
        }
        loginInFlight = true;
        // Before re-logging in, probe whether the agent still exists.
        // This lets us show the correct terminal state immediately instead of
        // hammering the server with login+WS attempts that will always fail
        // when the session has ended (idle timeout, CE job finished, etc.).
        probeAgent().then(function (state) {
            if (state === 'shutdown') {
                loginInFlight = false;
                showShuttingDown();
                return;
            }
            if (state === 'gone') {
                loginInFlight = false;
                showSessionEnded();
                return;
            }
            // state === 'alive' — proceed with login
            return doLogin(password).then(function (token) {
                loginInFlight = false;
                wsToken = token;
                connectWS();
            }).catch(function (err) {
                loginInFlight = false;
                if (err && err.isShutdown) {
                    showShuttingDown();
                    return;
                }
                scheduleReconnect();
            });
        });
    }

    retryButton.addEventListener('click', function () {
        reconnectAttempt = 0;
        tokenRetried = false;
        doReconnect();
    });

    // ── Session ended ────────────────────────────────────────────────────

    var sessionEndedShown = false;
    function showSessionEnded() {
        if (sessionEndedShown) { return; }
        sessionEndedShown = true;
        if (socket) {
            socket.close();
            socket = null;
        }
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        // Update the toolbar to reflect ended state.
        if (toolbarTitle) {
            toolbarTitle.textContent = 'Session ended';
        }
        document.title = 'Remote Bob — Session Ended';
        // Hide the disconnect overlay if showing; show a permanent ended message.
        if (disconnectOverlay) {
            disconnectOverlay.classList.remove('visible');
        }
        // Show the error overlay reused as a "session ended" confirmation screen.
        if (errorOverlay && errorMessage) {
            errorOverlay.classList.add('ended');
            if (errorIcon) { errorIcon.textContent = '\u2713'; } // ✓
            errorMessage.textContent = 'The session has been ended. You can close this window.';
            errorOverlay.classList.add('visible');
        }
        // Attempt window close — works when the window was opened by script.
        setTimeout(function () { window.close(); }, 600);
    }

    // ── Initial state: show the password prompt before any WS ───────────

    showLogin();

    // Close the socket cleanly when the page unloads, but do NOT call
    // DELETE /agents — closing the window does not end the session.
    window.addEventListener('beforeunload', function () {
        if (socket) {
            socket.close();
        }
    });

})();
