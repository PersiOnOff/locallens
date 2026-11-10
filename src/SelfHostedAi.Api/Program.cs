using Microsoft.AspNetCore.RateLimiting;
using LocalLens;
using Microsoft.AspNetCore.Http.Features;
using System.Text.Json;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
var options = builder.Configuration.GetSection("Lens").Get<LensOptions>() ?? new LensOptions();
if (!Uri.TryCreate(options.OllamaUrl, UriKind.Absolute, out var ollamaUri) || ollamaUri.Scheme is not ("http" or "https")) throw new InvalidOperationException("Lens:OllamaUrl must be an HTTP URL.");
builder.Services.AddSingleton(options);
builder.Services.AddSingleton<KnowledgeStore>();
builder.Services.AddSingleton<OllamaService>();
builder.Services.AddHostedService<IndexingWorker>();
builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = LensOptions.MaxUploadBytes + 65536);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = LensOptions.MaxUploadBytes + 65536);
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddConcurrencyLimiter("chat", limit => { limit.PermitLimit = 1; limit.QueueLimit = 0; });
    o.AddConcurrencyLimiter("ingest", limit => { limit.PermitLimit = 1; limit.QueueLimit = 0; });
});
var app = builder.Build();
var json = new JsonSerializerOptions(JsonSerializerDefaults.Web);
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    // Same-origin writes only: local document and repository access must not be callable by another website.
    if (context.Request.Method is not ("GET" or "HEAD" or "OPTIONS") && context.Request.Headers.TryGetValue("Origin", out var origin))
    {
        if (!Uri.TryCreate(origin.ToString(), UriKind.Absolute, out var source) || source.Authority != context.Request.Host.Value) { context.Response.StatusCode = 403; return; }
    }
    try { await next(); }
    catch (Exception e) when (e is ArgumentException or BadHttpRequestException or InvalidDataException)
    {
        if (context.Response.HasStarted) throw;
        context.Response.StatusCode = e is BadHttpRequestException bad ? bad.StatusCode : 400;
        await context.Response.WriteAsJsonAsync(new { error = e is ArgumentException ? e.Message : "Invalid request or upload too large." });
    }
});
app.UseRateLimiter();
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapGet("/api/health", async (OllamaService ollama, CancellationToken ct) => Results.Ok(new { app = "LocalLens", ollama = await ollama.Health(ct), maxUploadMb = 20, repositoryRootConfigured = Directory.Exists(options.RepositoryRoot) }));
app.MapGet("/api/documents", (KnowledgeStore store) => Results.Ok(store.List().Select(d => new { d.Id, d.Name, d.Kind, d.GroupName, d.RelativePath, d.Status, d.Error, d.Progress, d.ChunkCount, d.Size, d.Model, d.CreatedAt, needsReindex = d.Status == "ready" && d.Model != options.EmbeddingModel })));
app.MapGet("/api/documents/{id}", (string id, KnowledgeStore store) => store.Get(id) is { } doc ? Results.Ok(doc) : Results.NotFound(new { error = "Source not found." }));
app.MapDelete("/api/documents/{id}", (string id, KnowledgeStore store) => store.Delete(id) ? Results.NoContent() : Results.NotFound());
app.MapPost("/api/documents/{id}/retry", (string id, KnowledgeStore store) => store.Retry(id) ? Results.Accepted() : Results.BadRequest(new { error = "Source does not exist or is already indexing." })).RequireRateLimiting("ingest");
app.MapPost("/api/documents", async (HttpRequest request, KnowledgeStore store, CancellationToken ct) =>
{
    if (!request.HasFormContentType) return Results.BadRequest(new { error = "Upload a multipart form with a file field." });
    var form = await request.ReadFormAsync(ct);
    var file = form.Files.GetFile("file");
    if (file == null || file.Length <= 0 || file.Length > LensOptions.MaxUploadBytes) return Results.BadRequest(new { error = "Choose a file between 1 byte and 20 MB." });
    using var memory = new MemoryStream(); await file.CopyToAsync(memory, ct);
    var doc = DocumentReader.Read(file.FileName, memory.ToArray()); store.Add(doc);
    return Results.Accepted($"/api/documents/{doc.Id}", new { doc.Id, doc.Name, doc.Status });
}).DisableAntiforgery().RequireRateLimiting("ingest");
app.MapPost("/api/repositories", (RepositoryRequest request, KnowledgeStore store) =>
{
    if (!Directory.Exists(options.RepositoryRoot)) return Results.BadRequest(new { error = "Repository root is unavailable. Configure Lens:RepositoryRoot or the Compose repository mount." });
    var root = RepositoryScanner.Resolve(options.RepositoryRoot, request.Path ?? ".");
    if (!Directory.Exists(root)) return Results.BadRequest(new { error = "Repository directory not found." });
    var existing = store.List(); var added = 0; var skipped = 0; var errors = new List<object>();
    var group = "Repository: " + (string.IsNullOrWhiteSpace(request.Path) || request.Path == "." ? new DirectoryInfo(root).Name : request.Path.Replace('\\', '/'));
    foreach (var file in RepositoryScanner.Files(root).Take(2001))
    {
        if (added + skipped >= 2000 || existing.Count + added >= LensOptions.MaxDocuments) { errors.Add(new { name = "repository", error = "Import stopped at the library or scan limit." }); break; }
        var relative = Path.GetRelativePath(root, file).Replace('\\', '/');
        if (existing.Any(d => d.GroupName == group && d.RelativePath == relative)) { skipped++; continue; }
        try
        {
            if (new FileInfo(file).Length > LensOptions.MaxUploadBytes) throw new ArgumentException("File exceeds 20 MB.");
            store.Add(DocumentReader.Read(Path.GetFileName(file), File.ReadAllBytes(file), group, relative)); added++;
        }
        catch (Exception e) when (e is ArgumentException or IOException or UnauthorizedAccessException) { skipped++; errors.Add(new { name = relative, error = e is ArgumentException ? e.Message : "Cannot read this file." }); }
    }
    return Results.Accepted(value: new { added, skipped, errors });
}).RequireRateLimiting("ingest");
app.MapGet("/api/graph", (KnowledgeStore store) => Results.Ok(FileGraph.Build(store.List(includeContent: true))));
app.MapPost("/api/chat", async (ChatRequest request, KnowledgeStore store, OllamaService ollama, HttpContext context) =>
{
    if (string.IsNullOrWhiteSpace(request.Question) || request.Question.Length > 4000 || (request.History?.Length ?? 0) > 20 || (request.DocumentIds?.Length ?? 0) > 500)
    {
        context.Response.StatusCode = 400; await context.Response.WriteAsJsonAsync(new { error = "Use a question of 1–4,000 characters, at most 20 history messages and 500 source IDs." }); return;
    }
    if (request.History?.Any(h => h.Content == null || h.Content.Length > 8000 || h.Role is not ("user" or "assistant")) == true) { context.Response.StatusCode = 400; await context.Response.WriteAsJsonAsync(new { error = "Invalid chat history." }); return; }
    context.Response.ContentType = "text/event-stream";
    context.Response.Headers.CacheControl = "no-cache";
    context.Response.Headers["X-Accel-Buffering"] = "no";
    var ct = context.RequestAborted;
    async Task Send(string type, object data) { await context.Response.WriteAsync($"event: {type}\ndata: {JsonSerializer.Serialize(data, json)}\n\n", ct); await context.Response.Body.FlushAsync(ct); }
    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromMinutes(5));
    try
    {
        var eligible = store.List().Any(d => d.Status == "ready" && d.Model == options.EmbeddingModel && (request.DocumentIds == null || request.DocumentIds.Length == 0 || request.DocumentIds.Contains(d.Id)));
        if (!eligible) { await Send("error", new { message = "No indexed sources match this selection and embedding model. Upload documents or reindex the selected sources." }); return; }
        var vector = await ollama.Embed(request.Question, true, timeout.Token);
        var evidence = store.Search(vector, options.EmbeddingModel, request.DocumentIds);
        await Send("sources", evidence);
        if (evidence.Count == 0) { await Send("token", new { text = "I could not find relevant evidence in the selected documents. Try a more specific question." }); await Send("done", new { }); return; }
        await foreach (var token in ollama.Chat(request.Question, request.History, evidence, timeout.Token)) await Send("token", new { text = token });
        await Send("done", new { });
    }
    catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
    catch (Exception e)
    {
        app.Logger.LogWarning("Chat failed: {ErrorType}", e.GetType().Name);
        if (!ct.IsCancellationRequested) await Send("error", new { message = "Local model request failed or timed out. Check Ollama and the configured models, then try again." });
    }
}).RequireRateLimiting("chat");
app.MapFallback((HttpContext context) => context.Request.Path.StartsWithSegments("/api") ? Results.NotFound() : File.Exists(Path.Combine(app.Environment.WebRootPath ?? "wwwroot", "index.html")) ? Results.File(Path.Combine(app.Environment.WebRootPath ?? "wwwroot", "index.html"), "text/html") : Results.NotFound(new { error = "Frontend not built. Run the Vite client or use Docker Compose." }));
app.Run();
