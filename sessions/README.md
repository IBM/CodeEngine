# Sessions

Demo that shows how to use Redis as a sessions manager in a Code Engine
app.

While we should use an external Redis, I decided to run it as a Code Engine
app to show that it's possible to run something that
- doesn't have an external endpoint
- doesn't use HTTP
- is long running

The `sessions.go` app is pretty small, it just shows how to talk to
Redis for a simple counter, if you scale the app up it shows how you could
expand this to store/share state across multiple instances of the app.

When run, you should see each `curl` return the `Counter` value.
The order might not be perfect due to timing issues, but as long as you don't
see duplicates and the final `curl` returns `100` then it worked.
