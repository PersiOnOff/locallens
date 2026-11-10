using Dapper;
using Microsoft.Data.Sqlite;
using System.Text.Json;
namespace LocalLens;

public sealed class KnowledgeStore
{
    readonly string connectionString;
    public KnowledgeStore(LensOptions options)
    {
        Directory.CreateDirectory(options.DataDirectory);
        connectionString = new SqliteConnectionStringBuilder { DataSource = Path.Combine(options.DataDirectory, "knowledge.db"), ForeignKeys = true }.ToString();
        using var db = Open();
        db.Execute("""
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS Documents (
                Id TEXT PRIMARY KEY, Name TEXT NOT NULL, Kind TEXT NOT NULL, GroupName TEXT NOT NULL,
                RelativePath TEXT NOT NULL, Content TEXT NOT NULL, PagesJson TEXT NOT NULL,
                Status TEXT NOT NULL, Error TEXT, Progress INTEGER NOT NULL, ChunkCount INTEGER NOT NULL,
                Size INTEGER NOT NULL, Model TEXT NOT NULL, CreatedAt TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS Chunks (
                Id TEXT PRIMARY KEY, DocumentId TEXT NOT NULL REFERENCES Documents(Id) ON DELETE CASCADE,
                Text TEXT NOT NULL, StartLine INTEGER NOT NULL, EndLine INTEGER NOT NULL, Page INTEGER, VectorJson TEXT NOT NULL);
            CREATE INDEX IF NOT EXISTS IX_Chunks_DocumentId ON Chunks(DocumentId);
            """);
    }
    SqliteConnection Open() { var db = new SqliteConnection(connectionString); db.Open(); return db; }
    public List<SourceDocument> List(bool includeContent = false)
    {
        using var db = Open();
        var columns = "Id,Name,Kind,GroupName,RelativePath,Status,Error,Progress,ChunkCount,Size,Model,CreatedAt" + (includeContent ? ",Content" : "");
        return db.Query<SourceDocument>($"SELECT {columns} FROM Documents ORDER BY CreatedAt DESC").ToList();
    }
    public SourceDocument? Get(string id) { using var db = Open(); return db.QuerySingleOrDefault<SourceDocument>("SELECT * FROM Documents WHERE Id=@id", new { id }); }
    public void Add(SourceDocument document)
    {
        using var db = Open(); using var tx = db.BeginTransaction();
        if (db.ExecuteScalar<int>("SELECT COUNT(*) FROM Documents", transaction: tx) >= LensOptions.MaxDocuments) throw new ArgumentException("Library limit reached (500 documents). Delete documents before adding more.");
        db.Execute("""
            INSERT INTO Documents VALUES (@Id,@Name,@Kind,@GroupName,@RelativePath,@Content,@PagesJson,@Status,@Error,@Progress,@ChunkCount,@Size,@Model,@CreatedAt)
            """, document, tx); tx.Commit();
    }
    public bool Delete(string id) { using var db = Open(); return db.Execute("DELETE FROM Documents WHERE Id=@id", new { id }) > 0; }
    public bool Retry(string id) { using var db = Open(); return db.Execute("UPDATE Documents SET Status='pending', Error=NULL, Progress=0, ChunkCount=0 WHERE Id=@id AND Status IN ('failed','ready')", new { id }) > 0; }
    public void Recover() { using var db = Open(); db.Execute("UPDATE Documents SET Status='pending', Progress=0 WHERE Status='indexing'"); }
    public SourceDocument? Claim()
    {
        using var db = Open(); using var tx = db.BeginTransaction();
        var doc = db.QueryFirstOrDefault<SourceDocument>("SELECT * FROM Documents WHERE Status='pending' ORDER BY CreatedAt LIMIT 1", transaction: tx);
        if (doc != null) db.Execute("UPDATE Documents SET Status='indexing', Progress=0, Error=NULL WHERE Id=@Id", doc, tx);
        tx.Commit(); return doc;
    }
    public void Progress(string id, int progress) { using var db = Open(); db.Execute("UPDATE Documents SET Progress=@progress WHERE Id=@id", new { id, progress }); }
    public void Fail(string id, string error) { using var db = Open(); db.Execute("UPDATE Documents SET Status='failed',Error=@error,Progress=0,ChunkCount=0 WHERE Id=@id", new { id, error }); }
    public void Complete(string id, List<StoredChunk> chunks, string model)
    {
        using var db = Open(); using var tx = db.BeginTransaction();
        if (db.ExecuteScalar<int>("SELECT COUNT(*) FROM Documents WHERE Id=@id", new { id }, tx) == 0) return;
        db.Execute("DELETE FROM Chunks WHERE DocumentId=@id", new { id }, tx);
        db.Execute("INSERT INTO Chunks VALUES (@Id,@DocumentId,@Text,@StartLine,@EndLine,@Page,@VectorJson)", chunks, tx);
        db.Execute("UPDATE Documents SET Status='ready',Progress=100,ChunkCount=@count,Model=@model,Error=NULL WHERE Id=@id", new { id, count = chunks.Count, model }, tx);
        tx.Commit();
    }
    public List<Evidence> Search(float[] vector, string model, string[]? documentIds, int count = 6)
    {
        using var db = Open();
        var rows = db.Query("""
            SELECT c.*, d.Name FROM Chunks c JOIN Documents d ON d.Id=c.DocumentId
            WHERE d.Status='ready' AND d.Model=@model
            """, new { model }, buffered: false);
        var selected = documentIds?.ToHashSet();
        var best = new PriorityQueue<Evidence, double>();
        foreach (var r in rows)
        {
            if (selected is { Count: > 0 } && !selected.Contains((string)r.DocumentId)) continue;
            var score = VectorMath.Cosine(vector, JsonSerializer.Deserialize<float[]>((string)r.VectorJson)!);
            if (score <= 0) continue;
            if (best.Count >= count && best.TryPeek(out _, out var lowest) && score <= lowest) continue;
            var evidence = new Evidence(0, (string)r.Id, (string)r.DocumentId, (string)r.Name, (string)r.Text, (int)(long)r.StartLine, (int)(long)r.EndLine, r.Page == null ? null : (int)(long)r.Page, score);
            best.Enqueue(evidence, score);
            if (best.Count > count) best.Dequeue();
        }
        return best.UnorderedItems.Select(item => item.Element).OrderByDescending(e => e.Score).Select((e, i) => e with { Number = i + 1 }).ToList();
    }
}
