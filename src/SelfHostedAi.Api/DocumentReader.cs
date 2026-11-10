using System.Text;
using System.Text.Json;
using UglyToad.PdfPig;
using UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor;
namespace LocalLens;

public static class DocumentReader
{
    public static SourceDocument Read(string name, byte[] bytes, string group = "Uploads", string? relativePath = null)
    {
        name = Path.GetFileName(name.Replace('\\', '/'));
        if (string.IsNullOrWhiteSpace(name) || name.Length > 200 || !RepositoryScanner.IsSupported(name)) throw new ArgumentException("Unsupported file. Use PDF, Markdown, text or source code (secret and lock files are excluded).");
        if (bytes.Length == 0 || bytes.LongLength > LensOptions.MaxUploadBytes) throw new ArgumentException("File must be between 1 byte and 20 MB.");
        var pages = new List<string>();
        var isPdf = Path.GetExtension(name).Equals(".pdf", StringComparison.OrdinalIgnoreCase);
        if (isPdf)
        {
            try
            {
                using var pdf = PdfDocument.Open(bytes);
                if (pdf.NumberOfPages > 500) throw new ArgumentException("PDF limit: 500 pages.");
                var length = 0;
                foreach (var page in pdf.GetPages())
                {
                    var text = ContentOrderTextExtractor.GetText(page);
                    length += text.Length;
                    if (length > LensOptions.MaxCharacters) throw new ArgumentException("Document exceeds 300,000 extracted characters. Split it into smaller files.");
                    pages.Add(text);
                }
            }
            catch (ArgumentException) { throw; }
            catch (Exception e) when (e is not OutOfMemoryException) { throw new ArgumentException("Cannot read this PDF. Check that it is valid and not password-protected.", e); }
        }
        else
        {
            string text;
            try { text = new UTF8Encoding(false, true).GetString(bytes).TrimStart('\uFEFF'); }
            catch (DecoderFallbackException) { throw new ArgumentException("Text files must use UTF-8 encoding."); }
            if (text.Contains('\0')) throw new ArgumentException("Binary files cannot be indexed.");
            if (text.Length > LensOptions.MaxCharacters) throw new ArgumentException("Document exceeds 300,000 characters. Split it into smaller files.");
            pages.Add(text);
        }
        var content = string.Join("\n\n", pages);
        if (string.IsNullOrWhiteSpace(content)) throw new ArgumentException(isPdf ? "This PDF has no extractable text. Run OCR before uploading it." : "Document contains no text.");
        return new SourceDocument { Name = name, Kind = isPdf ? "pdf" : Path.GetExtension(name).TrimStart('.').ToLowerInvariant(), Content = content, PagesJson = JsonSerializer.Serialize(pages), GroupName = group, RelativePath = relativePath ?? name, Size = bytes.LongLength };
    }
}
