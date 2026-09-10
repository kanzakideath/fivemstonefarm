using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

internal static class Updater
{
    private const string Product = "kanzakideath/fivemstonefarm";
    private const string Channel = "stable";
    private const string UpdaterVersion = "5.2.0";
    private const string ArtifactName = "ai-miner-win-x64.exe";
    private const string LatestManifestUrl = "https://github.com/kanzakideath/fivemstonefarm/releases/latest/download/update-manifest.json";
    private const string LatestSignatureUrl = "https://github.com/kanzakideath/fivemstonefarm/releases/latest/download/update-manifest.sig";
    private const string PublicKeyBlobBase64 = "RUNTMSAAAADNPm0f29gN5/Z64LDW7PPhoHTASFEmisabIQLTSUGQB7/esquq63IysJ3zsy57FPrv/wDF6vFVUtjw6epa1nMz";

    private const int ManifestLimit = 64 * 1024;
    private const int SignatureLimit = 1024;
    private const long MinimumArtifactSize = 1;
    private const long MaximumArtifactSize = 30L * 1024L * 1024L;
    private const int NetworkTimeoutMilliseconds = 15000;
    private const int ParentExitTimeoutMilliseconds = 30000;
    // A cold WebView2 start can exceed 30 seconds on a busy GTA/FiveM machine.
    // Build validation already uses the same 60-second budget.
    private const int ValidationTimeoutMilliseconds = 60000;

    private const int MoveFileReplaceExisting = 0x1;
    private const int MoveFileDelayUntilReboot = 0x4;
    private const int MoveFileWriteThrough = 0x8;

    private static readonly Encoding Utf8NoBom = new UTF8Encoding(false, true);
    private static readonly Regex SemVerRegex = new Regex(
        @"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$",
        RegexOptions.CultureInvariant);
    private static readonly Regex LowerHexSha256Regex = new Regex(@"^[0-9a-f]{64}$", RegexOptions.CultureInvariant);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool MoveFileEx(string existingFileName, string newFileName, int flags);

    [STAThread]
    private static int Main(string[] args)
    {
        ServicePointManager.SecurityProtocol |= (SecurityProtocolType)3072;

        if (args == null || args.Length == 0)
        {
            Log("No command supplied.");
            return 64;
        }

        string command = args[0].Trim().ToLowerInvariant();
        try
        {
            if (command == "capabilities")
                return RunCapabilities(args);
            if (command == "check")
                return RunCheck(args);
            if (command == "download")
                return RunDownload(args);
            if (command == "apply")
                return RunApply(args);

            Log("Unknown command: " + SafeForLog(command));
            return 64;
        }
        catch (Exception ex)
        {
            Log("Unhandled error in " + SafeForLog(command) + ": " + SafeForLog(ex.Message));
            return 1;
        }
    }

    private static int RunCapabilities(string[] args)
    {
        if (args.Length != 2)
            return 64;

        try
        {
            AtomicWriteText(args[1], "UPDATE_CAPS 1 CHECK DOWNLOAD APPLY\r\n");
            return 0;
        }
        catch (Exception ex)
        {
            Log("Capabilities result write failed: " + SafeForLog(ex.Message));
            return 1;
        }
    }

    private static int RunCheck(string[] args)
    {
        if (args.Length != 4)
        {
            TryWriteCheckError(args, "Invalid arguments.");
            return 64;
        }

        string resultPath = args[1];
        try
        {
            SemanticVersion currentVersion = SemanticVersion.Parse(args[2]);
            string stagingDirectory = EnsureSafeStagingDirectory(args[3]);
            Log("Checking the stable release channel for version " + currentVersion.Original + ".");

            byte[] manifestBytes;
            try
            {
                manifestBytes = DownloadBytes(LatestManifestUrl, ManifestLimit, true);
            }
            catch (HttpStatusException ex)
            {
                if (ex.StatusCode == HttpStatusCode.NotFound)
                {
                    WriteCheckResult(resultPath, "NOT_PUBLISHED", "", "", "", "", "No published update is available yet.");
                    Log("The latest release manifest is not published.");
                    return 0;
                }
                throw;
            }

            byte[] signatureBytes;
            try
            {
                signatureBytes = DownloadBytes(LatestSignatureUrl, SignatureLimit, true);
            }
            catch (HttpStatusException ex)
            {
                if (ex.StatusCode == HttpStatusCode.NotFound)
                    throw new InvalidDataException("The release is missing its signature asset.");
                throw;
            }

            UpdateManifest manifest = VerifyAndParseManifest(manifestBytes, signatureBytes);
            string manifestPath = Path.Combine(stagingDirectory, "update-manifest.json");
            string signaturePath = Path.Combine(stagingDirectory, "update-manifest.sig");
            AtomicWriteBytes(manifestPath, manifestBytes);
            AtomicWriteBytes(signaturePath, signatureBytes);

            string status = manifest.Version.CompareTo(currentVersion) > 0 ? "UPDATE_AVAILABLE" : "UP_TO_DATE";
            string message = status == "UPDATE_AVAILABLE" ? "A verified update is available." : "The application is up to date.";
            WriteCheckResult(resultPath, status, manifest.Version.Original, manifestPath, signaturePath, manifest.ReleaseNotesUrl, message);
            Log(status + ": " + manifest.Version.Original + ".");
            return 0;
        }
        catch (Exception ex)
        {
            WriteCheckResultSafely(resultPath, "ERROR", "", "", "", "", PublicError(ex));
            Log("Update check failed: " + SafeForLog(ex.Message));
            return 1;
        }
    }

    private static int RunDownload(string[] args)
    {
        if (args.Length != 5)
        {
            TryWriteDownloadError(args, "Invalid arguments.");
            return 64;
        }

        string resultPath = args[1];
        try
        {
            string manifestPath = EnsureSafeStagingFile(args[2], ".json", true);
            string signaturePath = EnsureSafeStagingFile(args[3], ".sig", true);
            string stagedExecutablePath = EnsureSafeStagingFile(args[4], ".exe", false);
            if (PathsEqual(stagedExecutablePath, manifestPath) || PathsEqual(stagedExecutablePath, signaturePath))
                throw new InvalidDataException("The staged executable path conflicts with update metadata.");

            UpdateManifest manifest = VerifyAndParseManifest(
                ReadAllBytesLimited(manifestPath, ManifestLimit),
                ReadAllBytesLimited(signaturePath, SignatureLimit));

            Log("Downloading verified update " + manifest.Version.Original + ".");
            byte[] executableBytes = DownloadBytes(manifest.ArtifactUrl, checked((int)MaximumArtifactSize), false);
            ValidateArtifactBytes(executableBytes, manifest);
            AtomicWriteBytes(stagedExecutablePath, executableBytes);
            ValidateArtifactFile(stagedExecutablePath, manifest);

            WriteDownloadResult(resultPath, "DOWNLOADED", manifest.Version.Original, stagedExecutablePath, "The update was downloaded and verified.");
            Log("Update download completed: " + manifest.Version.Original + ".");
            return 0;
        }
        catch (Exception ex)
        {
            WriteDownloadResultSafely(resultPath, "ERROR", "", "", PublicError(ex));
            Log("Update download failed: " + SafeForLog(ex.Message));
            return 1;
        }
    }

    private static int RunApply(string[] args)
    {
        if (args.Length != 6)
            return 64;

        int parentProcessId;
        if (!Int32.TryParse(args[1], NumberStyles.None, CultureInfo.InvariantCulture, out parentProcessId) || parentProcessId <= 0 || parentProcessId == Process.GetCurrentProcess().Id)
        {
            Log("Apply rejected an invalid parent process id.");
            return 64;
        }

        string targetPath = null;
        string backupPath = null;
        string candidatePath = null;
        bool replacementStarted = false;
        bool updateValidated = false;

        try
        {
            string manifestPath = EnsureSafeStagingFile(args[2], ".json", true);
            string signaturePath = EnsureSafeStagingFile(args[3], ".sig", true);
            string stagedExecutablePath = EnsureSafeStagingFile(args[4], ".exe", true);
            targetPath = EnsureSafeTargetExecutable(args[5]);

            if (PathsEqual(targetPath, stagedExecutablePath) || PathsEqual(targetPath, Process.GetCurrentProcess().MainModule.FileName))
                throw new InvalidDataException("The update target path is unsafe.");

            UpdateManifest manifest = VerifyAndParseManifest(
                ReadAllBytesLimited(manifestPath, ManifestLimit),
                ReadAllBytesLimited(signaturePath, SignatureLimit));
            ValidateArtifactFile(stagedExecutablePath, manifest);

            WaitForParentExit(parentProcessId);

            string targetDirectory = Path.GetDirectoryName(targetPath);
            string targetFileName = Path.GetFileName(targetPath);
            string suffix = DateTime.UtcNow.ToString("yyyyMMddHHmmssfff", CultureInfo.InvariantCulture) + "-" + Process.GetCurrentProcess().Id.ToString(CultureInfo.InvariantCulture);
            candidatePath = Path.Combine(targetDirectory, "." + targetFileName + ".candidate-" + suffix + ".tmp");
            backupPath = Path.Combine(targetDirectory, "." + targetFileName + ".backup-" + suffix + ".tmp");

            File.Copy(stagedExecutablePath, candidatePath, false);
            ValidateArtifactFile(candidatePath, manifest);
            replacementStarted = true;
            ReplaceExecutable(candidatePath, targetPath, backupPath);
            candidatePath = null;

            ValidateUpdatedApplication(targetPath);
            updateValidated = true;

            TryDeleteFile(backupPath);
            backupPath = null;
            TryDeleteFile(stagedExecutablePath);
            TryDeleteFile(manifestPath);
            TryDeleteFile(signaturePath);
            TryDeleteEmptyParent(Path.GetDirectoryName(stagedExecutablePath));

            Log("Update applied successfully: " + manifest.Version.Original + ".");
            LaunchApplication(targetPath, "--updated");
            ScheduleSelfDeletion();
            return 0;
        }
        catch (Exception ex)
        {
            Log("Update apply failed: " + SafeForLog(ex.Message));
            if (replacementStarted && !updateValidated && targetPath != null && backupPath != null)
            {
                try
                {
                    RollBackExecutable(targetPath, backupPath);
                    backupPath = null;
                    Log("The previous application executable was restored.");
                }
                catch (Exception rollbackError)
                {
                    Log("Rollback failed: " + SafeForLog(rollbackError.Message));
                }
            }

            TryDeleteFile(candidatePath);
            if (targetPath != null && File.Exists(targetPath))
                TryLaunchApplication(targetPath, "--update-failed");
            ScheduleSelfDeletion();
            return 1;
        }
    }

    private static UpdateManifest VerifyAndParseManifest(byte[] manifestBytes, byte[] signatureFileBytes)
    {
        if (manifestBytes == null || manifestBytes.Length == 0 || manifestBytes.Length > ManifestLimit)
            throw new InvalidDataException("The update manifest has an invalid size.");
        if (signatureFileBytes == null || signatureFileBytes.Length == 0 || signatureFileBytes.Length > SignatureLimit)
            throw new InvalidDataException("The update signature has an invalid size.");
        if (manifestBytes.Length >= 3 && manifestBytes[0] == 0xEF && manifestBytes[1] == 0xBB && manifestBytes[2] == 0xBF)
            throw new InvalidDataException("The update manifest must be UTF-8 without a byte-order mark.");

        string json;
        try
        {
            json = Utf8NoBom.GetString(manifestBytes);
        }
        catch (DecoderFallbackException)
        {
            throw new InvalidDataException("The update manifest is not valid UTF-8.");
        }

        byte[] signature = ParseSignatureFile(signatureFileBytes);
        if (!VerifySignature(manifestBytes, signature))
            throw new CryptographicException("The update signature is invalid.");

        Dictionary<string, object> root;
        try
        {
            object parsed = new JavaScriptSerializer().DeserializeObject(json);
            root = parsed as Dictionary<string, object>;
        }
        catch (Exception ex)
        {
            throw new InvalidDataException("The update manifest is not valid JSON.", ex);
        }
        if (root == null)
            throw new InvalidDataException("The update manifest root must be an object.");

        EnsureOnlyKeys(root, "schema", "product", "channel", "version", "publishedAt", "minimumUpdaterVersion", "artifact", "releaseNotesUrl");
        if (GetInteger(root, "schema") != 1)
            throw new InvalidDataException("The update manifest schema is unsupported.");
        if (!String.Equals(GetString(root, "product"), Product, StringComparison.Ordinal))
            throw new InvalidDataException("The update manifest product is invalid.");
        if (!String.Equals(GetString(root, "channel"), Channel, StringComparison.Ordinal))
            throw new InvalidDataException("The update manifest channel is invalid.");

        SemanticVersion version = SemanticVersion.Parse(GetString(root, "version"));
        SemanticVersion minimumUpdaterVersion = SemanticVersion.Parse(GetString(root, "minimumUpdaterVersion"));
        if (minimumUpdaterVersion.CompareTo(SemanticVersion.Parse(UpdaterVersion)) > 0)
            throw new InvalidDataException("This updater is too old for the published update.");

        string publishedAt = GetString(root, "publishedAt");
        ValidatePublishedAt(publishedAt);

        Dictionary<string, object> artifact = GetObject(root, "artifact");
        EnsureOnlyKeys(artifact, "name", "url", "size", "sha256");
        string artifactName = GetString(artifact, "name");
        string artifactUrl = GetString(artifact, "url");
        long artifactSize = GetInteger(artifact, "size");
        string artifactSha256 = GetString(artifact, "sha256");
        string releaseNotesUrl = GetString(root, "releaseNotesUrl");

        if (!String.Equals(artifactName, ArtifactName, StringComparison.Ordinal))
            throw new InvalidDataException("The update artifact name is invalid.");
        if (artifactSize < MinimumArtifactSize || artifactSize > MaximumArtifactSize)
            throw new InvalidDataException("The update artifact size is outside the allowed range.");
        if (!LowerHexSha256Regex.IsMatch(artifactSha256))
            throw new InvalidDataException("The update artifact SHA-256 is invalid.");

        string expectedArtifactUrl = "https://github.com/kanzakideath/fivemstonefarm/releases/download/v" + version.Original + "/" + ArtifactName;
        string expectedNotesUrl = "https://github.com/kanzakideath/fivemstonefarm/releases/tag/v" + version.Original;
        if (!String.Equals(artifactUrl, expectedArtifactUrl, StringComparison.Ordinal))
            throw new InvalidDataException("The update artifact URL is not allowed.");
        if (!String.Equals(releaseNotesUrl, expectedNotesUrl, StringComparison.Ordinal))
            throw new InvalidDataException("The release notes URL is not allowed.");
        ValidateInitialDownloadUrl(artifactUrl, false);
        ValidateReleaseNotesUrl(releaseNotesUrl);

        UpdateManifest result = new UpdateManifest();
        result.Version = version;
        result.PublishedAt = publishedAt;
        result.MinimumUpdaterVersion = minimumUpdaterVersion;
        result.ArtifactName = artifactName;
        result.ArtifactUrl = artifactUrl;
        result.ArtifactSize = artifactSize;
        result.ArtifactSha256 = artifactSha256;
        result.ReleaseNotesUrl = releaseNotesUrl;
        return result;
    }

    private static byte[] ParseSignatureFile(byte[] signatureFileBytes)
    {
        for (int i = 0; i < signatureFileBytes.Length; i++)
        {
            byte value = signatureFileBytes[i];
            if (value > 0x7F)
                throw new InvalidDataException("The update signature file is not ASCII base64 text.");
        }

        string text = Encoding.ASCII.GetString(signatureFileBytes).Trim();
        if (text.Length == 0 || Regex.IsMatch(text, @"\s", RegexOptions.CultureInvariant))
            throw new InvalidDataException("The update signature file has invalid whitespace.");

        byte[] signature;
        try
        {
            signature = Convert.FromBase64String(text);
        }
        catch (FormatException ex)
        {
            throw new InvalidDataException("The update signature is not valid base64.", ex);
        }
        if (signature.Length != 64)
            throw new InvalidDataException("The update signature is not a P-256 P1363 signature.");
        return signature;
    }

    private static bool VerifySignature(byte[] manifestBytes, byte[] signature)
    {
        byte[] publicBlob = Convert.FromBase64String(PublicKeyBlobBase64);
        using (CngKey key = CngKey.Import(publicBlob, CngKeyBlobFormat.EccPublicBlob))
        using (ECDsaCng verifier = new ECDsaCng(key))
        {
            verifier.HashAlgorithm = CngAlgorithm.Sha256;
            return verifier.VerifyData(manifestBytes, signature);
        }
    }

    private static byte[] DownloadBytes(string url, int maximumBytes, bool metadataDownload)
    {
        ValidateInitialDownloadUrl(url, metadataDownload);
        HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
        request.Method = "GET";
        request.AllowAutoRedirect = true;
        request.MaximumAutomaticRedirections = 5;
        request.Timeout = NetworkTimeoutMilliseconds;
        request.ReadWriteTimeout = NetworkTimeoutMilliseconds;
        request.UserAgent = "AI-Miner-Updater/" + UpdaterVersion;
        request.AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate;
        request.Headers[HttpRequestHeader.AcceptEncoding] = "gzip, deflate";
        request.Accept = metadataDownload ? "application/octet-stream, application/json;q=0.9, text/plain;q=0.8" : "application/octet-stream";

        try
        {
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            {
                if (response.StatusCode != HttpStatusCode.OK)
                    throw new HttpStatusException(response.StatusCode, "The update server returned HTTP " + ((int)response.StatusCode).ToString(CultureInfo.InvariantCulture) + ".");
                ValidateRedirectedDownloadUrl(response.ResponseUri);
                if (response.ContentLength > maximumBytes)
                    throw new InvalidDataException("The downloaded update file is too large.");

                using (Stream input = response.GetResponseStream())
                using (MemoryStream output = new MemoryStream())
                {
                    byte[] buffer = new byte[32768];
                    int total = 0;
                    while (true)
                    {
                        int read = input.Read(buffer, 0, buffer.Length);
                        if (read == 0)
                            break;
                        total = checked(total + read);
                        if (total > maximumBytes)
                            throw new InvalidDataException("The downloaded update file is too large.");
                        output.Write(buffer, 0, read);
                    }
                    return output.ToArray();
                }
            }
        }
        catch (WebException ex)
        {
            HttpWebResponse response = ex.Response as HttpWebResponse;
            if (response != null)
            {
                HttpStatusCode code = response.StatusCode;
                response.Dispose();
                throw new HttpStatusException(code, "The update server returned HTTP " + ((int)code).ToString(CultureInfo.InvariantCulture) + ".", ex);
            }
            throw new IOException("The update server could not be reached.", ex);
        }
    }

    private static void ValidateInitialDownloadUrl(string url, bool metadataDownload)
    {
        if (metadataDownload)
        {
            if (!String.Equals(url, LatestManifestUrl, StringComparison.Ordinal) && !String.Equals(url, LatestSignatureUrl, StringComparison.Ordinal))
                throw new InvalidDataException("The update metadata URL is not allowed.");
        }
        else if (!url.StartsWith("https://github.com/kanzakideath/fivemstonefarm/releases/download/v", StringComparison.Ordinal) || !url.EndsWith("/" + ArtifactName, StringComparison.Ordinal))
        {
            throw new InvalidDataException("The update artifact URL is not allowed.");
        }

        Uri uri;
        if (!Uri.TryCreate(url, UriKind.Absolute, out uri) || !String.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ||
            !String.Equals(uri.Host, "github.com", StringComparison.OrdinalIgnoreCase) || !uri.IsDefaultPort ||
            !String.IsNullOrEmpty(uri.UserInfo) || !String.IsNullOrEmpty(uri.Query) || !String.IsNullOrEmpty(uri.Fragment))
            throw new InvalidDataException("The update URL is invalid.");
    }

    private static void ValidateRedirectedDownloadUrl(Uri uri)
    {
        if (uri == null || !String.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) || !uri.IsDefaultPort || !String.IsNullOrEmpty(uri.UserInfo))
            throw new InvalidDataException("The update server redirected to an unsafe URL.");

        string host = uri.Host;
        bool allowed = String.Equals(host, "github.com", StringComparison.OrdinalIgnoreCase) ||
                       String.Equals(host, "objects.githubusercontent.com", StringComparison.OrdinalIgnoreCase) ||
                       String.Equals(host, "release-assets.githubusercontent.com", StringComparison.OrdinalIgnoreCase) ||
                       String.Equals(host, "github-releases.githubusercontent.com", StringComparison.OrdinalIgnoreCase);
        if (!allowed)
            throw new InvalidDataException("The update server redirected to an untrusted host.");
    }

    private static void ValidateReleaseNotesUrl(string url)
    {
        Uri uri;
        if (!Uri.TryCreate(url, UriKind.Absolute, out uri) || !String.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ||
            !String.Equals(uri.Host, "github.com", StringComparison.OrdinalIgnoreCase) || !uri.IsDefaultPort ||
            !String.IsNullOrEmpty(uri.UserInfo) || !String.IsNullOrEmpty(uri.Query) || !String.IsNullOrEmpty(uri.Fragment))
            throw new InvalidDataException("The release notes URL is invalid.");
    }

    private static void ValidateArtifactBytes(byte[] bytes, UpdateManifest manifest)
    {
        if (bytes == null || bytes.LongLength != manifest.ArtifactSize)
            throw new InvalidDataException("The downloaded update size does not match the signed manifest.");
        string actualHash = ComputeSha256(bytes);
        if (!FixedTimeHexEquals(actualHash, manifest.ArtifactSha256))
            throw new CryptographicException("The downloaded update SHA-256 does not match the signed manifest.");
    }

    private static void ValidateArtifactFile(string path, UpdateManifest manifest)
    {
        FileInfo info = new FileInfo(path);
        if (!info.Exists || info.Length != manifest.ArtifactSize || info.Length < MinimumArtifactSize || info.Length > MaximumArtifactSize)
            throw new InvalidDataException("The staged update size does not match the signed manifest.");
        string actualHash = ComputeSha256(path);
        if (!FixedTimeHexEquals(actualHash, manifest.ArtifactSha256))
            throw new CryptographicException("The staged update SHA-256 does not match the signed manifest.");
    }

    private static string ComputeSha256(byte[] bytes)
    {
        using (SHA256 sha = SHA256.Create())
            return BytesToLowerHex(sha.ComputeHash(bytes));
    }

    private static string ComputeSha256(string path)
    {
        using (FileStream stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read))
        using (SHA256 sha = SHA256.Create())
            return BytesToLowerHex(sha.ComputeHash(stream));
    }

    private static string BytesToLowerHex(byte[] bytes)
    {
        StringBuilder result = new StringBuilder(bytes.Length * 2);
        for (int i = 0; i < bytes.Length; i++)
            result.Append(bytes[i].ToString("x2", CultureInfo.InvariantCulture));
        return result.ToString();
    }

    private static bool FixedTimeHexEquals(string left, string right)
    {
        if (left == null || right == null || left.Length != right.Length)
            return false;
        int difference = 0;
        for (int i = 0; i < left.Length; i++)
            difference |= left[i] ^ right[i];
        return difference == 0;
    }

    private static string EnsureSafeStagingDirectory(string requestedPath)
    {
        string baseDirectory = GetUpdateBaseDirectory();
        Directory.CreateDirectory(baseDirectory);
        string fullPath = Path.GetFullPath(requestedPath);
        if (!IsUnderDirectory(fullPath, baseDirectory))
            throw new InvalidDataException("The staging directory must be inside the application's local update directory.");
        Directory.CreateDirectory(fullPath);
        EnsureNoReparsePoint(fullPath, baseDirectory);
        return fullPath;
    }

    private static string EnsureSafeStagingFile(string requestedPath, string requiredExtension, bool mustExist)
    {
        string baseDirectory = GetUpdateBaseDirectory();
        string fullPath = Path.GetFullPath(requestedPath);
        if (!IsUnderDirectory(fullPath, baseDirectory))
            throw new InvalidDataException("The update file must be inside the application's local update directory.");
        if (!String.Equals(Path.GetExtension(fullPath), requiredExtension, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("An update file has an unexpected extension.");
        string parent = Path.GetDirectoryName(fullPath);
        if (String.IsNullOrEmpty(parent))
            throw new InvalidDataException("An update file path is invalid.");
        Directory.CreateDirectory(parent);
        EnsureNoReparsePoint(parent, baseDirectory);
        if (mustExist && !File.Exists(fullPath))
            throw new FileNotFoundException("A required update file is missing.", fullPath);
        if (File.Exists(fullPath) && (File.GetAttributes(fullPath) & FileAttributes.ReparsePoint) != 0)
            throw new InvalidDataException("Update files cannot be reparse points.");
        return fullPath;
    }

    private static string EnsureSafeTargetExecutable(string requestedPath)
    {
        string fullPath = Path.GetFullPath(requestedPath);
        if (!String.Equals(Path.GetExtension(fullPath), ".exe", StringComparison.OrdinalIgnoreCase) || !File.Exists(fullPath))
            throw new FileNotFoundException("The application executable to update is missing.", fullPath);
        string directory = Path.GetDirectoryName(fullPath);
        if (String.IsNullOrEmpty(directory) || PathsEqual(directory, Path.GetPathRoot(fullPath)))
            throw new InvalidDataException("The application executable path is unsafe.");
        string windowsDirectory = Path.GetFullPath(Environment.GetFolderPath(Environment.SpecialFolder.Windows));
        if (IsUnderDirectory(fullPath, windowsDirectory) || IsUnderDirectory(fullPath, GetUpdateBaseDirectory()))
            throw new InvalidDataException("The application executable path is unsafe.");
        if ((File.GetAttributes(fullPath) & FileAttributes.ReparsePoint) != 0)
            throw new InvalidDataException("The application executable cannot be a reparse point.");
        return fullPath;
    }

    private static string GetUpdateBaseDirectory()
    {
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        if (String.IsNullOrEmpty(local))
            throw new InvalidOperationException("The local application data directory is unavailable.");
        return Path.GetFullPath(Path.Combine(local, "AI採掘機", "updates"));
    }

    private static bool IsUnderDirectory(string path, string directory)
    {
        string fullPath = Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        string fullDirectory = Path.GetFullPath(directory).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        if (String.Equals(fullPath, fullDirectory, StringComparison.OrdinalIgnoreCase))
            return true;
        return fullPath.StartsWith(fullDirectory + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
    }

    private static void EnsureNoReparsePoint(string path, string baseDirectory)
    {
        string current = Path.GetFullPath(path);
        string stop = Path.GetFullPath(baseDirectory).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        while (true)
        {
            if (Directory.Exists(current) && (File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0)
                throw new InvalidDataException("The update staging path cannot contain reparse points.");
            string normalized = current.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (String.Equals(normalized, stop, StringComparison.OrdinalIgnoreCase))
                break;
            string parent = Path.GetDirectoryName(normalized);
            if (String.IsNullOrEmpty(parent) || !IsUnderDirectory(parent, stop))
                break;
            current = parent;
        }
    }

    private static bool PathsEqual(string left, string right)
    {
        if (left == null || right == null)
            return false;
        return String.Equals(Path.GetFullPath(left).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar),
                             Path.GetFullPath(right).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar),
                             StringComparison.OrdinalIgnoreCase);
    }

    private static void WaitForParentExit(int processId)
    {
        try
        {
            using (Process process = Process.GetProcessById(processId))
            {
                if (!process.WaitForExit(ParentExitTimeoutMilliseconds))
                    throw new TimeoutException("The running application did not exit before the update timeout.");
            }
        }
        catch (ArgumentException)
        {
            return;
        }
    }

    private static void ReplaceExecutable(string candidatePath, string targetPath, string backupPath)
    {
        Exception firstError = null;
        for (int attempt = 0; attempt < 8; attempt++)
        {
            try
            {
                File.Replace(candidatePath, targetPath, backupPath, true);
                return;
            }
            catch (Exception ex)
            {
                firstError = ex;
                Thread.Sleep(250);
            }
        }

        try
        {
            if (File.Exists(backupPath))
                File.Delete(backupPath);
            File.Copy(targetPath, backupPath, false);
            if (!MoveFileEx(candidatePath, targetPath, MoveFileReplaceExisting | MoveFileWriteThrough))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Atomic executable replacement failed.");
        }
        catch (Exception fallbackError)
        {
            throw new IOException("The application executable could not be replaced.", firstError ?? fallbackError);
        }
    }

    private static void RollBackExecutable(string targetPath, string backupPath)
    {
        if (!File.Exists(backupPath))
            throw new FileNotFoundException("The update backup is missing.", backupPath);

        string failedPath = targetPath + ".failed-update-" + Process.GetCurrentProcess().Id.ToString(CultureInfo.InvariantCulture) + ".tmp";
        TryDeleteFile(failedPath);
        try
        {
            if (File.Exists(targetPath) && !MoveFileEx(targetPath, failedPath, MoveFileReplaceExisting | MoveFileWriteThrough))
                throw new Win32Exception(Marshal.GetLastWin32Error());
            if (!MoveFileEx(backupPath, targetPath, MoveFileReplaceExisting | MoveFileWriteThrough))
                throw new Win32Exception(Marshal.GetLastWin32Error());
            TryDeleteFile(failedPath);
        }
        catch
        {
            File.Copy(backupPath, targetPath, true);
            TryDeleteFile(backupPath);
            TryDeleteFile(failedPath);
        }
    }

    private static void ValidateUpdatedApplication(string targetPath)
    {
        ValidateApplicationMode(targetPath, "--validate");
        // 埋込み検査だけでなく、GUI・設定読込・hotkey登録まで通常起動経路を通します。
        ValidateApplicationMode(targetPath, "--smoke-test");
    }

    private static void ValidateApplicationMode(string targetPath, string arguments)
    {
        Stopwatch stopwatch = Stopwatch.StartNew();
        Log("Starting updated application validation: " + SafeForLog(arguments) + ".");
        ProcessStartInfo startInfo = new ProcessStartInfo();
        startInfo.FileName = targetPath;
        startInfo.Arguments = arguments;
        startInfo.WorkingDirectory = Path.GetDirectoryName(targetPath);
        startInfo.UseShellExecute = false;
        startInfo.CreateNoWindow = true;
        startInfo.WindowStyle = ProcessWindowStyle.Hidden;

        using (Process process = Process.Start(startInfo))
        {
            if (process == null)
                throw new InvalidOperationException("The updated application could not be started for validation.");
            if (!process.WaitForExit(ValidationTimeoutMilliseconds))
            {
                try { process.Kill(); } catch { }
                throw new TimeoutException("The updated application validation timed out (" + arguments + ").");
            }
            if (process.ExitCode != 0)
                throw new InvalidDataException("The updated application failed startup validation (" + arguments
                    + ", exit " + process.ExitCode.ToString(CultureInfo.InvariantCulture) + ").");
            Log("Updated application validation passed: " + SafeForLog(arguments) + " in "
                + stopwatch.ElapsedMilliseconds.ToString(CultureInfo.InvariantCulture) + " ms.");
        }
    }

    private static void LaunchApplication(string targetPath, string arguments)
    {
        ProcessStartInfo startInfo = new ProcessStartInfo();
        startInfo.FileName = targetPath;
        startInfo.Arguments = arguments;
        startInfo.WorkingDirectory = Path.GetDirectoryName(targetPath);
        startInfo.UseShellExecute = true;
        Process.Start(startInfo);
    }

    private static void TryLaunchApplication(string targetPath, string arguments)
    {
        try { LaunchApplication(targetPath, arguments); }
        catch (Exception ex) { Log("Application restart failed: " + SafeForLog(ex.Message)); }
    }

    private static void ScheduleSelfDeletion()
    {
        try
        {
            string self = Process.GetCurrentProcess().MainModule.FileName;
            MoveFileEx(self, null, MoveFileDelayUntilReboot);
        }
        catch { }
    }

    private static byte[] ReadAllBytesLimited(string path, int maximumBytes)
    {
        FileInfo info = new FileInfo(path);
        if (!info.Exists || info.Length <= 0 || info.Length > maximumBytes)
            throw new InvalidDataException("An update metadata file has an invalid size.");
        return File.ReadAllBytes(path);
    }

    private static void AtomicWriteText(string path, string text)
    {
        AtomicWriteBytes(path, Utf8NoBom.GetBytes(text));
    }

    private static void AtomicWriteBytes(string path, byte[] bytes)
    {
        string fullPath = Path.GetFullPath(path);
        string directory = Path.GetDirectoryName(fullPath);
        if (String.IsNullOrEmpty(directory))
            throw new InvalidDataException("The output path is invalid.");
        Directory.CreateDirectory(directory);
        string temporaryPath = Path.Combine(directory, "." + Path.GetFileName(fullPath) + ".tmp-" + Guid.NewGuid().ToString("N"));
        try
        {
            using (FileStream stream = new FileStream(temporaryPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                stream.Write(bytes, 0, bytes.Length);
                stream.Flush(true);
            }
            if (!MoveFileEx(temporaryPath, fullPath, MoveFileReplaceExisting | MoveFileWriteThrough))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Atomic file replacement failed.");
        }
        finally
        {
            TryDeleteFile(temporaryPath);
        }
    }

    private static void WriteCheckResult(string path, string status, string version, string manifestPath, string signaturePath, string notesUrl, string message)
    {
        StringBuilder text = new StringBuilder();
        AppendResult(text, "Status", status);
        AppendResult(text, "Version", version);
        AppendResult(text, "ManifestPath", manifestPath);
        AppendResult(text, "SignaturePath", signaturePath);
        AppendResult(text, "NotesUrl", notesUrl);
        AppendResult(text, "Message", message);
        AtomicWriteText(path, text.ToString());
    }

    private static void WriteDownloadResult(string path, string status, string version, string stagedPath, string message)
    {
        StringBuilder text = new StringBuilder();
        AppendResult(text, "Status", status);
        AppendResult(text, "Version", version);
        AppendResult(text, "StagedPath", stagedPath);
        AppendResult(text, "Message", message);
        AtomicWriteText(path, text.ToString());
    }

    private static void AppendResult(StringBuilder output, string key, string value)
    {
        output.Append(key).Append('=').Append(SanitizeResultValue(value)).Append("\r\n");
    }

    private static string SanitizeResultValue(string value)
    {
        if (String.IsNullOrEmpty(value))
            return "";
        StringBuilder result = new StringBuilder(Math.Min(value.Length, 512));
        for (int i = 0; i < value.Length && result.Length < 512; i++)
        {
            char c = value[i];
            if (c == '\r' || c == '\n' || c == '\0')
                result.Append(' ');
            else if (!Char.IsControl(c) || c == '\t')
                result.Append(c);
        }
        return result.ToString().Trim();
    }

    private static void WriteCheckResultSafely(string path, string status, string version, string manifestPath, string signaturePath, string notesUrl, string message)
    {
        try { WriteCheckResult(path, status, version, manifestPath, signaturePath, notesUrl, message); }
        catch (Exception ex) { Log("Check result write failed: " + SafeForLog(ex.Message)); }
    }

    private static void WriteDownloadResultSafely(string path, string status, string version, string stagedPath, string message)
    {
        try { WriteDownloadResult(path, status, version, stagedPath, message); }
        catch (Exception ex) { Log("Download result write failed: " + SafeForLog(ex.Message)); }
    }

    private static void TryWriteCheckError(string[] args, string message)
    {
        if (args != null && args.Length > 1)
            WriteCheckResultSafely(args[1], "ERROR", "", "", "", "", message);
    }

    private static void TryWriteDownloadError(string[] args, string message)
    {
        if (args != null && args.Length > 1)
            WriteDownloadResultSafely(args[1], "ERROR", "", "", message);
    }

    private static string PublicError(Exception exception)
    {
        if (exception is CryptographicException)
            return "Update verification failed: " + exception.Message;
        if (exception is InvalidDataException || exception is FileNotFoundException || exception is TimeoutException || exception is HttpStatusException)
            return exception.Message;
        if (exception is UnauthorizedAccessException)
            return "The updater does not have permission to access a required file.";
        if (exception is IOException)
            return exception.Message;
        return "The update operation failed safely. See the updater log for details.";
    }

    private static string SafeForLog(string value)
    {
        return SanitizeResultValue(value);
    }

    private static void Log(string message)
    {
        try
        {
            string directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AI採掘機");
            Directory.CreateDirectory(directory);
            string path = Path.Combine(directory, "updater.log");
            if (File.Exists(path) && new FileInfo(path).Length > 1024 * 1024)
                File.WriteAllText(path, "", Utf8NoBom);
            string line = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture) + " " + SafeForLog(message) + Environment.NewLine;
            File.AppendAllText(path, line, Utf8NoBom);
        }
        catch { }
    }

    private static void TryDeleteFile(string path)
    {
        if (String.IsNullOrEmpty(path))
            return;
        try
        {
            if (File.Exists(path))
                File.Delete(path);
        }
        catch { }
    }

    private static void TryDeleteEmptyParent(string directory)
    {
        if (String.IsNullOrEmpty(directory))
            return;
        try
        {
            if (Directory.Exists(directory) && Directory.GetFileSystemEntries(directory).Length == 0)
                Directory.Delete(directory, false);
        }
        catch { }
    }

    private static void EnsureOnlyKeys(Dictionary<string, object> dictionary, params string[] allowedKeys)
    {
        HashSet<string> allowed = new HashSet<string>(allowedKeys, StringComparer.Ordinal);
        foreach (string key in dictionary.Keys)
        {
            if (!allowed.Contains(key))
                throw new InvalidDataException("The update manifest contains an unsupported field.");
        }
        foreach (string key in allowedKeys)
        {
            if (!dictionary.ContainsKey(key))
                throw new InvalidDataException("The update manifest is missing a required field.");
        }
    }

    private static string GetString(Dictionary<string, object> dictionary, string key)
    {
        object value;
        if (!dictionary.TryGetValue(key, out value) || value == null || value.GetType() != typeof(string) || String.IsNullOrEmpty((string)value))
            throw new InvalidDataException("The update manifest field '" + key + "' must be a non-empty string.");
        return (string)value;
    }

    private static long GetInteger(Dictionary<string, object> dictionary, string key)
    {
        object value;
        if (!dictionary.TryGetValue(key, out value) || value == null)
            throw new InvalidDataException("The update manifest field '" + key + "' must be an integer.");

        if (value is int)
            return (int)value;
        if (value is long)
            return (long)value;
        if (value is decimal)
        {
            decimal number = (decimal)value;
            if (Decimal.Truncate(number) == number && number <= Int64.MaxValue && number >= Int64.MinValue)
                return Decimal.ToInt64(number);
        }
        throw new InvalidDataException("The update manifest field '" + key + "' must be an integer.");
    }

    private static Dictionary<string, object> GetObject(Dictionary<string, object> dictionary, string key)
    {
        object value;
        if (!dictionary.TryGetValue(key, out value) || value == null)
            throw new InvalidDataException("The update manifest field '" + key + "' must be an object.");
        Dictionary<string, object> result = value as Dictionary<string, object>;
        if (result == null)
            throw new InvalidDataException("The update manifest field '" + key + "' must be an object.");
        return result;
    }

    private static void ValidatePublishedAt(string publishedAt)
    {
        if (!Regex.IsMatch(publishedAt, @"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,7})?Z$", RegexOptions.CultureInvariant))
            throw new InvalidDataException("The update publication timestamp is invalid.");
        DateTimeOffset value;
        if (!DateTimeOffset.TryParseExact(publishedAt,
                new string[] { "yyyy-MM-dd'T'HH:mm:ss'Z'", "yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'" },
                CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out value))
            throw new InvalidDataException("The update publication timestamp is invalid.");
    }

    private sealed class UpdateManifest
    {
        public SemanticVersion Version;
        public string PublishedAt;
        public SemanticVersion MinimumUpdaterVersion;
        public string ArtifactName;
        public string ArtifactUrl;
        public long ArtifactSize;
        public string ArtifactSha256;
        public string ReleaseNotesUrl;
    }

    private sealed class HttpStatusException : IOException
    {
        public readonly HttpStatusCode StatusCode;

        public HttpStatusException(HttpStatusCode statusCode, string message)
            : base(message)
        {
            StatusCode = statusCode;
        }

        public HttpStatusException(HttpStatusCode statusCode, string message, Exception innerException)
            : base(message, innerException)
        {
            StatusCode = statusCode;
        }
    }

    private sealed class SemanticVersion : IComparable<SemanticVersion>
    {
        public readonly string Original;
        private readonly ulong major;
        private readonly ulong minor;
        private readonly ulong patch;
        private readonly string prerelease;

        private SemanticVersion(string original, ulong majorValue, ulong minorValue, ulong patchValue, string prereleaseValue)
        {
            Original = original;
            major = majorValue;
            minor = minorValue;
            patch = patchValue;
            prerelease = prereleaseValue;
        }

        public static SemanticVersion Parse(string text)
        {
            if (String.IsNullOrEmpty(text) || text.Length > 128)
                throw new InvalidDataException("A version value is not valid semantic versioning.");
            Match match = SemVerRegex.Match(text);
            if (!match.Success)
                throw new InvalidDataException("A version value is not valid semantic versioning.");

            ulong majorValue;
            ulong minorValue;
            ulong patchValue;
            if (!UInt64.TryParse(match.Groups[1].Value, NumberStyles.None, CultureInfo.InvariantCulture, out majorValue) ||
                !UInt64.TryParse(match.Groups[2].Value, NumberStyles.None, CultureInfo.InvariantCulture, out minorValue) ||
                !UInt64.TryParse(match.Groups[3].Value, NumberStyles.None, CultureInfo.InvariantCulture, out patchValue))
                throw new InvalidDataException("A version value is outside the supported range.");

            return new SemanticVersion(text, majorValue, minorValue, patchValue, match.Groups[4].Success ? match.Groups[4].Value : null);
        }

        public int CompareTo(SemanticVersion other)
        {
            if (other == null)
                return 1;
            int comparison = major.CompareTo(other.major);
            if (comparison != 0) return comparison;
            comparison = minor.CompareTo(other.minor);
            if (comparison != 0) return comparison;
            comparison = patch.CompareTo(other.patch);
            if (comparison != 0) return comparison;

            if (prerelease == null && other.prerelease == null) return 0;
            if (prerelease == null) return 1;
            if (other.prerelease == null) return -1;

            string[] leftParts = prerelease.Split('.');
            string[] rightParts = other.prerelease.Split('.');
            int length = Math.Min(leftParts.Length, rightParts.Length);
            for (int i = 0; i < length; i++)
            {
                string left = leftParts[i];
                string right = rightParts[i];
                ulong leftNumber;
                ulong rightNumber;
                bool leftNumeric = UInt64.TryParse(left, NumberStyles.None, CultureInfo.InvariantCulture, out leftNumber);
                bool rightNumeric = UInt64.TryParse(right, NumberStyles.None, CultureInfo.InvariantCulture, out rightNumber);
                if (leftNumeric && rightNumeric)
                {
                    comparison = leftNumber.CompareTo(rightNumber);
                }
                else if (leftNumeric)
                {
                    comparison = -1;
                }
                else if (rightNumeric)
                {
                    comparison = 1;
                }
                else
                {
                    comparison = String.CompareOrdinal(left, right);
                }
                if (comparison != 0)
                    return comparison;
            }
            return leftParts.Length.CompareTo(rightParts.Length);
        }
    }
}
