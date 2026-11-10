namespace LocalLens;

public static class RepositoryScanner
{
    static readonly HashSet<string> Extensions = new(StringComparer.OrdinalIgnoreCase) { ".md", ".txt", ".pdf", ".cs", ".tsx", ".ts", ".jsx", ".js", ".py", ".java", ".go", ".rs", ".html", ".css", ".sql", ".json", ".yaml", ".yml", ".xml", ".sh", ".dockerfile", ".csproj" };
    static readonly HashSet<string> Ignored = new(StringComparer.OrdinalIgnoreCase) { ".git", ".svn", "node_modules", "bin", "obj", "dist", "build", "vendor", ".venv", "venv", "__pycache__", ".idea", ".vs", ".vscode", "data", ".tools" };
    public static bool IsSupported(string name)
    {
        var file = Path.GetFileName(name);
        return !file.StartsWith('.') && !file.Contains("secret", StringComparison.OrdinalIgnoreCase)
            && !file.Contains("credential", StringComparison.OrdinalIgnoreCase) && !file.Contains("lock", StringComparison.OrdinalIgnoreCase)
            && !file.Equals("appsettings.Development.json", StringComparison.OrdinalIgnoreCase)
            && Extensions.Contains(Path.GetExtension(file));
    }
    public static string Resolve(string root, string relative)
    {
        root = Path.GetFullPath(root);
        if (Path.IsPathRooted(relative)) throw new ArgumentException("Use a path relative to the configured repository root.");
        var full = Path.GetFullPath(Path.Combine(root, relative));
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        if (full != root && !full.StartsWith(root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, comparison)) throw new ArgumentException("Path must stay inside the configured root.");
        var current = new DirectoryInfo(full);
        while (current != null)
        {
            if (current.Exists && (current.Attributes & FileAttributes.ReparsePoint) != 0) throw new ArgumentException("Symlink directories are not allowed.");
            if (string.Equals(current.FullName, root, comparison)) break;
            current = current.Parent;
        }
        return full;
    }
    public static IEnumerable<string> Files(string path)
    {
        foreach (var file in Directory.EnumerateFiles(path))
            if ((File.GetAttributes(file) & FileAttributes.ReparsePoint) == 0 && IsSupported(file)) yield return file;
        foreach (var dir in Directory.EnumerateDirectories(path))
            if (!Ignored.Contains(Path.GetFileName(dir)) && !Path.GetFileName(dir).StartsWith('.') && (File.GetAttributes(dir) & FileAttributes.ReparsePoint) == 0)
                foreach (var file in Files(dir)) yield return file;
    }
}
