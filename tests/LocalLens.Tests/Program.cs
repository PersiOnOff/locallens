using LocalLens;

var failed = 0;
void Check(string name, Action test) { try { test(); Console.WriteLine($"PASS {name}"); } catch (Exception e) { failed++; Console.WriteLine($"FAIL {name}: {e.Message}"); } }
void Assert(bool ok, string message) { if (!ok) throw new Exception(message); }
Check("chunks cover all text with overlap and source lines", () =>
{
    var text = string.Join("\n", Enumerable.Range(1, 40).Select(i => $"line {i:00} abcdefghijklmnopqrstuvwxyz"));
    var chunks = TextProcessing.Split(text, 200, 40);
    Assert(chunks.Count > 1, "long text must be split");
    Assert(chunks[0].StartLine == 1 && chunks[^1].EndLine == 40, "line references must cover input");
    Assert(chunks.All(c => c.Text.Length <= 200), "chunk size is bounded");
    Assert(chunks[0].Text[^40..] == chunks[1].Text[..40], "adjacent chunks overlap");
    Assert(TextProcessing.Split("  \n ").Count == 0, "blank content produces no chunks");
});
Check("cosine ranks relevant vectors and rejects mismatch", () =>
{
    Assert(Math.Abs(VectorMath.Cosine([1, 0], [1, 0]) - 1) < 0.0001, "identical vectors score 1");
    Assert(VectorMath.Cosine([1, 0], [1, 0]) > VectorMath.Cosine([1, 0], [0, 1]), "relevant vector ranks first");
    Assert(VectorMath.Cosine([1, 0], [1]) == 0, "different dimensions excluded");
    Assert(VectorMath.Cosine([0, 0], [1, 0]) == 0, "zero vector safe");
    Assert(VectorMath.Cosine([float.NaN, 1], [1, 0]) == 0, "non-finite vector safe");
});
Check("repository confinement rejects traversal and private paths", () =>
{
    var root = Path.Combine(AppContext.BaseDirectory, "locallens-path-test");
    Directory.CreateDirectory(root);
    Assert(RepositoryScanner.Resolve(root, "sub") == Path.Combine(root, "sub"), "valid child allowed");
    try { RepositoryScanner.Resolve(root, "../escape"); throw new Exception("escaped root"); } catch (ArgumentException) { }
    Assert(!RepositoryScanner.IsSupported(".env") && !RepositoryScanner.IsSupported("secret.pem"), "secrets excluded");
    Assert(RepositoryScanner.IsSupported("readme.md") && RepositoryScanner.IsSupported("main.cs"), "code and docs accepted");
});
Check("SQLite isolates embedding models, persists and deletes evidence", () =>
{
    var path = Path.Combine(AppContext.BaseDirectory, "store-tests", Guid.NewGuid().ToString("N"));
    var options = new LensOptions { DataDirectory = path };
    var store = new KnowledgeStore(options);
    var doc = new SourceDocument { Name = "policy.md", Content = "Refunds within 30 days" };
    store.Add(doc);
    Assert(store.List().Single().Content == "", "metadata polling must not load document text");
    Assert(store.Claim()?.Id == doc.Id, "worker claims queued source");
    store.Complete(doc.Id, [new("chunk-one", doc.Id, "Refunds within 30 days", 1, 1, null, "[1,0]")], "model-a");
    Assert(store.Search([1, 0], "model-a", null).Single().Text == "Refunds within 30 days", "stored evidence returned");
    Assert(store.Search([1, 0], "model-b", null).Count == 0, "other embedding model excluded");
    Assert(store.Search([1, 0], "model-a", ["another-source"]).Count == 0, "selected sources enforced");
    Assert(new KnowledgeStore(options).Get(doc.Id)?.Status == "ready", "state persists");
    Assert(store.Retry(doc.Id), "ready source can be reindexed");
    Assert(store.Search([1, 0], "model-a", null).Count == 0, "pending source never searched");
    store.Claim(); store.Recover();
    Assert(store.Get(doc.Id)?.Status == "pending", "restart recovers in-progress job");
    store.Delete(doc.Id);
    Assert(store.Get(doc.Id) == null && store.Search([1, 0], "model-a", null).Count == 0, "delete removes evidence");
});
Environment.ExitCode = failed == 0 ? 0 : 1;
