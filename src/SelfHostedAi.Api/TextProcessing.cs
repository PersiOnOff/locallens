namespace LocalLens;

public record TextChunk(string Text, int StartLine, int EndLine, int? Page = null);
public static class TextProcessing
{
    public static List<TextChunk> Split(string text, int size = 1400, int overlap = 200)
    {
        if (size < 2 || overlap < 0 || overlap >= size) throw new ArgumentException("Invalid chunk limits.");
        if (string.IsNullOrWhiteSpace(text)) return [];
        text = text.Replace("\r\n", "\n").Replace('\r', '\n');
        var result = new List<TextChunk>();
        for (var start = 0; start < text.Length; start += size - overlap)
        {
            var end = Math.Min(start + size, text.Length);
            var line = 1 + text.AsSpan(0, start).Count('\n');
            result.Add(new(text[start..end], line, line + text.AsSpan(start, end - start).Count('\n')));
            if (end == text.Length) break;
        }
        return result;
    }
}
public static class VectorMath
{
    public static double Cosine(float[] a, float[] b)
    {
        if (a.Length == 0 || a.Length != b.Length) return 0;
        double dot = 0, aa = 0, bb = 0;
        for (var i = 0; i < a.Length; i++) { dot += (double)a[i] * b[i]; aa += (double)a[i] * a[i]; bb += (double)b[i] * b[i]; }
        var score = aa == 0 || bb == 0 ? 0 : dot / Math.Sqrt(aa * bb);
        return double.IsFinite(score) ? score : 0;
    }
}
