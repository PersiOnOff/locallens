using System.Text.RegularExpressions;
namespace LocalLens;

public static partial class FileGraph
{
    [GeneratedRegex("(?:from\\s*['\"](?<path>[^'\"]+)['\"]|(?:import|require)\\s*\\(?\\s*['\"](?<path>[^'\"]+)['\"]|\\]\\((?<path>[^) #]+)(?:#[^)]*)?\\))")]
    private static partial Regex Links();
    public static object Build(List<SourceDocument> documents)
    {
        var edges = new HashSet<(string Source, string Target)>();
        foreach (var doc in documents)
        {
            var directory = Path.GetDirectoryName(doc.RelativePath.Replace('/', Path.DirectorySeparatorChar)) ?? "";
            foreach (Match match in Links().Matches(doc.Content))
            {
                var link = match.Groups["path"].Value;
                if (Uri.TryCreate(link, UriKind.Absolute, out _) || link.StartsWith('/')) continue;
                var targetPath = Path.GetFullPath(Path.Combine(Path.GetTempPath(), "locallens-graph", directory, link));
                var target = documents.FirstOrDefault(d => d.Id != doc.Id && d.GroupName == doc.GroupName &&
                    (Path.GetFullPath(Path.Combine(Path.GetTempPath(), "locallens-graph", d.RelativePath)) == targetPath ||
                     Path.ChangeExtension(Path.GetFullPath(Path.Combine(Path.GetTempPath(), "locallens-graph", d.RelativePath)), null) == targetPath));
                if (target != null) edges.Add((doc.Id, target.Id));
            }
        }
        return new { nodes = documents.Select(d => new { id = d.Id, label = d.Name, kind = d.Kind, group = d.GroupName, status = d.Status }), edges = edges.Select(e => new { source = e.Source, target = e.Target }) };
    }
}
