using System.Text.Json;
namespace LocalLens;

public sealed class IndexingWorker(KnowledgeStore store, OllamaService ollama, LensOptions options, ILogger<IndexingWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        store.Recover();
        while (!stoppingToken.IsCancellationRequested)
        {
            var doc = store.Claim();
            if (doc == null) { await Task.Delay(750, stoppingToken); continue; }
            try
            {
                var pages = JsonSerializer.Deserialize<List<string>>(doc.PagesJson) ?? [doc.Content];
                var chunks = new List<TextChunk>();
                for (var i = 0; i < pages.Count; i++) chunks.AddRange(TextProcessing.Split(pages[i]).Select(c => c with { Page = doc.Kind == "pdf" ? i + 1 : null }));
                if (chunks.Count == 0 || chunks.Count > 300) throw new ArgumentException("Document must contain between 1 and 300 text chunks. Split it into smaller files.");
                var stored = new List<StoredChunk>();
                foreach (var chunk in chunks)
                {
                    stoppingToken.ThrowIfCancellationRequested();
                    if (store.Get(doc.Id) == null) break;
                    var vector = await ollama.Embed(chunk.Text, false, stoppingToken);
                    stored.Add(new(Guid.NewGuid().ToString("N"), doc.Id, chunk.Text, chunk.StartLine, chunk.EndLine, chunk.Page, JsonSerializer.Serialize(vector)));
                    store.Progress(doc.Id, stored.Count * 100 / chunks.Count);
                }
                store.Complete(doc.Id, stored, options.EmbeddingModel);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception e)
            {
                logger.LogWarning("Indexing failed for source {SourceId}: {ErrorType}", doc.Id, e.GetType().Name);
                store.Fail(doc.Id, e is ArgumentException ? e.Message : "Indexing failed. Check that Ollama is running and the embedding model is downloaded, then retry.");
            }
        }
    }
}
