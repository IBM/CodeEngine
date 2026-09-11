# Go Secure Coding Rules

These rules were derived from CodeQL findings (alerts #1–31) fixed in this
repository. Apply them to **every** Go file you write or modify.

---

## 1. Never log sensitive values (go/clear-text-logging)

Passwords, tokens, API keys, and raw HTTP header values MUST NOT appear in log
output, even partially (e.g. `password[:5]` is still a violation).

**WRONG**
```go
log.Printf("Password: %s", password[:5])
log.Printf("Header: %s=%s", k, r.Header[k])
log.Printf("Event data: %s", string(body))
```

**RIGHT**
```go
log.Printf("Password: [REDACTED]")
log.Printf("Header: %s=[REDACTED]", k)          // log key only
log.Printf("Event data: %d bytes received", len(body))
```

Rule: log the _name_ or _byte count_, never the _value_, for anything derived
from request headers, environment credentials, or external payloads.

---

## 2. Sanitize user input before logging (go/log-injection)

Any value that originates from an HTTP request (URL path, query parameters,
header values, request body, WebSocket message) must have newline characters
stripped before it is written to a log. A raw newline lets an attacker forge
additional log lines.

**WRONG**
```go
log.Printf("Got: %s", r.URL.Path)
log.Printf("Topic: %s", topic)           // topic comes from a query param
fmt.Printf("Server read: %s\n", message) // message is a WebSocket payload
```

**RIGHT**
```go
log.Printf("Got: %s", strings.ReplaceAll(r.URL.Path, "\n", ""))
log.Printf("Topic: %s", strings.ReplaceAll(topic, "\n", ""))
fmt.Printf("Server read: %d bytes\n", len(message))
```

When the logged value is a compound object from user-controlled data (e.g. a
pusher name, commit ref, bucket/object name from a COS event), apply
`strings.ReplaceAll(value, "\n", "")` to **each interpolated field**
individually.

---

## 3. Validate file paths before use (go/path-injection)

Never pass a user-supplied URL path directly to `os.ReadFile`, `os.Open`, or
any other filesystem call without strict validation first.

**WRONG**
```go
path := r.URL.Path[1:]
if strings.Index(path, "..") >= 0 {   // incomplete — still allows subdirs
    http.Error(w, "Bad path: "+path, 404)
    return
}
buf, err := os.ReadFile(path)
```

**RIGHT**
```go
path := r.URL.Path[1:] // strip leading '/'
if strings.Contains(path, "..") || strings.Contains(path, "/") {
    http.Error(w, "Bad path", 404)   // never echo the user value back
    return
}
buf, err := os.ReadFile(path)
```

Rules:
- Reject paths containing `..` **and** `/` (subdirectory separators).
- Never include the user-supplied path in the HTTP error response body.
- For named resources (job names, object keys), use an allowlist: only permit
  `[a-zA-Z0-9_-]` characters.

---

## 4. Prevent reflected XSS — validate before writing to response (go/reflected-xss)

Never write a user-supplied value back into an HTTP response without
validation or encoding.

**WRONG**
```go
jobDef := strings.Trim(r.URL.Path, "/")
fmt.Fprintf(w, "Bad path: %s - should be 'jobdef'\n", r.URL.Path)
```

**RIGHT**
```go
jobDef := strings.Trim(r.URL.Path, "/")

// Allowlist: only safe identifier characters
for _, c := range jobDef {
    if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
        (c >= '0' && c <= '9') || c == '-' || c == '_') {
        w.WriteHeader(http.StatusBadRequest)
        fmt.Fprintf(w, "Invalid job definition name\n") // static message only
        return
    }
}
```

Rules:
- Use a character allowlist for any identifier taken from the URL.
- Return only static error messages — never interpolate the user value into the
  response.
- If HTML output is required, use `html.EscapeString` from `html` package.

---

## 5. Do not expose error detail in HTTP responses

Stack traces, file paths, and internal error strings must stay server-side.
Return a generic message to the client; log the detail internally.

**WRONG**
```go
http.Error(w, "Error reading file:"+err.Error(), 404)
http.Error(w, "Bad path: "+path, 404)
```

**RIGHT**
```go
log.Printf("Error reading file %q: %s", path, err)
http.Error(w, "Not found", 404)
```

---

## 6. Quick checklist for every HTTP handler

Before committing any `http.HandlerFunc`, verify each item:

- [ ] No request header _value_ appears in a log statement
- [ ] No request body content appears in a log statement (log byte count only)
- [ ] Every URL/query/body value written to a log has `\n` stripped
- [ ] Every file path derived from URL is checked for `..` **and** `/`
- [ ] Every identifier from the URL is validated against a character allowlist
- [ ] No user-supplied string is interpolated into an HTTP response body without
      either allowlist validation or `html.EscapeString`
- [ ] Error responses contain only static messages, never the offending value
- [ ] Credentials (passwords, tokens, API keys) are logged as `[REDACTED]`
