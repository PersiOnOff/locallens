namespace LocalLens;

public class SourceDocument
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = "";
    public string Kind { get; set; } = "";
    public string GroupName { get; set; } = "Uploads";
    public string RelativePath { get; set; } = "";
    public string Content { get; set; } = "";
    public string PagesJson { get; set; } = "[]";
    public string Status { get; set; } = "pending";
    public string? Error { get; set; }
    public int Progress { get; set; }
    public int ChunkCount { get; set; }
    public long Size { get; set; }
    public string Model { get; set; } = "";
    public string CreatedAt { get; set; } = DateTimeOffset.UtcNow.ToString("O");
}
public record StoredChunk(string Id, string DocumentId, string Text, int StartLine, int EndLine, int? Page, string VectorJson);
public record Evidence(int Number, string ChunkId, string DocumentId, string Name, string Text, int StartLine, int EndLine, int? Page, double Score);
public record HistoryMessage(string Role, string Content);
public record ChatRequest(string Question, string[]? DocumentIds, HistoryMessage[]? History);
public record RepositoryRequest(string Path);
public class LensOptions
{
    public string DataDirectory { get; set; } = "data";
    public string RepositoryRoot { get; set; } = "repositories";
    public string OllamaUrl { get; set; } = "http://localhost:11434";
    public string ChatModel { get; set; } = "qwen2.5:3b";
    public string EmbeddingModel { get; set; } = "nomic-embed-text";
    public const long MaxUploadBytes = 20 * 1024 * 1024;
    public const int MaxCharacters = 300_000;
    public const int MaxDocuments = 500;
}
