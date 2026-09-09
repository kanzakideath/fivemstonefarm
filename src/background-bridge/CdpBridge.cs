using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

internal static class CdpBridge
{
    private const string TargetsUrl = "http://127.0.0.1:13172/json";
    private const string TargetFramePart = "cfx-nui-ox_target/web/index.html";
    private const string ProgressFramePart = "cfx-nui-ox_lib/web/build/index.html";
    private const string InventoryFramePart = "cfx-nui-ox_inventory/web/build/index.html";
    private const string CompanionFramePart = "cfx-nui-ai_miner_companion/ui/index.html";
    private const string CompanionProtocol = "ai-miner-companion";
    private const string CompanionResource = "ai_miner_companion";
    private const string Capabilities = "CAPS 10 MINE WASH GOLD NUDGE STORAGE INVENTORY ROUTE TRY VIEW HOTBAR INVENTORYKEY HEALTH COMPANION WASHWAIT";
    private const int WashProgressStartMilliseconds = 3000;
    private const int WashProgressTotalMilliseconds = 19500;
    private const int WashProgressPollMilliseconds = 70;
    private const int WashProgressMinimumActiveMilliseconds = 4000;
    private const int WashProgressStableAbsentMilliseconds = 500;
    private const int MaximumRouteSteps = 240;
    private const int MaximumRouteMilliseconds = 90000;
    private const int RouteHealthIntervalMilliseconds = 2500;
    private const int MaximumMetadataBytes = 8192;
    private const int MaximumMetadataTokenLength = 10923;
    private const string TestPortEnvironmentVariable = "AI_MINER_BRIDGE_TEST_PORT";
    private const string TestTokenEnvironmentVariable = "AI_MINER_BRIDGE_TEST_TOKEN";
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 };
    private static readonly Regex ItemNamePattern = new Regex("^[A-Za-z0-9_-]{1,64}$", RegexOptions.CultureInvariant);
    private static readonly Regex Base64Pattern = new Regex("^[A-Za-z0-9+/]+={0,2}$", RegexOptions.CultureInvariant);
    private static readonly Regex OperationTokenPattern = new Regex("^[A-Za-z0-9_-]{1,64}$", RegexOptions.CultureInvariant);
    private static readonly Regex TestTokenPattern = new Regex("^[a-f0-9]{64}$", RegexOptions.CultureInvariant);
    private static readonly Regex ServerEpochPattern = new Regex("^[A-Za-z0-9_-]{8,512}$", RegexOptions.CultureInvariant);
    private static readonly Regex CompanionEpochPattern = new Regex("^ame_[a-f0-9]{32}$", RegexOptions.CultureInvariant);
    private static readonly Regex CompanionTokenPattern = new Regex("^amt_[a-f0-9]{48}$", RegexOptions.CultureInvariant);
    private static readonly Regex CompanionRegistrationPattern = new Regex("^amv_[a-f0-9]{36}$", RegexOptions.CultureInvariant);
    private static readonly Regex CompanionCommandPattern = new Regex("^[a-z][a-z0-9-]{0,47}$", RegexOptions.CultureInvariant);
    private static readonly Regex CompanionCodePattern = new Regex("^[A-Z0-9_]{1,64}$", RegexOptions.CultureInvariant);
    private static readonly Regex CompanionVersionPattern = new Regex("^(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)$", RegexOptions.CultureInvariant);
    private static readonly Regex JsonNumberPattern = new Regex("^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$", RegexOptions.CultureInvariant);
    private static readonly Regex BaselineEntryPattern = new Regex(
        "^(?<slot>[0-9]{4})\\.(?<name>[A-Za-z0-9_-]{1,64})\\.(?<meta>[A-Za-z0-9_-]{2," + MaximumMetadataTokenLength + "})=(?<count>[0-9]{1,10})$",
        RegexOptions.CultureInvariant);
    private static int _nextId = 1;

    public static int Main(string[] args)
    {
        if (args == null || args.Length < 2 || String.IsNullOrEmpty(args[0]) || String.IsNullOrEmpty(args[1]))
            return 64;

        string mode = args[0];
        bool twoArgumentMode = args.Length == 2 && (mode == "capabilities"
            || mode == "self-test"
            || mode == "probe-mining" || mode == "click-mining"
            || mode == "probe-washing"
            || mode == "probe-gold" || mode == "click-gold"
            || mode == "probe-storage" || mode == "click-storage"
            || mode == "inventory-snapshot" || mode == "capture-storage"
            || mode == "health"
            || mode == "companion-status"
            || mode == "close-inventory"
            || mode == "try-mining" || mode == "try-probe-mining"
            || mode == "try-gold"
            || mode == "activate" || mode == "deactivate"
            || mode == "deactivate-29200" || mode == "deactivate-29300");
        bool washTryMode = args.Length == 3 && mode == "try-washing";
        bool washCompletionMode = args.Length == 3 && mode == "wait-wash-completion";
        bool nudgeMode = (args.Length == 4 || args.Length == 5) && mode == "nudge-forward";
        bool routeMode = (args.Length == 4 || args.Length == 5) && mode == "play-route";
        bool routeHealthMode = args.Length == 5 && mode == "play-route-health";
        bool viewMode = (args.Length == 4 || args.Length == 5) && mode == "set-view";
        bool hotbarMode = (args.Length == 5 || args.Length == 6) && mode == "press-hotbar";
        bool inventoryKeyMode = (args.Length == 4 || args.Length == 5) && mode == "press-inventory";
        bool testDeactivateMode = args.Length == 4 && mode == "deactivate-test";
        bool depositMode = args.Length == 6 && mode == "deposit-delta";
        bool cancelOperationMode = args.Length == 3 && mode == "cancel-operation";
        bool companionCommandMode = (args.Length == 3 || args.Length == 4)
            && mode == "companion-command";
        if (!twoArgumentMode && !washTryMode && !washCompletionMode
            && !nudgeMode && !routeMode && !routeHealthMode && !viewMode
            && !hotbarMode && !inventoryKeyMode
            && !testDeactivateMode && !depositMode && !cancelOperationMode
            && !companionCommandMode)
            return 64;

        string result;
        int exitCode;
        try
        {
            if (mode == "capabilities")
            {
                result = Capabilities;
            }
            else if (mode == "self-test")
            {
                result = RunSelfTest();
            }
            else if (nudgeMode)
            {
                int port;
                int milliseconds;
                bool testPortAuthorized;
                string testToken = args.Length == 5 ? args[4] : null;
                if (!TryParseDevConPort(args[2], testToken, out port, out testPortAuthorized)
                    || !Int32.TryParse(args[3], NumberStyles.None, CultureInfo.InvariantCulture, out milliseconds)
                    || milliseconds < 50 || milliseconds > 250)
                    return 64;
                result = NudgeForward(port, milliseconds);
            }
            else if (routeHealthMode)
            {
                int port;
                if (!TryParseProductionDevConPort(args[2], out port)
                    || !IsValidServerEpoch(args[4]))
                    return 64;
                List<RouteStep> steps = ParseRoute(args[3]);
                result = PlayRouteWithHealth(port, steps, args[4]);
            }
            else if (routeMode)
            {
                int port;
                bool testPortAuthorized;
                string testToken = args.Length == 5 ? args[4] : null;
                if (!TryParseDevConPort(args[2], testToken, out port, out testPortAuthorized))
                    return 64;
                List<RouteStep> steps = ParseRoute(args[3]);
                result = PlayRoute(port, steps);
            }
            else if (viewMode)
            {
                int port;
                int mask;
                bool testPortAuthorized;
                string testToken = args.Length == 5 ? args[4] : null;
                if (!TryParseDevConPort(args[2], testToken, out port, out testPortAuthorized)
                    || !Int32.TryParse(args[3], NumberStyles.None, CultureInfo.InvariantCulture, out mask)
                    || !IsValidViewMask(mask))
                    return 64;
                result = SetViewInput(port, mask);
            }
            else if (hotbarMode)
            {
                int port;
                int slot;
                int milliseconds;
                bool testPortAuthorized;
                string testToken = args.Length == 6 ? args[5] : null;
                if (!TryParseDevConPort(args[2], testToken, out port, out testPortAuthorized)
                    || !Int32.TryParse(args[3], NumberStyles.None, CultureInfo.InvariantCulture, out slot)
                    || slot < 1 || slot > 5
                    || !Int32.TryParse(args[4], NumberStyles.None, CultureInfo.InvariantCulture, out milliseconds)
                    || milliseconds < 30 || milliseconds > 1000)
                    return 64;
                result = PressHotbar(port, slot, milliseconds);
            }
            else if (inventoryKeyMode)
            {
                int port;
                int milliseconds;
                bool testPortAuthorized;
                string testToken = args.Length == 5 ? args[4] : null;
                if (!TryParseDevConPort(args[2], testToken, out port, out testPortAuthorized)
                    || !Int32.TryParse(args[3], NumberStyles.None, CultureInfo.InvariantCulture,
                        out milliseconds)
                    || milliseconds < 30 || milliseconds > 1000)
                    return 64;
                result = PressInventory(port, milliseconds);
            }
            else if (depositMode)
            {
                string storageId = DecodeIdentifier(args[2]);
                string storageType = DecodeIdentifier(args[3]).ToLowerInvariant();
                if (storageType != "trunk")
                    throw new ArgumentException();
                Dictionary<string, int> baseline = ParseBaseline(args[4]);
                string operationToken = args[5];
                if (!OperationTokenPattern.IsMatch(operationToken))
                    throw new ArgumentException();
                result = DepositDeltaAsync(storageId, storageType, baseline, operationToken).GetAwaiter().GetResult();
            }
            else if (cancelOperationMode)
            {
                if (!OperationTokenPattern.IsMatch(args[2]))
                    throw new ArgumentException();
                result = CancelOperationAsync(args[2]).GetAwaiter().GetResult();
            }
            else if (companionCommandMode)
            {
                string registrationId = args.Length == 4 ? DecodeIdentifier(args[3]) : "";
                result = CompanionCommandAsync(args[2], registrationId).GetAwaiter().GetResult();
            }
            else if (mode == "activate")
            {
                result = ActivateAsync().GetAwaiter().GetResult();
            }
            else if (testDeactivateMode)
            {
                int selectedPort;
                bool testPortAuthorized;
                if (!TryParseDevConPort(args[2], args[3], out selectedPort, out testPortAuthorized)
                    || !testPortAuthorized)
                    return 64;
                if (!SendRelease(selectedPort, true))
                    throw new InvalidOperationException("INPUT_RELEASE_UNAVAILABLE");
                result = "RELEASED";
            }
            else if (mode.StartsWith("deactivate", StringComparison.Ordinal))
            {
                int selectedPort = mode.EndsWith("29200", StringComparison.Ordinal) ? 29200
                    : mode.EndsWith("29300", StringComparison.Ordinal) ? 29300 : 0;
                if (!SendRelease(selectedPort))
                    throw new InvalidOperationException("INPUT_RELEASE_UNAVAILABLE");
                result = "RELEASED";
            }
            else if (mode.StartsWith("try-", StringComparison.Ordinal))
            {
                if (washTryMode && !IsValidServerEpoch(args[2]))
                    return 64;
                result = TryActionAsync(mode, washTryMode ? args[2] : null)
                    .GetAwaiter().GetResult();
            }
            else if (washCompletionMode)
            {
                if (!IsValidServerEpoch(args[2]))
                    return 64;
                result = WaitWashCompletionAsync(args[2]).GetAwaiter().GetResult();
            }
            else if (mode == "inventory-snapshot")
            {
                result = InventorySnapshotAsync().GetAwaiter().GetResult();
            }
            else if (mode == "health")
            {
                result = HealthAsync().GetAwaiter().GetResult();
            }
            else if (mode == "companion-status")
            {
                result = CompanionStatusAsync().GetAwaiter().GetResult();
            }
            else if (mode == "capture-storage")
            {
                result = CaptureStorageAsync().GetAwaiter().GetResult();
            }
            else if (mode == "close-inventory")
            {
                result = CloseInventoryAsync().GetAwaiter().GetResult();
            }
            else
            {
                result = RunTargetAsync(mode).GetAwaiter().GetResult();
            }

            exitCode = IsSuccess(result) ? 0 : 10;
        }
        catch (ArgumentException)
        {
            result = "ERROR INVALID_ARGUMENTS";
            exitCode = 2;
        }
        catch (FormatException)
        {
            result = "ERROR INVALID_ARGUMENTS";
            exitCode = 2;
        }
        catch (Exception ex)
        {
            result = "ERROR " + SafeErrorToken(ex.Message);
            exitCode = 2;
        }

        try { File.WriteAllText(args[1], OneLine(result), new UTF8Encoding(false)); }
        catch { return 3; }
        return exitCode;
    }

    private static bool IsSuccess(string result)
    {
        return result == Capabilities
            || result == "SELFTEST OK"
            || result.StartsWith("PRESENT ", StringComparison.Ordinal)
            || result.StartsWith("CLICKED ", StringComparison.Ordinal)
            || result.StartsWith("ACTIVATED ", StringComparison.Ordinal)
            || result.StartsWith("NUDGED ", StringComparison.Ordinal)
            || result.StartsWith("ROUTE ", StringComparison.Ordinal)
            || result.StartsWith("VIEW ", StringComparison.Ordinal)
            || result.StartsWith("HOTBAR ", StringComparison.Ordinal)
            || result.StartsWith("INVENTORY ", StringComparison.Ordinal)
            || result.StartsWith("HEALTH READY ", StringComparison.Ordinal)
            || result.StartsWith("COMPANION 1 ", StringComparison.Ordinal)
            || result.StartsWith("COMPANION_DONE ", StringComparison.Ordinal)
            || IsWashCompletionResult(result)
            || result.StartsWith("SNAPSHOT ", StringComparison.Ordinal)
            || result.StartsWith("STORAGE ", StringComparison.Ordinal)
            || result.StartsWith("DEPOSITED ", StringComparison.Ordinal)
            || result == "CLOSED" || result == "RELEASED" || result == "CANCELLED";
    }

    private static bool IsWashCompletionResult(string result)
    {
        const string prefix = "WASH_COMPLETED ";
        if (String.IsNullOrEmpty(result)
            || !result.StartsWith(prefix, StringComparison.Ordinal))
            return false;

        int elapsedMilliseconds;
        return Int32.TryParse(result.Substring(prefix.Length), NumberStyles.None,
                CultureInfo.InvariantCulture, out elapsedMilliseconds)
            && elapsedMilliseconds >= 0
            && elapsedMilliseconds <= 24000;
    }

    private static string RunSelfTest()
    {
        List<RouteStep> route = ParseRoute("150:65,25:0,150:136");
        Dictionary<string, int> baseline = ParseBaseline("0001.ore.e30=10");
        const string canonicalMetadata = "{\"a\":1,\"nested\":{\"a\":true,\"b\":2},\"z\":[3,null,\"x\"]}";
        string canonicalToken = EncodeBase64Url(canonicalMetadata);
        Dictionary<string, int> canonicalBaseline = ParseBaseline("0002.ore." + canonicalToken + "=3");
        string largeMetadata = "{\"payload\":\"" + new string('x', 7000) + "\"}";
        string largeToken = EncodeBase64Url(largeMetadata);
        Dictionary<string, int> largeBaseline = ParseBaseline("0003.ore." + largeToken + "=7");
        const string exponentMetadata = "{\"ratio\":1e-7}";
        Dictionary<string, int> exponentBaseline = ParseBaseline(
            "0004.ore." + EncodeBase64Url(exponentMetadata) + "=2");
        string serverEpoch = EncodeBase64Url(
            "target-frame\ninventory-frame\nprogress-frame");
        var routeCommand = new StringBuilder(InputReleaseCommand());
        AppendRoutePresses(routeCommand, 65);
        var viewCommand = new StringBuilder(ViewReleaseCommand());
        AppendViewPresses(viewCommand, 10);
        string inventorySnapshotExpression = InventorySnapshotExpression();
        string washProgressExpression = WashProgressExpression();
        string washProbeExpression = WashTargetExpression(false);
        string washClickExpression = WashTargetExpression(true);
        string strictProbeExpression = ProbeExpression("砂金採りトレイ", true);
        string strictClickExpression = ClickExpression("鉱石を採掘する", false);
        int washWaitingState = AdvanceWashProgressState(0, false);
        int washFlickerState = AdvanceWashProgressState(washWaitingState, true);
        int washFlickerResetState = AdvanceWashProgressState(washFlickerState, false);
        int washFirstVisibleState = AdvanceWashProgressState(washFlickerResetState, true);
        int washArmedState = AdvanceWashProgressState(washFirstVisibleState, true);
        int washFirstAbsentState = AdvanceWashProgressState(washArmedState, false);
        int washActiveResetState = AdvanceWashProgressState(washFirstAbsentState, true);
        int washSecondFirstAbsentState = AdvanceWashProgressState(washActiveResetState, false);
        int washCompletedState = AdvanceWashProgressState(washSecondFirstAbsentState, false);
        string staleWeightSnapshot = FormatInventorySnapshotResult("SNAPSHOT_DETAIL "
            + "{\"weight\":42,\"max\":1000,\"used\":2,\"slots\":5,\"items\":["
            + "{\"slot\":1,\"name\":\"ore\",\"count\":3,\"meta\":\"{}\"},"
            + "{\"slot\":2,\"name\":\"washed_stone\",\"count\":1,\"meta\":\"{\\\"quality\\\":100}\"}]}");
        const string companionJson = "{\"protocol\":\"ai-miner-companion\",\"protocolVersion\":1,"
            + "\"resource\":\"ai_miner_companion\",\"resourceVersion\":\"1.0.0\","
            + "\"epoch\":\"ame_0123456789abcdef0123456789abcdef\",\"sequence\":7,"
            + "\"token\":\"amt_0123456789abcdef0123456789abcdef0123456789abcdef\",\"status\":\"ready\","
            + "\"capabilities\":{\"dynamicVehicleRegistration\":true,\"dynamicVehicleNavigation\":true,"
             + "\"workAnchor\":true,\"returnToWork\":true,\"cancel\":true,\"cargoArrival\":true,"
             + "\"transactionalRegistration\":true,\"registrationCommit\":true,"
             + "\"serverRegistrationSync\":true,"
             + "\"oxTarget\":true,\"openCargo\":false,\"maxVehicleDistance\":250},"
            + "\"registrationTransaction\":{\"pending\":false,\"id\":\"\",\"previousId\":\"\","
            + "\"startedAt\":0,\"expiresAt\":0,\"status\":\"idle\"},"
            + "\"registration\":{\"registered\":true,\"id\":\"amv_0123456789abcdef0123456789abcdef0123\","
            + "\"plate\":\"TEST 123\",\"model\":123,\"label\":\"Box Truck\",\"networkId\":55,"
            + "\"lastSeen\":12345,\"available\":true,\"availabilityCode\":\"\"},"
            + "\"workAnchor\":{\"set\":true,\"x\":1.25,\"y\":-2.5,\"z\":3,\"heading\":180},"
            + "\"navigation\":{\"active\":false,\"kind\":\"\",\"registrationId\":\"\","
            + "\"networkId\":0,\"distance\":-1,\"attempt\":0,\"startedAt\":0,\"status\":\"idle\"},"
            + "\"lastResult\":{\"present\":true,\"requestId\":\"ui_target_123_1\","
            + "\"command\":\"ox-target-register\",\"ok\":true,\"code\":\"REGISTERED\","
            + "\"message\":\"registered\",\"registrationId\":\"amv_0123456789abcdef0123456789abcdef0123\","
            + "\"networkId\":55},\"overlay\":{\"visible\":false,\"title\":\"\",\"detail\":\"\","
            + "\"tone\":\"neutral\"}}";
        CompanionState companion = ParseCompanionState(companionJson);
        CompanionState directCargoCompanion = ParseCompanionState(
            companionJson.Replace("\"openCargo\":false", "\"openCargo\":true"));
        const string candidateRegistrationId = "amv_0123456789abcdef0123456789abcdef0123";
        const string previousRegistrationId = "amv_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const string idleTransactionJson = "\"registrationTransaction\":{\"pending\":false,"
            + "\"id\":\"\",\"previousId\":\"\",\"startedAt\":0,\"expiresAt\":0,"
            + "\"status\":\"idle\"}";
        string pendingTransactionJson = companionJson.Replace(idleTransactionJson,
            "\"registrationTransaction\":{\"pending\":true,\"id\":\""
            + candidateRegistrationId + "\",\"previousId\":\"" + previousRegistrationId
            + "\",\"startedAt\":12345,\"expiresAt\":12525,\"status\":\"staged\"}");
        string legacyCompanionJson = companionJson
            .Replace("\"transactionalRegistration\":true,\"registrationCommit\":true,", "")
            .Replace(idleTransactionJson + ",", "");
        CompanionState pendingTransaction = ParseCompanionState(pendingTransactionJson);
        CompanionState unsynchronizedCompanion = ParseCompanionState(companionJson.Replace(
            "\"serverRegistrationSync\":true", "\"serverRegistrationSync\":false"));
        string companionStatus = FormatCompanionStatus(companion);
        string pendingCompanionStatus = FormatCompanionStatus(pendingTransaction);
        string unsynchronizedCompanionStatus = FormatCompanionStatus(unsynchronizedCompanion);
        string[] companionStatusFields = companionStatus.Split(' ');
        string[] pendingCompanionStatusFields = pendingCompanionStatus.Split(' ');
        string[] unsynchronizedCompanionStatusFields = unsynchronizedCompanionStatus.Split(' ');
        var armStarted = new CompanionState { Sequence = companion.Sequence + 1,
            Status = "registration_armed" };
        var transactionStarted = new CompanionState { Sequence = companion.Sequence + 1,
            Status = "registering" };
        var commitResponse = new CompanionState {
            RegistrationTransactionSupported = true,
            RegistrationTransactionPending = false,
            Registered = true,
            RegistrationId = candidateRegistrationId,
            LastRegistrationId = candidateRegistrationId
        };
        var abortResponse = new CompanionState {
            RegistrationTransactionSupported = true,
            RegistrationTransactionPending = false,
            Registered = true,
            RegistrationId = previousRegistrationId,
            LastRegistrationId = candidateRegistrationId
        };
        var abortRetryInitial = new CompanionState {
            RegistrationTransactionSupported = true,
            RegistrationTransactionPending = false,
            Registered = true,
            RegistrationId = previousRegistrationId
        };
        var abortWithoutPreviousInitial = new CompanionState {
            RegistrationTransactionSupported = true,
            RegistrationTransactionPending = true,
            RegistrationTransactionPreviousId = "",
            Registered = true,
            RegistrationId = candidateRegistrationId
        };
        var abortWithoutPreviousResponse = new CompanionState {
            RegistrationTransactionSupported = true,
            RegistrationTransactionPending = false,
            Registered = false,
            RegistrationId = ""
        };
        ValidateCompanionResponse("commit-registration", candidateRegistrationId,
            pendingTransaction, commitResponse);
        ValidateCompanionResponse("commit-registration", candidateRegistrationId,
            companion, commitResponse);
        ValidateCompanionResponse("abort-registration", candidateRegistrationId,
            pendingTransaction, abortResponse);
        ValidateCompanionResponse("abort-registration", candidateRegistrationId,
            abortRetryInitial, abortResponse);
        ValidateCompanionResponse("abort-registration", candidateRegistrationId,
            abortWithoutPreviousInitial, abortWithoutPreviousResponse);
        int count;
        if (route.Count != 3 || route[0].Mask != 65 || route[2].Mask != 136
            || !RouteIsRejected("150:48") || !RouteIsRejected("150:192")
            || !RouteIsRejected("150:256")
            || routeCommand.ToString().IndexOf(";+move_up_only", StringComparison.Ordinal) < 0
            || routeCommand.ToString().IndexOf(";+look_left", StringComparison.Ordinal) < 0
            || InputReleaseCommand().IndexOf(";-hotkey1", StringComparison.Ordinal) < 0
            || InputReleaseCommand().IndexOf(";-hotkey5", StringComparison.Ordinal) < 0
            || InputReleaseCommand().IndexOf(";-inv", StringComparison.Ordinal) < 0
            || viewCommand.ToString().IndexOf(";+look_down", StringComparison.Ordinal) < 0
            || viewCommand.ToString().IndexOf(";+look_right", StringComparison.Ordinal) < 0
            || inventorySnapshotExpression.IndexOf("left.weight", StringComparison.Ordinal) >= 0
            || inventorySnapshotExpression.IndexOf("weight:whole(calculatedWeight)", StringComparison.Ordinal) < 0
            || washWaitingState != 0 || washFlickerState != 1 || washFlickerResetState != 0
            || washFirstVisibleState != 1 || washArmedState != 2 || washFirstAbsentState != 3
            || washActiveResetState != 2 || washSecondFirstAbsentState != 3 || washCompletedState != 4
            || WashProgressStartTimedOut(0, 2, 3000)
            || WashProgressStartTimedOut(1, 3, 3000)
            || WashProgressStartTimedOut(0, 3, 2999)
            || !WashProgressStartTimedOut(0, 3, 3000)
            || WashProgressCompletionReady(1000, 5000, 5499)
            || WashProgressCompletionReady(1600, 5000, 5500)
            || !WashProgressCompletionReady(1000, 5000, 5500)
            || washProgressExpression.IndexOf("石を洗っています", StringComparison.Ordinal) < 0
            || washProgressExpression.IndexOf("startsWith(q)", StringComparison.Ordinal) < 0
            || washProgressExpression.IndexOf("nodes.some", StringComparison.Ordinal) < 0
            || washProgressExpression.IndexOf("animationName", StringComparison.Ordinal) < 0
            || washProgressExpression.IndexOf("progress-bar", StringComparison.Ordinal) < 0
            || washProbeExpression.IndexOf("seen=new Set()", StringComparison.Ordinal) < 0
            || washProbeExpression.IndexOf("!usable(leaf)||!usable(hit)", StringComparison.Ordinal) < 0
            || washProbeExpression.IndexOf("!shown(body)", StringComparison.Ordinal) < 0
            || washProbeExpression.IndexOf("!usable(body)", StringComparison.Ordinal) >= 0
            || washProbeExpression.IndexOf(".click()", StringComparison.Ordinal) >= 0
            || washClickExpression.IndexOf(":hover", StringComparison.Ordinal) < 0
            || washClickExpression.IndexOf("[aria-selected=true]", StringComparison.Ordinal) < 0
            || washClickExpression.IndexOf("#eyeicon", StringComparison.Ordinal) < 0
            || washClickExpression.IndexOf("a.distance-b.distance||a.order-b.order", StringComparison.Ordinal) < 0
            || washClickExpression.IndexOf("choice.hit.click();return true", StringComparison.Ordinal) < 0
            || strictProbeExpression.IndexOf("matches.length!==1", StringComparison.Ordinal) < 0
            || strictClickExpression.IndexOf("matches.length!==1", StringComparison.Ordinal) < 0
            || !IsSuccess("WASH_COMPLETED 9750")
            || IsSuccess("WASH_COMPLETED ")
            || IsSuccess("WASH_COMPLETED -1")
            || IsSuccess("WASH_COMPLETED 24001")
            || IsSuccess("WASH_COMPLETED 9750 extra")
            || IsSuccess("ERROR WASH_NOT_STARTED")
            || staleWeightSnapshot != "SNAPSHOT 42 1000 2 5 0001.ore.e30=3,0002.washed_stone."
                + EncodeBase64Url("{\"quality\":100}") + "=1"
            || !baseline.TryGetValue("1\nore\n{}", out count) || count != 10
            || !canonicalBaseline.TryGetValue("2\nore\n" + canonicalMetadata, out count) || count != 3
            || largeToken.Length <= 8192 || largeToken.Length > MaximumMetadataTokenLength
            || !largeBaseline.TryGetValue("3\nore\n" + largeMetadata, out count) || count != 7
            || !exponentBaseline.TryGetValue("4\nore\n" + exponentMetadata, out count) || count != 2
            || !IsValidServerEpoch(serverEpoch)
            || IsValidServerEpoch(EncodeBase64Url("target-frame"))
            || IsValidServerEpoch(EncodeBase64Url("target\ninventory"))
            || IsValidServerEpoch(EncodeBase64Url("target\ninventory\nprogress\nextra"))
            || IsValidServerEpoch(EncodeBase64Url("target\r\ninventory\nprogress"))
            || IsValidServerEpoch("invalid+epoch")
            || !BaselineMetadataIsRejected("not-json")
            || DecodeIdentifier(EncodeIdentifier("trunk-test")) != "trunk-test"
            || DecodeBase64Url(EncodeBase64Url("{\"quality\":100}")) != "{\"quality\":100}"
            || companion.OpenCargo || !directCargoCompanion.OpenCargo || !companion.Registered
            || !companion.RegistrationTransactionSupported
            || companion.RegistrationTransactionPending
            || companion.RegistrationTransactionId != ""
            || companion.RegistrationTransactionPreviousId != ""
            || companion.RegistrationTransactionStartedAt != 0
            || companion.RegistrationTransactionExpiresAt != 0
            || companion.RegistrationTransactionStatus != "idle"
            || !pendingTransaction.RegistrationTransactionSupported
            || !pendingTransaction.RegistrationTransactionPending
            || pendingTransaction.RegistrationTransactionId != candidateRegistrationId
            || pendingTransaction.RegistrationTransactionPreviousId != previousRegistrationId
            || pendingTransaction.RegistrationTransactionStartedAt != 12345
            || pendingTransaction.RegistrationTransactionExpiresAt != 12525
            || pendingTransaction.RegistrationTransactionStatus != "staged"
            || companion.LastCommand != "ox-target-register"
            || !companion.ServerRegistrationSynchronized
            || companionStatusFields.Length != 17 || companionStatusFields[13] != "REGISTERED"
            || companionStatusFields[14] != "1" || companionStatusFields[15] != "0"
            || companionStatusFields[16] != "1"
            || pendingCompanionStatusFields.Length != 17
            || pendingCompanionStatusFields[14] != "1"
            || pendingCompanionStatusFields[15] != "1"
            || pendingCompanionStatusFields[16] != "1"
            || unsynchronizedCompanion.ServerRegistrationSynchronized
            || unsynchronizedCompanionStatusFields.Length != 17
            || unsynchronizedCompanionStatusFields[16] != "0"
            || !CompanionCommandStartObserved("arm-register", companion, armStarted)
            || CompanionCommandStartObserved("go-vehicle", companion, armStarted)
            || !IsAllowedCompanionCommand("commit-registration")
            || !IsAllowedCompanionCommand("abort-registration")
            || !CompanionCommandRequiresRegistration("commit-registration")
            || !CompanionCommandRequiresRegistration("abort-registration")
            || !IsKnownCompanionResultCommand("commit-registration")
            || !IsKnownCompanionResultCommand("abort-registration")
            || !IsKnownCompanionResultCommand("registration-transaction")
            || !CompanionCommandStartObserved("commit-registration", companion, transactionStarted)
            || !CompanionCommandStartObserved("abort-registration", companion, transactionStarted)
            || !CompanionStateIsRejected(legacyCompanionJson, "COMPANION_INCOMPATIBLE")
            || !CompanionStateIsRejected(companionJson.Replace(
                    "\"transactionalRegistration\":true,", ""),
                "COMPANION_INCOMPATIBLE")
            || !CompanionStateIsRejected(companionJson.Replace(
                    "\"registrationCommit\":true,", ""),
                "COMPANION_INCOMPATIBLE")
            || !CompanionStateIsRejected(companionJson.Replace(
                    "\"serverRegistrationSync\":true,", ""),
                "COMPANION_INCOMPATIBLE")
            || !CompanionStateIsRejected(companionJson.Replace(
                    "\"serverRegistrationSync\":true", "\"serverRegistrationSync\":\"true\""),
                "COMPANION_STATE_INVALID")
            || !CompanionStateIsRejected(companionJson.Replace(
                    "\"transactionalRegistration\":true", "\"transactionalRegistration\":false"),
                "COMPANION_INCOMPATIBLE")
            || !CompanionStateIsRejected(companionJson.Replace(
                    "\"registrationCommit\":true", "\"registrationCommit\":\"true\""),
                "COMPANION_STATE_INVALID")
            || !CompanionStateIsRejected(companionJson.Replace(idleTransactionJson + ",", ""),
                "COMPANION_INCOMPATIBLE")
            || !CompanionStateIsRejected(companionJson.Replace("\"cargoArrival\":true", "\"cargoArrival\":false"),
                "COMPANION_INCOMPATIBLE")
            || !CompanionStateIsRejected(companionJson.Replace("\"sequence\":7", "\"sequence\":\"7\""),
                "COMPANION_STATE_INVALID")
            || !CompanionStateIsRejected(companionJson.Replace("\"ox-target-register\"", "\"unknown-command\""),
                "COMPANION_STATE_INVALID")
            || !CompanionStateIsRejected(companionJson.Replace("\"present\":true", "\"present\":false"),
                "COMPANION_STATE_INVALID")
            || !CompanionStateIsRejected(pendingTransactionJson.Replace(
                    "\"id\":\"" + candidateRegistrationId + "\",\"previousId\"",
                    "\"id\":\"amv_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\",\"previousId\""),
                "COMPANION_STATE_INVALID")
            || !CompanionStateIsRejected(pendingTransactionJson.Replace(
                    "\"expiresAt\":12525", "\"expiresAt\":12345"),
                "COMPANION_STATE_INVALID")
            || !CompanionStateIsRejected(pendingTransactionJson.Replace(
                    "\"startedAt\":12345", "\"startedAt\":\"12345\""),
                "COMPANION_STATE_INVALID")
            || !CompanionStateIsRejected(pendingTransactionJson.Replace(
                    "\"pending\":true", "\"pending\":false"),
                "COMPANION_STATE_INVALID")
            || !CompanionResponseIsRejected("commit-registration", candidateRegistrationId,
                pendingTransaction, abortResponse)
            || !CompanionResponseIsRejected("abort-registration", candidateRegistrationId,
                pendingTransaction, commitResponse))
            throw new InvalidOperationException("SELFTEST_FAILED");
        return "SELFTEST OK";
    }

    private static bool CompanionStateIsRejected(string json, string expectedMessage)
    {
        try
        {
            ParseCompanionState(json);
            return false;
        }
        catch (InvalidOperationException error)
        {
            return expectedMessage == null || error.Message == expectedMessage;
        }
    }

    private static bool CompanionResponseIsRejected(string command, string registrationId,
        CompanionState initial, CompanionState response)
    {
        try
        {
            ValidateCompanionResponse(command, registrationId, initial, response);
            return false;
        }
        catch (InvalidOperationException error)
        {
            return error.Message == "COMPANION_RESPONSE_MISMATCH";
        }
    }

    private static bool BaselineMetadataIsRejected(string metadata)
    {
        try
        {
            ParseBaseline("0001.ore." + EncodeBase64Url(metadata) + "=1");
            return false;
        }
        catch (ArgumentException)
        {
            return true;
        }
    }

    private static bool RouteIsRejected(string route)
    {
        try
        {
            ParseRoute(route);
            return false;
        }
        catch (ArgumentException)
        {
            return true;
        }
    }

    private static async Task<string> RunTargetAsync(string mode)
    {
        bool clickMode = mode.StartsWith("click-", StringComparison.Ordinal);
        bool washingMode = mode.EndsWith("washing", StringComparison.Ordinal);
        bool goldMode = mode.EndsWith("gold", StringComparison.Ordinal);
        bool storageMode = mode.EndsWith("storage", StringComparison.Ordinal);
        string targetLabel = washingMode ? "石を洗う"
            : goldMode ? "砂金採りトレイ" : "鉱石を採掘する";
        string actionToken = washingMode ? "WASH" : goldMode ? "GOLD" : storageMode ? "STORAGE" : "MINE";
        bool exactOnly = washingMode || goldMode || storageMode;

        using (var session = await CdpSession.OpenAsync(TargetFramePart, TimeSpan.FromSeconds(4)).ConfigureAwait(false))
        {
            if (storageMode)
            {
                string storageState = await session.EvaluateStringAsync(
                    clickMode ? ClickStorageExpression() : ProbeStorageExpression(), clickMode).ConfigureAwait(false);
                if (clickMode && storageState == "CLICKED")
                    await Task.Delay(300, session.Token).ConfigureAwait(false);
                return storageState + " STORAGE";
            }
            string expression = washingMode
                ? WashTargetExpression(clickMode)
                : clickMode ? ClickExpression(targetLabel, exactOnly) : ProbeExpression(targetLabel, exactOnly);
            bool value = await session.EvaluateBooleanAsync(expression, clickMode).ConfigureAwait(false);
            if (clickMode && value)
                await Task.Delay(300, session.Token).ConfigureAwait(false);
            return (value ? (clickMode ? "CLICKED " : "PRESENT ") : "MISSING ") + actionToken;
        }
    }

    private static async Task<string> WaitWashCompletionAsync(string expectedEpoch)
    {
        var stopwatch = new Stopwatch();
        int progressState = 0;
        int idleAbsentSamples = 0;
        long progressArmedAt = -1;
        long progressAbsentAt = -1;
        bool monitorFailed = false;
        try
        {
            if (!await ServerEpochMatchesAsync(expectedEpoch).ConfigureAwait(false))
                return "ERROR SERVER_SESSION_CHANGED";
            using (var session = await CdpSession.OpenAsync(
                ProgressFramePart, TimeSpan.FromMilliseconds(24000)).ConfigureAwait(false))
            {
                // Connection/setup time must not consume the three-second start window.
                stopwatch.Start();
                while (stopwatch.ElapsedMilliseconds < WashProgressTotalMilliseconds)
                {
                    long elapsedMilliseconds = stopwatch.ElapsedMilliseconds;
                    bool visible = await session.EvaluateBooleanAsync(
                        WashProgressExpression(), false).ConfigureAwait(false);
                    int previousState = progressState;
                    progressState = AdvanceWashProgressState(progressState, visible);
                    if (!visible && progressState == 0)
                        idleAbsentSamples += 1;
                    else
                        idleAbsentSamples = 0;
                    if (progressState == 2 && previousState < 2)
                        progressArmedAt = elapsedMilliseconds;
                    if (visible)
                    {
                        progressAbsentAt = -1;
                    }
                    else if (progressState == 3 && previousState == 2)
                    {
                        progressAbsentAt = elapsedMilliseconds;
                    }
                    if (progressState == 4)
                    {
                        if (WashProgressCompletionReady(progressArmedAt,
                            progressAbsentAt, elapsedMilliseconds))
                        {
                            if (!await ServerEpochMatchesAsync(expectedEpoch).ConfigureAwait(false))
                                return "ERROR SERVER_SESSION_CHANGED";
                            return "WASH_COMPLETED "
                                + elapsedMilliseconds.ToString(CultureInfo.InvariantCulture);
                        }
                        // Keep the stable-absence candidate alive until both time floors pass.
                        progressState = 3;
                    }
                    // A first visible sample at the deadline still gets one poll to arm.
                    // Only the fully idle state proves that progress never started.
                    if (WashProgressStartTimedOut(progressState, idleAbsentSamples,
                        stopwatch.ElapsedMilliseconds))
                    {
                        if (!await ServerEpochMatchesAsync(expectedEpoch).ConfigureAwait(false))
                            return "ERROR SERVER_SESSION_CHANGED";
                        return "ERROR WASH_NOT_STARTED";
                    }

                    await Task.Delay(WashProgressPollMilliseconds, session.Token).ConfigureAwait(false);
                }
            }
        }
        catch (Exception)
        {
            // Re-check below after the failed/expired CDP session has been disposed.
            monitorFailed = true;
        }
        if (!await ServerEpochMatchesAsync(expectedEpoch).ConfigureAwait(false))
            return "ERROR SERVER_SESSION_CHANGED";
        if (monitorFailed)
            return "ERROR WASH_PROGRESS_UNAVAILABLE";
        return progressState < 2 ? "ERROR WASH_NOT_STARTED" : "ERROR WASH_COMPLETION_TIMEOUT";
    }

    private static async Task<string> TryActionAsync(string mode, string expectedEpoch)
    {
        bool probeOnly = mode == "try-probe-mining";
        bool washingMode = mode == "try-washing";
        bool goldMode = mode == "try-gold";
        string targetLabel = washingMode ? "石を洗う" : goldMode ? "砂金採りトレイ" : "鉱石を採掘する";
        string actionToken = washingMode ? "WASH" : goldMode ? "GOLD" : "MINE";
        bool exactOnly = washingMode || goldMode;
        int port = 0;
        bool washClickMayHaveBeenDispatched = false;
        try
        {
            if (!SendRelease(0))
                throw new InvalidOperationException("INPUT_RELEASE_UNAVAILABLE");
            port = ActivatePort();
            int sessionMilliseconds = washingMode ? 9000 : 5000;
            using (var session = await CdpSession.OpenAsync(
                TargetFramePart, TimeSpan.FromMilliseconds(sessionMilliseconds)).ConfigureAwait(false))
            {
                if (probeOnly)
                {
                    await Task.Delay(350, session.Token).ConfigureAwait(false);
                    bool probeResult = await session.EvaluateBooleanAsync(
                        ProbeExpression(targetLabel, exactOnly), false).ConfigureAwait(false);
                    return (probeResult ? "PRESENT " : "MISSING ") + actionToken;
                }
                DateTime deadline = DateTime.UtcNow.AddMilliseconds(washingMode ? 7000 : 1600);
                while (DateTime.UtcNow < deadline)
                {
                    string expression = washingMode
                        ? WashTargetExpression(false) : ProbeExpression(targetLabel, exactOnly);
                    bool present = await session.EvaluateBooleanAsync(
                        expression, false).ConfigureAwait(false);
                    if (present)
                    {
                        if (washingMode
                            && !await ServerEpochMatchesAsync(expectedEpoch).ConfigureAwait(false))
                            return "ERROR SERVER_SESSION_CHANGED";
                        expression = washingMode
                            ? WashTargetExpression(true) : ClickExpression(targetLabel, exactOnly);
                        bool clicked;
                        if (washingMode)
                            washClickMayHaveBeenDispatched = true;
                        try
                        {
                            clicked = await session.EvaluateBooleanAsync(
                                expression, true).ConfigureAwait(false);
                        }
                        catch (Exception)
                        {
                            if (washingMode && washClickMayHaveBeenDispatched)
                                return "UNCERTAIN WASH";
                            throw;
                        }
                        if (!clicked)
                            washClickMayHaveBeenDispatched = false;
                        if (clicked)
                        {
                            try
                            {
                                await Task.Delay(300, session.Token).ConfigureAwait(false);
                            }
                            catch (Exception)
                            {
                                if (washingMode)
                                    return "UNCERTAIN WASH";
                                throw;
                            }
                            return "CLICKED " + actionToken;
                        }
                    }
                    await Task.Delay(85, session.Token).ConfigureAwait(false);
                }
                return "MISSING " + actionToken;
            }
        }
        finally
        {
            if (!(port != 0 ? SendRelease(port) : SendRelease(0))
                && !(washingMode && washClickMayHaveBeenDispatched))
                throw new InvalidOperationException("INPUT_RELEASE_UNAVAILABLE");
        }
    }

    private static async Task<bool> ServerEpochMatchesAsync(string expectedEpoch)
    {
        if (!IsValidServerEpoch(expectedEpoch))
            return false;
        try
        {
            string healthResult = await HealthAsync().ConfigureAwait(false);
            return String.Equals(healthResult, "HEALTH READY " + expectedEpoch,
                StringComparison.Ordinal);
        }
        catch (Exception)
        {
            return false;
        }
    }

    private static async Task<string> InventorySnapshotAsync()
    {
        string raw = await EvaluateInventoryStringAsync(
            InventorySnapshotExpression(), TimeSpan.FromSeconds(5), false).ConfigureAwait(false);
        return FormatInventorySnapshotResult(raw);
    }

    private static string FormatInventorySnapshotResult(string raw)
    {
        if (!raw.StartsWith("SNAPSHOT_DETAIL ", StringComparison.Ordinal))
            return raw;

        var detail = Json.DeserializeObject(raw.Substring(16)) as Dictionary<string, object>;
        if (detail == null)
            return "ERROR INVALID_INVENTORY";
        object itemsValue;
        var items = detail.TryGetValue("items", out itemsValue) ? itemsValue as object[] : null;
        if (items == null)
            return "ERROR INVALID_INVENTORY";

        var counts = new SortedDictionary<string, long>(StringComparer.Ordinal);
        var seenSlots = new HashSet<int>();
        int slotLimit;
        if (!Int32.TryParse(IntegerField(detail, "slots"), NumberStyles.None,
            CultureInfo.InvariantCulture, out slotLimit) || slotLimit < 1 || slotLimit > 1000)
            return "ERROR INVALID_INVENTORY";
        foreach (object value in items)
        {
            var item = value as Dictionary<string, object>;
            if (item == null)
                return "ERROR INVALID_INVENTORY";
            string name = GetString(item, "name");
            string metadata = GetString(item, "meta");
            int count;
            int slot;
            if (!Int32.TryParse(IntegerField(item, "slot"), NumberStyles.None,
                    CultureInfo.InvariantCulture, out slot) || slot < 1 || slot > slotLimit
                || !seenSlots.Add(slot) || !ItemNamePattern.IsMatch(name) || metadata.Length == 0
                || Encoding.UTF8.GetByteCount(metadata) > 8192
                || !Int32.TryParse(IntegerField(item, "count"), NumberStyles.None,
                    CultureInfo.InvariantCulture, out count) || count <= 0)
                return "ERROR INVALID_INVENTORY";
            string key = slot.ToString("D4", CultureInfo.InvariantCulture) + "."
                + name + "." + EncodeBase64Url(metadata);
            long previous;
            counts.TryGetValue(key, out previous);
            long combined = previous + count;
            if (combined > Int32.MaxValue)
                return "ERROR INVALID_INVENTORY";
            counts[key] = combined;
        }

        var parts = new List<string>(counts.Count);
        foreach (KeyValuePair<string, long> pair in counts)
            parts.Add(pair.Key + "=" + pair.Value.ToString(CultureInfo.InvariantCulture));
        string baseline = parts.Count == 0 ? "-" : String.Join(",", parts.ToArray());
        if (baseline.Length > 24000)
            return "ERROR INVENTORY_TOO_LARGE";
        return "SNAPSHOT " + IntegerField(detail, "weight") + " "
            + IntegerField(detail, "max") + " " + IntegerField(detail, "used") + " "
            + IntegerField(detail, "slots") + " " + baseline;
    }

    private static string InventorySnapshotExpression()
    {
        return "(() => {" + InventoryPrelude()
            + "const store=findStore();if(!store)return 'ERROR INVENTORY_UNAVAILABLE';"
            + "let inv;try{inv=store.getState().inventory;}catch(e){return 'ERROR INVENTORY_UNAVAILABLE';}"
            + "const left=inv&&inv.leftInventory;if(!left||String(left.type||'').toLowerCase()!=='player')return 'ERROR INVENTORY_UNAVAILABLE';"
            + "const meta=v=>{if(v===undefined||v===null)return '{}';try{if(typeof v!=='object')return JSON.stringify(v);"
            + "const clean=x=>{if(x===null||typeof x!=='object')return x;if(Array.isArray(x))return x.map(clean);const o=Object.create(null);for(const k of Object.keys(x).sort())o[k]=clean(x[k]);return o;};return JSON.stringify(clean(v));}catch(e){return ''}};"
            + "const items=Array.isArray(left.items)?left.items:[],entries=[];let calculatedWeight=0,used=0;"
            + "for(const item of items){if(!item||!item.name||num(item.count)<=0)continue;"
            + "const name=String(item.name),count=Math.trunc(num(item.count));if(!/^[A-Za-z0-9_-]{1,64}$/.test(name))return 'ERROR UNSUPPORTED_ITEM_NAME';"
            + "if(count<=0||count>2147483647)return 'ERROR INVALID_INVENTORY';const metadata=meta(item.metadata);if(!metadata)return 'ERROR INVALID_METADATA';"
            + "const slot=Math.trunc(num(item.slot));if(slot<1||slot>1000)return 'ERROR INVALID_INVENTORY';"
            + "entries.push({slot:slot,name:name,count:count,meta:metadata});calculatedWeight+=Math.max(0,num(item.weight));used++;}"
            + "return 'SNAPSHOT_DETAIL '+JSON.stringify({weight:whole(calculatedWeight),max:whole(left.maxWeight),used:used,slots:whole(left.slots),items:entries});})()";
    }

    private static async Task<string> HealthAsync()
    {
        using (var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(4)))
        using (var socket = new ClientWebSocket())
        {
            await socket.ConnectAsync(new Uri(FindRootSocketUrl()), timeout.Token).ConfigureAwait(false);
            var response = await CommandAsync(socket, "Page.getFrameTree", null, timeout.Token).ConfigureAwait(false);
            var frameTree = GetObject(GetObject(response, "result"), "frameTree");
            string targetFrameId = FindFrame(frameTree, TargetFramePart);
            string inventoryFrameId = FindFrame(frameTree, InventoryFramePart);
            string progressFrameId = FindFrame(frameTree, ProgressFramePart);
            if (String.IsNullOrEmpty(targetFrameId)
                || String.IsNullOrEmpty(inventoryFrameId)
                || String.IsNullOrEmpty(progressFrameId))
                return "ERROR SERVER_SESSION_UNAVAILABLE";
            string epoch = EncodeBase64Url(targetFrameId + "\n" + inventoryFrameId
                + "\n" + progressFrameId);
            return "HEALTH READY " + epoch;
        }
    }

    private static async Task<string> CompanionStatusAsync()
    {
        using (var session = await CdpSession.OpenAsync(
            CompanionFramePart, TimeSpan.FromSeconds(5)).ConfigureAwait(false))
        {
            CompanionState state = await ReadCompanionStateAsync(session).ConfigureAwait(false);
            return FormatCompanionStatus(state);
        }
    }

    private static async Task<string> CompanionCommandAsync(string command, string registrationId)
    {
        command = (command ?? "").Trim().ToLowerInvariant();
        bool requiresRegistration = CompanionCommandRequiresRegistration(command);
        bool transactionCommand = command == "commit-registration"
            || command == "abort-registration";
        if (!IsAllowedCompanionCommand(command)
            || (requiresRegistration && !CompanionRegistrationPattern.IsMatch(registrationId))
            || (!requiresRegistration && !String.IsNullOrEmpty(registrationId)))
            throw new ArgumentException();

        int timeoutSeconds = command == "go-vehicle" || command == "return-work" ? 100
            : command == "open-cargo" ? 18 : 10;
        using (var session = await CdpSession.OpenAsync(
            CompanionFramePart, TimeSpan.FromSeconds(timeoutSeconds)).ConfigureAwait(false))
        {
            CompanionState initial = await ReadCompanionStateAsync(session).ConfigureAwait(false);
            if (!initial.ServerRegistrationSynchronized && command != "cancel")
                return "ERROR COMPANION_SERVER_REGISTRATION_SYNC_PENDING";
            if (transactionCommand && !initial.RegistrationTransactionSupported)
                return "ERROR COMPANION_UNSUPPORTED";
            if (!transactionCommand && requiresRegistration && (!initial.Registered
                || !String.Equals(initial.RegistrationId, registrationId, StringComparison.Ordinal)))
                return "ERROR COMPANION_REGISTRATION_NOT_FOUND";
            if (transactionCommand
                && ((initial.RegistrationTransactionPending
                        && !String.Equals(initial.RegistrationTransactionId, registrationId,
                            StringComparison.Ordinal))
                    || (!initial.RegistrationTransactionPending
                        && command == "commit-registration" && (!initial.Registered
                            || !String.Equals(initial.RegistrationId, registrationId,
                                StringComparison.Ordinal)))))
                return "ERROR COMPANION_REGISTRATION_TRANSACTION_NOT_FOUND";
            if (command == "open-cargo" && !initial.OpenCargo)
                return "ERROR COMPANION_UNSUPPORTED";

            string requestId = "req_" + Guid.NewGuid().ToString("N");
            string devConCommand = "aiminer_companion " + initial.Token + " " + requestId
                + " " + command + (requiresRegistration ? " " + registrationId : "");
            bool fallbackPending = TrySendDevCon(29200, devConCommand, 0);
            if (!fallbackPending && !TrySendDevCon(29300, devConCommand, 0))
                throw new InvalidOperationException("COMPANION_COMMAND_UNAVAILABLE");
            DateTime fallbackAt = DateTime.UtcNow.AddMilliseconds(1200);

            long lastSequence = initial.Sequence;
            while (true)
            {
                CompanionState state = await ReadCompanionStateAsync(session).ConfigureAwait(false);
                if (!String.Equals(state.Epoch, initial.Epoch, StringComparison.Ordinal)
                    || !String.Equals(state.Token, initial.Token, StringComparison.Ordinal)
                    || !String.Equals(state.ResourceVersion, initial.ResourceVersion, StringComparison.Ordinal)
                    || state.Sequence < lastSequence)
                    throw new InvalidOperationException("COMPANION_SESSION_CHANGED");
                lastSequence = state.Sequence;
                if (state.LastResultPresent
                    && String.Equals(state.LastRequestId, requestId, StringComparison.Ordinal))
                {
                    if (!String.Equals(state.LastCommand, command, StringComparison.Ordinal))
                        throw new InvalidOperationException("COMPANION_RESPONSE_MISMATCH");
                    if (!state.LastOk)
                        return "ERROR COMPANION_" + SafeCompanionCode(state.LastCode);
                    ValidateCompanionResponse(command, registrationId, initial, state);
                    string returnedId = state.LastRegistrationId;
                    if (String.IsNullOrEmpty(returnedId) && state.Registered)
                        returnedId = state.RegistrationId;
                    string encodedId = String.IsNullOrEmpty(returnedId)
                        ? "-" : EncodeIdentifier(returnedId);
                    return "COMPANION_DONE " + command + " "
                        + SafeCompanionCode(state.LastCode) + " " + encodedId + " "
                        + state.LastNetworkId.ToString(CultureInfo.InvariantCulture);
                }
                if (command == "arm-register" && initial.Status != "registration_armed"
                    && state.Sequence > initial.Sequence && state.Status == "registration_armed"
                    && !state.LastResultPresent)
                    return "COMPANION_DONE arm-register ARMED - 0";
                if (fallbackPending && CompanionCommandStartObserved(command, initial, state))
                    fallbackPending = false;
                if (fallbackPending && DateTime.UtcNow >= fallbackAt)
                {
                    // A successful TCP write is not an acknowledgement: another local FiveM
                    // client can own that port. Only fall back when the companion state did not
                    // enter this command's start state, and never broadcast to both ports at once.
                    TrySendDevCon(29300, devConCommand, 0);
                    fallbackPending = false;
                }
                await Task.Delay(100, session.Token).ConfigureAwait(false);
            }
        }
    }

    private static bool CompanionCommandStartObserved(string command, CompanionState initial,
        CompanionState current)
    {
        if (current.Sequence <= initial.Sequence || current.Status == initial.Status)
            return false;
        return (command == "arm-register" && current.Status == "registration_armed")
            || ((command == "register-nearby" || command == "clear-registration"
                    || command == "commit-registration" || command == "abort-registration")
                && current.Status == "registering")
            || (command == "go-vehicle" && current.Status == "navigating_vehicle")
            || (command == "open-cargo" && current.Status == "opening_cargo")
            || (command == "return-work" && current.Status == "returning_work");
    }

    private static bool CompanionCommandRequiresRegistration(string command)
    {
        return command == "go-vehicle" || command == "open-cargo"
            || command == "clear-registration" || command == "commit-registration"
            || command == "abort-registration";
    }

    private static bool IsAllowedCompanionCommand(string command)
    {
        return command == "arm-register" || command == "register-nearby"
            || command == "set-work-anchor" || command == "go-vehicle"
            || command == "open-cargo" || command == "return-work"
            || command == "cancel" || command == "clear-registration"
            || command == "commit-registration" || command == "abort-registration";
    }

    private static async Task<CompanionState> ReadCompanionStateAsync(CdpSession session)
    {
        const string expression = "(() => {try{const live=globalThis.__AI_MINER_COMPANION_STATE__;"
            + "if(live&&typeof live==='object')return JSON.stringify(live);"
            + "const node=document.getElementById('ai-miner-companion-state');"
            + "return node?String(node.textContent||''):'';}catch(e){return '';}})()";
        string text = await session.EvaluateStringAsync(expression, false).ConfigureAwait(false);
        return ParseCompanionState(text);
    }

    private static CompanionState ParseCompanionState(string text)
    {
        if (text == null || text.Length == 0 || text.Length > 32768)
            throw new InvalidOperationException("COMPANION_STATE_INVALID");
        Dictionary<string, object> root;
        try { root = Json.DeserializeObject(text) as Dictionary<string, object>; }
        catch { throw new InvalidOperationException("COMPANION_STATE_INVALID"); }
        if (root == null)
            throw new InvalidOperationException("COMPANION_STATE_INVALID");
        string protocol = StrictCompanionString(root, "protocol", 64);
        string resource = StrictCompanionString(root, "resource", 64);
        long protocolVersion = StrictInteger(root, "protocolVersion", 0, Int32.MaxValue);
        if (protocol != CompanionProtocol || resource != CompanionResource || protocolVersion != 1)
            throw new InvalidOperationException("COMPANION_INCOMPATIBLE");

        string resourceVersion = StrictCompanionString(root, "resourceVersion", 32);
        string epoch = StrictCompanionString(root, "epoch", 128);
        string token = StrictCompanionString(root, "token", 128);
        string status = StrictCompanionString(root, "status", 48);
        if (!CompanionVersionPattern.IsMatch(resourceVersion)
            || !CompanionEpochPattern.IsMatch(epoch)
            || !CompanionTokenPattern.IsMatch(token)
            || !IsKnownCompanionStatus(status))
            throw new InvalidOperationException("COMPANION_STATE_INVALID");

        var capabilities = StrictObject(root, "capabilities");
        foreach (string capability in new[] { "dynamicVehicleRegistration",
            "dynamicVehicleNavigation", "workAnchor", "returnToWork", "cancel", "cargoArrival" })
            if (!StrictBoolean(capabilities, capability))
                throw new InvalidOperationException("COMPANION_INCOMPATIBLE");
        if (!capabilities.ContainsKey("transactionalRegistration")
            || !capabilities.ContainsKey("registrationCommit")
            || !capabilities.ContainsKey("serverRegistrationSync"))
            throw new InvalidOperationException("COMPANION_INCOMPATIBLE");
        if (!StrictBoolean(capabilities, "transactionalRegistration")
            || !StrictBoolean(capabilities, "registrationCommit"))
            throw new InvalidOperationException("COMPANION_INCOMPATIBLE");
        bool serverRegistrationSynchronized = StrictBoolean(capabilities,
            "serverRegistrationSync");
        StrictBoolean(capabilities, "oxTarget");
        bool openCargo = StrictBoolean(capabilities, "openCargo");
        StrictDecimal(capabilities, "maxVehicleDistance", 1m, 100000m);

        var registration = StrictObject(root, "registration");
        bool registered = StrictBoolean(registration, "registered");
        string registrationId = StrictCompanionString(registration, "id", 40);
        string plate = StrictCompanionString(registration, "plate", 16);
        string label = StrictCompanionString(registration, "label", 48);
        long model = StrictInteger(registration, "model", 0, UInt32.MaxValue);
        long networkId = StrictInteger(registration, "networkId", 0, Int32.MaxValue);
        StrictInteger(registration, "lastSeen", 0, Int64.MaxValue);
        bool available = StrictBoolean(registration, "available");
        string availabilityCode = StrictCompanionString(registration, "availabilityCode", 64);
        if (registered != !String.IsNullOrEmpty(registrationId)
            || (registered && (!CompanionRegistrationPattern.IsMatch(registrationId)
                || String.IsNullOrEmpty(plate) || model == 0))
            || (!registered && (!String.IsNullOrEmpty(plate) || !String.IsNullOrEmpty(label)
                || model != 0 || networkId != 0 || available || !String.IsNullOrEmpty(availabilityCode)))
            || (available && networkId == 0)
            || (!String.IsNullOrEmpty(availabilityCode)
                && !CompanionCodePattern.IsMatch(availabilityCode)))
            throw new InvalidOperationException("COMPANION_STATE_INVALID");

        object transactionValue;
        if (!root.TryGetValue("registrationTransaction", out transactionValue))
            throw new InvalidOperationException("COMPANION_INCOMPATIBLE");
        var transaction = transactionValue as Dictionary<string, object>;
        if (transaction == null)
            throw new InvalidOperationException("COMPANION_STATE_INVALID");
        bool transactionPending = StrictBoolean(transaction, "pending");
        string transactionId = StrictCompanionString(transaction, "id", 40);
        string transactionPreviousId = StrictCompanionString(transaction, "previousId", 40);
        long transactionStartedAt = StrictInteger(transaction, "startedAt", 0, Int64.MaxValue);
        long transactionExpiresAt = StrictInteger(transaction, "expiresAt", 0, Int64.MaxValue);
        string transactionStatus = StrictCompanionString(transaction, "status", 16);
        if (transactionPending)
        {
            if (!CompanionRegistrationPattern.IsMatch(transactionId)
                || (!String.IsNullOrEmpty(transactionPreviousId)
                    && !CompanionRegistrationPattern.IsMatch(transactionPreviousId))
                || String.Equals(transactionId, transactionPreviousId, StringComparison.Ordinal)
                || transactionStartedAt <= 0 || transactionExpiresAt <= transactionStartedAt
                || transactionStatus != "staged" || !registered
                || !String.Equals(registrationId, transactionId, StringComparison.Ordinal))
                throw new InvalidOperationException("COMPANION_STATE_INVALID");
        }
        else if (!String.IsNullOrEmpty(transactionId)
            || !String.IsNullOrEmpty(transactionPreviousId) || transactionStartedAt != 0
            || transactionExpiresAt != 0 || transactionStatus != "idle")
        {
            throw new InvalidOperationException("COMPANION_STATE_INVALID");
        }

        var workAnchor = StrictObject(root, "workAnchor");
        bool workAnchorSet = StrictBoolean(workAnchor, "set");
        decimal workX = StrictDecimal(workAnchor, "x", -100000m, 100000m);
        decimal workY = StrictDecimal(workAnchor, "y", -100000m, 100000m);
        decimal workZ = StrictDecimal(workAnchor, "z", -100000m, 100000m);
        decimal workHeading = StrictDecimal(workAnchor, "heading", 0m, 360m);
        if (!workAnchorSet && (workX != 0m || workY != 0m || workZ != 0m || workHeading != 0m))
            throw new InvalidOperationException("COMPANION_STATE_INVALID");

        var navigation = StrictObject(root, "navigation");
        bool navigationActive = StrictBoolean(navigation, "active");
        string navigationKind = StrictCompanionString(navigation, "kind", 16);
        string navigationRegistrationId = StrictCompanionString(navigation, "registrationId", 40);
        long navigationNetworkId = StrictInteger(navigation, "networkId", 0, Int32.MaxValue);
        decimal distance = StrictDecimal(navigation, "distance", -1m, 100000m);
        long navigationAttempt = StrictInteger(navigation, "attempt", 0, Int32.MaxValue);
        long navigationStartedAt = StrictInteger(navigation, "startedAt", 0, UInt32.MaxValue);
        string navigationStatus = StrictCompanionString(navigation, "status", 48);
        if (!IsKnownCompanionNavigationStatus(navigationStatus)
            || (!String.IsNullOrEmpty(navigationRegistrationId)
                && !CompanionRegistrationPattern.IsMatch(navigationRegistrationId))
            || (!navigationActive && (!String.IsNullOrEmpty(navigationKind)
                || !String.IsNullOrEmpty(navigationRegistrationId) || navigationNetworkId != 0
                || distance != -1m || navigationAttempt != 0 || navigationStartedAt != 0
                || navigationStatus != "idle"))
            || (navigationActive && navigationKind != "vehicle" && navigationKind != "work"))
            throw new InvalidOperationException("COMPANION_STATE_INVALID");
        long distanceCentimeters = distance < 0 ? -1
            : Decimal.ToInt64(Decimal.Round(distance * 100m, 0, MidpointRounding.AwayFromZero));

        var lastResult = StrictObject(root, "lastResult");
        bool lastPresent = StrictBoolean(lastResult, "present");
        string lastRequestId = StrictCompanionString(lastResult, "requestId", 64);
        string lastCommand = StrictCompanionString(lastResult, "command", 48);
        bool lastOk = StrictBoolean(lastResult, "ok");
        string lastCode = StrictCompanionString(lastResult, "code", 64);
        string lastMessage = StrictCompanionString(lastResult, "message", 256);
        string lastRegistrationId = StrictCompanionString(lastResult, "registrationId", 40);
        long lastNetworkId = StrictInteger(lastResult, "networkId", 0, Int32.MaxValue);
        if (lastPresent && (!OperationTokenPattern.IsMatch(lastRequestId)
            || !CompanionCommandPattern.IsMatch(lastCommand)
            || !IsKnownCompanionResultCommand(lastCommand)
            || !CompanionCodePattern.IsMatch(lastCode)))
            throw new InvalidOperationException("COMPANION_STATE_INVALID");
        if (!String.IsNullOrEmpty(lastRegistrationId)
            && !CompanionRegistrationPattern.IsMatch(lastRegistrationId))
            throw new InvalidOperationException("COMPANION_STATE_INVALID");
        if (!lastPresent && (!String.IsNullOrEmpty(lastRequestId)
            || !String.IsNullOrEmpty(lastCommand) || lastOk || !String.IsNullOrEmpty(lastCode)
            || !String.IsNullOrEmpty(lastMessage) || !String.IsNullOrEmpty(lastRegistrationId)
            || lastNetworkId != 0))
            throw new InvalidOperationException("COMPANION_STATE_INVALID");

        var overlay = StrictObject(root, "overlay");
        StrictBoolean(overlay, "visible");
        StrictCompanionString(overlay, "title", 64);
        StrictCompanionString(overlay, "detail", 256);
        string overlayTone = StrictCompanionString(overlay, "tone", 16);
        if (overlayTone != "neutral" && overlayTone != "progress"
            && overlayTone != "success" && overlayTone != "error")
            throw new InvalidOperationException("COMPANION_STATE_INVALID");

        return new CompanionState {
            ResourceVersion = resourceVersion,
            Epoch = epoch,
            Token = token,
            Sequence = StrictInteger(root, "sequence", 0, Int64.MaxValue),
            Status = status,
            OpenCargo = openCargo,
            ServerRegistrationSynchronized = serverRegistrationSynchronized,
            RegistrationTransactionSupported = true,
            RegistrationTransactionPending = transactionPending,
            RegistrationTransactionId = transactionId,
            RegistrationTransactionPreviousId = transactionPreviousId,
            RegistrationTransactionStartedAt = transactionStartedAt,
            RegistrationTransactionExpiresAt = transactionExpiresAt,
            RegistrationTransactionStatus = transactionStatus,
            Registered = registered,
            RegistrationId = registrationId,
            Plate = plate,
            Label = label,
            Model = model,
            NetworkId = networkId,
            Available = available,
            DistanceCentimeters = distanceCentimeters,
            LastResultPresent = lastPresent,
            LastRequestId = lastRequestId,
            LastCommand = lastCommand,
            LastOk = lastOk,
            LastCode = lastPresent ? lastCode : "NONE",
            LastRegistrationId = lastRegistrationId,
            LastNetworkId = lastNetworkId
        };
    }

    private static void ValidateCompanionResponse(string command, string registrationId,
        CompanionState initial, CompanionState state)
    {
        if ((command == "go-vehicle" || command == "open-cargo")
            && !String.Equals(state.LastRegistrationId, registrationId, StringComparison.Ordinal))
            throw new InvalidOperationException("COMPANION_RESPONSE_MISMATCH");
        if (command == "clear-registration"
            && (!String.IsNullOrEmpty(state.LastRegistrationId) || state.LastNetworkId != 0
                || state.Registered))
            throw new InvalidOperationException("COMPANION_RESPONSE_MISMATCH");
        if ((command == "arm-register" || command == "register-nearby")
            && (!state.Registered
                || !String.Equals(state.LastRegistrationId, state.RegistrationId,
                    StringComparison.Ordinal)
                || (state.RegistrationTransactionSupported
                    && (!state.RegistrationTransactionPending
                        || !String.Equals(state.RegistrationTransactionId,
                            state.RegistrationId, StringComparison.Ordinal)))))
            throw new InvalidOperationException("COMPANION_RESPONSE_MISMATCH");
        if (command == "commit-registration"
            && (!state.RegistrationTransactionSupported
                || state.RegistrationTransactionPending || !state.Registered
                || !String.Equals(state.RegistrationId, registrationId, StringComparison.Ordinal)
                || !String.Equals(state.LastRegistrationId, registrationId,
                    StringComparison.Ordinal)))
            throw new InvalidOperationException("COMPANION_RESPONSE_MISMATCH");
        if (command == "abort-registration")
        {
            string expectedRegistrationId = initial.RegistrationTransactionPending
                ? initial.RegistrationTransactionPreviousId
                : initial.Registered ? initial.RegistrationId : "";
            if (!state.RegistrationTransactionSupported
                || state.RegistrationTransactionPending
                || (String.IsNullOrEmpty(expectedRegistrationId)
                    ? state.Registered
                    : !state.Registered || !String.Equals(state.RegistrationId,
                        expectedRegistrationId, StringComparison.Ordinal)))
                throw new InvalidOperationException("COMPANION_RESPONSE_MISMATCH");
        }
    }

    private static bool IsKnownCompanionResultCommand(string command)
    {
        return command == "arm-register" || command == "register-nearby"
            || command == "set-work-anchor" || command == "go-vehicle"
            || command == "open-cargo" || command == "return-work"
            || command == "cancel" || command == "clear-registration"
            || command == "commit-registration" || command == "abort-registration"
            || command == "capabilities" || command == "status"
            || command == "ox-target-register" || command == "registration-transaction";
    }

    private static bool IsKnownCompanionStatus(string status)
    {
        return status == "ready" || status == "registration_armed"
            || status == "registering" || status == "error"
            || status == "navigating_vehicle" || status == "arrived_vehicle"
            || status == "returning_work" || status == "arrived_work"
            || status == "cancelled" || status == "opening_cargo";
    }

    private static bool IsKnownCompanionNavigationStatus(string status)
    {
        return status == "idle" || status == "resolving" || status == "streaming"
            || status == "moving" || status == "validating_arrival";
    }

    private static string FormatCompanionStatus(CompanionState state)
    {
        string id = state.Registered ? EncodeIdentifier(state.RegistrationId) : "-";
        string plate = state.Registered ? EncodeIdentifier(state.Plate) : "-";
        string label = state.Registered ? EncodeIdentifier(state.Label) : "-";
        return "COMPANION 1 " + state.ResourceVersion + " " + state.Epoch + " "
            + state.Sequence.ToString(CultureInfo.InvariantCulture) + " " + state.Status + " "
            + (state.Registered ? "1" : "0") + " " + id + " " + plate + " " + label + " "
            + state.Model.ToString(CultureInfo.InvariantCulture) + " "
            + (state.Available ? "1" : "0") + " "
            + state.DistanceCentimeters.ToString(CultureInfo.InvariantCulture) + " "
             + SafeCompanionCode(state.LastCode) + " "
             + (state.RegistrationTransactionSupported ? "1" : "0") + " "
             + (state.RegistrationTransactionPending ? "1" : "0") + " "
             + (state.ServerRegistrationSynchronized ? "1" : "0");
    }

    private static Dictionary<string, object> StrictObject(Dictionary<string, object> source, string key)
    {
        object value;
        if (source == null || !source.TryGetValue(key, out value))
            throw new InvalidOperationException("COMPANION_STATE_INVALID");
        var result = value as Dictionary<string, object>;
        if (result == null)
            throw new InvalidOperationException("COMPANION_STATE_INVALID");
        return result;
    }

    private static bool StrictBoolean(Dictionary<string, object> source, string key)
    {
        object value;
        if (source == null || !source.TryGetValue(key, out value) || !(value is bool))
            throw new InvalidOperationException("COMPANION_STATE_INVALID");
        return (bool)value;
    }

    private static string StrictCompanionString(Dictionary<string, object> source, string key,
        int maximumLength)
    {
        object value;
        var result = source != null && source.TryGetValue(key, out value) ? value as string : null;
        if (result == null || result.Length > maximumLength)
            throw new InvalidOperationException("COMPANION_STATE_INVALID");
        foreach (char character in result)
            if (Char.IsControl(character))
                throw new InvalidOperationException("COMPANION_STATE_INVALID");
        return result;
    }

    private static long StrictInteger(Dictionary<string, object> source, string key, long minimum, long maximum)
    {
        decimal value = StrictDecimal(source, key, minimum, maximum);
        if (value != Decimal.Truncate(value))
            throw new InvalidOperationException("COMPANION_STATE_INVALID");
        return Decimal.ToInt64(value);
    }

    private static decimal StrictDecimal(Dictionary<string, object> source, string key,
        decimal minimum, decimal maximum)
    {
        object raw;
        decimal value;
        if (source == null || !source.TryGetValue(key, out raw) || raw == null
            || !IsJsonNumber(raw)
            || !Decimal.TryParse(Convert.ToString(raw, CultureInfo.InvariantCulture),
                NumberStyles.Float, CultureInfo.InvariantCulture, out value)
            || value < minimum || value > maximum)
            throw new InvalidOperationException("COMPANION_STATE_INVALID");
        return value;
    }

    private static bool IsJsonNumber(object value)
    {
        return value is Byte || value is SByte || value is Int16 || value is UInt16
            || value is Int32 || value is UInt32 || value is Int64 || value is UInt64
            || value is Single || value is Double || value is Decimal;
    }

    private static string SafeCompanionCode(string value)
    {
        string code = String.IsNullOrEmpty(value) ? "NONE" : value.Trim().ToUpperInvariant();
        return CompanionCodePattern.IsMatch(code)
            ? code : "INVALID_RESULT";
    }

    private static async Task<string> CaptureStorageAsync()
    {
        string expression = "(() => {" + InventoryPrelude()
            + "if(!inventoryVisible())return 'ERROR INVENTORY_CLOSED';const store=findStore();if(!store)return 'ERROR INVENTORY_UNAVAILABLE';"
            + "let inv;try{inv=store.getState().inventory;}catch(e){return 'ERROR INVENTORY_UNAVAILABLE';}"
            + "const right=inv&&inv.rightInventory,type=String(right&&right.type||'').toLowerCase();"
            + "if(!right||right.id===undefined||right.id===null||String(right.id).length===0)return 'ERROR STORAGE_UNAVAILABLE';"
            + "if(type!=='trunk')return 'ERROR NOT_REAR_STORAGE';"
            + "const items=Array.isArray(right.items)?right.items:[];let calculatedWeight=0,used=0;for(const item of items){"
            + "if(!item||!item.name||num(item.count)<=0)continue;calculatedWeight+=Math.max(0,num(item.weight));used++;}"
            + "const serverWeight=Number(right.weight),hasServerWeight=right.weight!==undefined&&right.weight!==null&&Number.isFinite(serverWeight)&&serverWeight>=0;"
            + "return 'CAPTURE '+JSON.stringify({id:String(right.id),type:type,weight:whole(hasServerWeight?serverWeight:calculatedWeight),max:whole(right.maxWeight),used:used,slots:whole(right.slots)});})()";
        string raw = await EvaluateInventoryStringAsync(expression, TimeSpan.FromSeconds(5), false).ConfigureAwait(false);
        if (!raw.StartsWith("CAPTURE ", StringComparison.Ordinal))
            return raw;
        var capture = Json.DeserializeObject(raw.Substring(8)) as Dictionary<string, object>;
        if (capture == null)
            return "ERROR STORAGE_UNAVAILABLE";
        string id = GetString(capture, "id");
        string type = GetString(capture, "type");
        if (String.IsNullOrEmpty(id) || type != "trunk")
            return "ERROR STORAGE_UNAVAILABLE";
        return "STORAGE " + EncodeIdentifier(id) + " " + EncodeIdentifier(type) + " "
            + IntegerField(capture, "weight") + " " + IntegerField(capture, "max") + " "
            + IntegerField(capture, "used") + " " + IntegerField(capture, "slots");
    }

    private static async Task<string> DepositDeltaAsync(
        string storageId, string storageType, Dictionary<string, int> baseline,
        string operationToken)
    {
        string expectedId = Json.Serialize(storageId);
        string expectedType = Json.Serialize(storageType);
        string expectedOperationToken = Json.Serialize(operationToken);
        // Parse JSON text inside the NUI and copy it into null-prototype maps so even
        // syntactically valid item names such as "constructor" cannot touch object prototypes.
        string expectedCounts = Json.Serialize(Json.Serialize(baseline));
        string expression = "(async () => {" + InventoryPrelude()
            + "const expectedId=" + expectedId + ",expectedType=" + expectedType
            + ",operationToken=" + expectedOperationToken
            + ",baselineRaw=JSON.parse(" + expectedCounts + "),baselineBySlot=Object.create(null),baselineTotals=Object.create(null),baselineNames=Object.create(null);"
            + "const cancelled=()=>{try{return !!(globalThis.__aiMinerCancelledOperations&&globalThis.__aiMinerCancelledOperations[operationToken]);}catch(e){return true;}};if(cancelled())return 'ERROR CANCELLED';"
            + "const meta=v=>{if(v===undefined||v===null)return '{}';try{if(typeof v!=='object')return JSON.stringify(v);"
            + "const clean=x=>{if(x===null||typeof x!=='object')return x;if(Array.isArray(x))return x.map(clean);const o=Object.create(null);for(const k of Object.keys(x).sort())o[k]=clean(x[k]);return o;};return JSON.stringify(clean(v));}catch(e){return ''}};"
            + "for(const rawKey of Object.keys(baselineRaw)){const first=rawKey.indexOf('\\n'),second=rawKey.indexOf('\\n',first+1);"
            + "const slot=Math.trunc(num(rawKey.slice(0,first))),name=rawKey.slice(first+1,second),metadata=rawKey.slice(second+1),count=Math.trunc(num(baselineRaw[rawKey]));"
            + "if(first<1||second<=first+1||slot<1||slot>1000||!/^[A-Za-z0-9_-]{1,64}$/.test(name)||!metadata||count<=0||baselineBySlot[slot])return 'ERROR INVALID_BASELINE';"
            + "let parsedMetadata;try{parsedMetadata=JSON.parse(metadata);}catch(e){return 'ERROR INVALID_BASELINE';}if(meta(parsedMetadata)!==metadata)return 'ERROR INVALID_BASELINE';"
            + "const key=name+'\\n'+metadata;baselineBySlot[slot]={key:key,name:name,count:count};baselineTotals[key]=(baselineTotals[key]||0)+count;baselineNames[name]=(baselineNames[name]||0)+count;}"
            + "if(!inventoryVisible())return 'ERROR INVENTORY_CLOSED';const store=findStore();if(!store)return 'ERROR INVENTORY_UNAVAILABLE';"
            + "const read=()=>{try{return store.getState().inventory;}catch(e){return null;}};"
            + "const validState=()=>{const inv=read(),r=inv&&inv.rightInventory,t=String(r&&r.type||'').toLowerCase();"
            + "return inv&&inv.leftInventory&&String(inv.leftInventory.type||'').toLowerCase()==='player'&&r&&String(r.id)===expectedId"
            + "&&t===expectedType?inv:null;};"
            + "let inv=validState();if(!inv){const raw=read(),r=raw&&raw.rightInventory,t=String(r&&r.type||'').toLowerCase();"
            + "if(r&&(String(r.id)!==expectedId||t!==expectedType))return 'ERROR WRONG_STORAGE';return 'ERROR INVENTORY_UNAVAILABLE';}"
            + "const right=inv.rightInventory,rightItems=Array.isArray(right.items)?right.items:[],leftItems=Array.isArray(inv.leftInventory.items)?inv.leftInventory.items:[];"
            + "const leftSlots=whole(inv.leftInventory.slots);if(leftSlots<1||leftSlots>1000)return 'ERROR INVALID_INVENTORY';"
            + "const rows=[],seenLeft=Object.create(null);for(const item of leftItems){if(!item||!item.name||num(item.count)<=0)continue;"
            + "const name=String(item.name),rawCount=num(item.count),count=Math.trunc(rawCount),slot=Math.trunc(num(item.slot)),metadata=meta(item.metadata);"
            + "if(!/^[A-Za-z0-9_-]{1,64}$/.test(name)||count<=0||rawCount!==count||slot<1||slot>leftSlots||seenLeft[slot]||!metadata)return 'ERROR INVALID_INVENTORY';"
            + "seenLeft[slot]=true;const key=name+'\\n'+metadata;rows.push({slot:slot,name:name,count:count,key:key,metadata:item.metadata,meta:metadata,stackable:item.stack===true,weight:Math.max(0,num(item.weight)),protected:0});}"
            + "rows.sort((a,b)=>a.slot-b.slot);const protect=Object.create(null),protectNames=Object.create(null);for(const key of Object.keys(baselineTotals))protect[key]=baselineTotals[key];for(const name of Object.keys(baselineNames))protectNames[name]=baselineNames[name];"
            + "for(const row of rows){const base=baselineBySlot[row.slot];if(!base||base.name!==row.name)continue;const reserve=Math.min(row.count,base.count);row.protected+=reserve;if(base.key===row.key)protect[row.key]=Math.max(0,num(protect[row.key])-reserve);protectNames[row.name]=Math.max(0,num(protectNames[row.name])-reserve);}"
            + "for(const row of rows){if(!protect[row.key])continue;const reserve=Math.min(row.count-row.protected,protect[row.key]);row.protected+=reserve;protect[row.key]-=reserve;protectNames[row.name]=Math.max(0,num(protectNames[row.name])-reserve);}"
            + "for(const row of rows){if(!protectNames[row.name])continue;const reserve=Math.min(row.count-row.protected,protectNames[row.name]);row.protected+=reserve;protectNames[row.name]-=reserve;}"
            + "let calculatedRightWeight=0,addWeight=0;for(const item of rightItems)if(item&&item.name&&num(item.count)>0)calculatedRightWeight+=Math.max(0,num(item.weight));"
            + "const serverRightWeight=Number(right.weight),rightWeight=right.weight!==undefined&&right.weight!==null&&Number.isFinite(serverRightWeight)&&serverRightWeight>=0?serverRightWeight:calculatedRightWeight;"
            + "const sources=[];let totalUnits=0;for(const row of rows){const take=row.count-row.protected;if(take<=0)continue;"
            + "if(row.metadata&&row.metadata.container!==undefined)return 'ERROR UNSAFE_ITEM';const per=row.count>0?row.weight/row.count:0;addWeight+=per*take;"
            + "sources.push({slot:row.slot,name:row.name,count:take,stackable:row.stackable,metadata:row.metadata,meta:row.meta});totalUnits+=take;}if(totalUnits<=0)return 'ERROR NO_DELTA';"
            + "const maxWeight=Math.max(0,num(right.maxWeight));if(maxWeight>0&&rightWeight+addWeight>maxWeight+.001)return 'ERROR STORAGE_FULL';"
            + "const slots=whole(right.slots);if(slots<1||slots>1000)return 'ERROR STORAGE_UNAVAILABLE';"
            + "const bySlot=Object.create(null);for(const item of rightItems){if(!item||!item.name||num(item.count)<=0)continue;const slot=Math.trunc(num(item.slot));"
            + "if(slot<1||slot>slots||bySlot[slot])return 'ERROR INVALID_INVENTORY';bySlot[slot]=item;}"
            + "const virtual=[];for(let slot=1;slot<=slots;slot++){const item=bySlot[slot]||{slot:slot};virtual.push({slot:slot,name:item.name?String(item.name):'',count:Math.max(0,Math.trunc(num(item.count))),meta:meta(item.metadata)});}"
            + "sources.sort((a,b)=>b.slot-a.slot);for(const source of sources){let target=null;if(source.stackable)target=virtual.find(v=>v.name===source.name&&v.meta===source.meta&&(v.count>0));"
            + "if(!target)target=virtual.find(v=>!v.name||v.count<=0);if(!target)return 'ERROR STORAGE_FULL';source.toSlot=target.slot;"
            + "if(!target.name){target.name=source.name;target.meta=source.meta;target.count=source.count;}else target.count+=source.count;}"
            + "const resource=typeof GetParentResourceName==='function'?String(GetParentResourceName()):'ox_inventory';"
            + "if(!/^[A-Za-z0-9_-]{1,64}$/.test(resource))return 'ERROR CALLBACK_UNAVAILABLE';let moved=0,stacks=0;"
            + "const metaTotal=(items,name,key)=>{let total=0;for(const item of (Array.isArray(items)?items:[]))if(item&&String(item.name||'')===name&&meta(item.metadata)===key)total+=Math.max(0,Math.trunc(num(item.count)));return total;};"
            + "const slotCount=(items,slot,name,key)=>{const item=(Array.isArray(items)?items:[]).find(v=>v&&Math.trunc(num(v.slot))===slot);return item&&String(item.name||'')===name&&meta(item.metadata)===key?Math.max(0,Math.trunc(num(item.count))):0;};"
            + "for(const source of sources){if(cancelled())return 'ERROR CANCELLED';inv=validState();if(!inv)return 'ERROR WRONG_STORAGE';if(!inventoryVisible())return 'ERROR INVENTORY_CLOSED';"
            + "const beforeLeft=metaTotal(inv.leftInventory.items,source.name,source.meta),beforeRight=metaTotal(inv.rightInventory.items,source.name,source.meta),beforeSlot=slotCount(inv.leftInventory.items,source.slot,source.name,source.meta);"
            + "if(beforeLeft<source.count||beforeSlot<source.count)return 'ERROR NO_PROGRESS';const payload={fromSlot:source.slot,toSlot:source.toSlot,fromType:inv.leftInventory.type,toType:inv.rightInventory.type,count:source.count};"
            + "let response;try{response=await Promise.race([fetch('https://'+resource+'/swapItems',{method:'post',headers:{'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify(payload)}).then(async r=>{if(!r.ok)throw new Error('http');return await r.json();}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),2500))]);}catch(e){return 'ERROR NO_PROGRESS';}"
            + "if(response===false)return 'ERROR MOVE_REJECTED';if(cancelled())return 'ERROR CANCELLED';let confirmed=false,deadline=Date.now()+2500;while(Date.now()<deadline){if(cancelled())return 'ERROR CANCELLED';await new Promise(resolve=>setTimeout(resolve,50));"
            + "inv=validState();if(!inv)return 'ERROR WRONG_STORAGE';const afterLeft=metaTotal(inv.leftInventory.items,source.name,source.meta),afterRight=metaTotal(inv.rightInventory.items,source.name,source.meta),afterSlot=slotCount(inv.leftInventory.items,source.slot,source.name,source.meta);"
            + "if(beforeLeft-afterLeft>=source.count&&beforeSlot-afterSlot>=source.count&&afterRight-beforeRight>=source.count){confirmed=true;break;}}if(!confirmed)return 'ERROR NO_PROGRESS';moved+=source.count;stacks++;}"
            + "try{if(globalThis.__aiMinerCancelledOperations)delete globalThis.__aiMinerCancelledOperations[operationToken];}catch(e){}return 'DEPOSITED '+moved+' '+stacks;})()";
        return await EvaluateInventoryStringAsync(expression, TimeSpan.FromSeconds(45), true).ConfigureAwait(false);
    }

    private static async Task<string> CancelOperationAsync(string operationToken)
    {
        string token = Json.Serialize(operationToken);
        string expression = "(() => {try{const token=" + token
            + ",root=globalThis;if(!root.__aiMinerCancelledOperations)root.__aiMinerCancelledOperations=Object.create(null);"
            + "root.__aiMinerCancelledOperations[token]=true;return true;}catch(e){return false;}})()";
        using (var session = await CdpSession.OpenAsync(InventoryFramePart, TimeSpan.FromSeconds(4)).ConfigureAwait(false))
        {
            bool cancelled = await session.EvaluateBooleanAsync(expression, false).ConfigureAwait(false);
            return cancelled ? "CANCELLED" : "ERROR CANCEL_FAILED";
        }
    }

    private static async Task<string> CloseInventoryAsync()
    {
        string expression = "(async () => {" + InventoryPrelude()
            + "if(!inventoryVisible())return 'CLOSED';const resource=typeof GetParentResourceName==='function'?String(GetParentResourceName()):'ox_inventory';"
            + "if(!/^[A-Za-z0-9_-]{1,64}$/.test(resource))return 'ERROR CALLBACK_UNAVAILABLE';"
            + "try{const response=await Promise.race([fetch('https://'+resource+'/exit',{method:'post',headers:{'Content-Type':'application/json; charset=UTF-8'},body:'{}'}).then(async r=>{if(!r.ok)throw new Error('http');return await r.json();}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),2500))]);"
            + "if(response===false)return 'ERROR CLOSE_FAILED';}catch(e){return 'ERROR CLOSE_FAILED';}"
            + "const deadline=Date.now()+2000;while(Date.now()<deadline){if(!inventoryVisible())return 'CLOSED';await new Promise(resolve=>setTimeout(resolve,40));}"
            + "return 'ERROR CLOSE_FAILED';})()";
        return await EvaluateInventoryStringAsync(expression, TimeSpan.FromSeconds(6), true).ConfigureAwait(false);
    }

    private static string InventoryPrelude()
    {
        return "const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0},whole=v=>Math.max(0,Math.round(num(v)));"
            + "const shown=e=>{if(!e||!e.isConnected)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.width>0&&r.height>0};"
            + "const inventoryVisible=()=>[...document.querySelectorAll('.inventory-wrapper')].some(shown);"
            + "const findStore=()=>{const root=document.getElementById('root');if(!root)return null;const queue=[],seen=new Set();"
            + "for(const key of Object.keys(root)){if(key.startsWith('__reactContainer$')||key.startsWith('__reactFiber$')){const value=root[key];queue.push(value&&value.current?value.current:value);}}"
            + "if(root._reactRootContainer)queue.push(root._reactRootContainer._internalRoot&&root._reactRootContainer._internalRoot.current||root._reactRootContainer);"
            + "let visited=0;while(queue.length&&visited<20000){const fiber=queue.shift();if(!fiber||seen.has(fiber))continue;seen.add(fiber);visited++;"
            + "const mp=fiber.memoizedProps,pp=fiber.pendingProps,candidates=[mp&&mp.store,pp&&pp.store,mp&&mp.value&&mp.value.store,pp&&pp.value&&pp.value.store,fiber.stateNode&&fiber.stateNode.store,fiber.stateNode];"
            + "for(const candidate of candidates){try{if(candidate&&typeof candidate.getState==='function'&&typeof candidate.dispatch==='function'&&candidate.getState()&&candidate.getState().inventory)return candidate;}catch(e){}}"
            + "if(fiber.child)queue.push(fiber.child);if(fiber.sibling)queue.push(fiber.sibling);if(fiber.return)queue.push(fiber.return);}return null;};";
    }

    private static async Task<string> EvaluateInventoryStringAsync(string expression, TimeSpan timeout, bool userGesture)
    {
        using (var session = await CdpSession.OpenAsync(InventoryFramePart, timeout).ConfigureAwait(false))
            return await session.EvaluateStringAsync(expression, userGesture).ConfigureAwait(false);
    }

    private static async Task<string> ActivateAsync()
    {
        if (!SendRelease(0))
            throw new InvalidOperationException("INPUT_RELEASE_UNAVAILABLE");
        int port = ActivatePort();
        await Task.Delay(180).ConfigureAwait(false);
        return "ACTIVATED " + port.ToString(CultureInfo.InvariantCulture);
    }

    private static int ActivatePort()
    {
        foreach (int port in new[] { 29200, 29300 })
            if (TrySendDevCon(port, "+ox_target"))
                return port;
        throw new InvalidOperationException("ACTIVATION_UNAVAILABLE");
    }

    private static bool SendRelease(int selectedPort, bool testPortAuthorized = false)
    {
        if (selectedPort == 29200 || selectedPort == 29300 || testPortAuthorized)
        {
            bool targetReleased = TrySendDevCon(selectedPort, "-ox_target");
            bool inputReleased = SendInputRelease(selectedPort);
            return targetReleased && inputReleased;
        }
        bool anyReleased = false;
        foreach (int port in new[] { 29200, 29300 })
        {
            bool targetReleased = TrySendDevCon(port, "-ox_target");
            bool inputReleased = SendInputRelease(port);
            anyReleased = anyReleased || (targetReleased && inputReleased);
        }
        return anyReleased;
    }

    private static bool SendInputRelease(int port)
    {
        return TrySendDevCon(port, InputReleaseCommand(), 0);
    }

    private static string NudgeForward(int port, int milliseconds)
    {
        string command = "-move_up_only;+move_up_only;wait "
            + milliseconds.ToString(CultureInfo.InvariantCulture) + ";-move_up_only";
        if (!TrySendDevCon(port, command))
            throw new InvalidOperationException("MOVEMENT_UNAVAILABLE");
        return "NUDGED " + port.ToString(CultureInfo.InvariantCulture);
    }

    private static string PlayRoute(int port, List<RouteStep> steps)
    {
        int total = 0;
        try
        {
            if (!TrySendDevCon(port, InputReleaseCommand(), 0))
                throw new InvalidOperationException("MOVEMENT_UNAVAILABLE");

            // Keep timing in this owned helper instead of queuing a long `wait` command in
            // FiveM.  The parent can terminate this helper on F9 and issue an immediate release;
            // no future movement remains buffered inside the game after cancellation.
            foreach (RouteStep step in steps)
            {
                var command = new StringBuilder(InputReleaseCommand());
                AppendRoutePresses(command, step.Mask);
                if (!TrySendDevCon(port, command.ToString(), 0))
                    throw new InvalidOperationException("MOVEMENT_UNAVAILABLE");
                total += step.Duration;
                Thread.Sleep(step.Duration);
            }
            return "ROUTE " + port.ToString(CultureInfo.InvariantCulture) + " "
                + total.ToString(CultureInfo.InvariantCulture);
        }
        finally
        {
            if (!SendInputRelease(port))
                throw new InvalidOperationException("INPUT_RELEASE_UNAVAILABLE");
        }
    }

    private static string PlayRouteWithHealth(int port, List<RouteStep> steps,
        string expectedEpoch)
    {
        int total = 0;
        int lastHealthAt = 0;
        string result = null;
        Exception pendingFailure = null;
        try
        {
            VerifyRouteHealth(port, expectedEpoch);
            foreach (RouteStep step in steps)
            {
                var command = new StringBuilder(InputReleaseCommand());
                AppendRoutePresses(command, step.Mask);
                if (!TrySendDevCon(port, command.ToString(), 0))
                    throw new InvalidOperationException("MOVEMENT_UNAVAILABLE");
                total += step.Duration;
                Thread.Sleep(step.Duration);

                if (total - lastHealthAt >= RouteHealthIntervalMilliseconds)
                {
                    VerifyRouteHealth(port, expectedEpoch);
                    lastHealthAt = total;
                }
            }
            if (lastHealthAt != total)
                VerifyRouteHealth(port, expectedEpoch);
            result = "ROUTE " + port.ToString(CultureInfo.InvariantCulture) + " "
                + total.ToString(CultureInfo.InvariantCulture);
        }
        catch (Exception ex)
        {
            pendingFailure = ex;
        }
        finally
        {
            if (!SendInputRelease(port) && pendingFailure == null)
                pendingFailure = new InvalidOperationException("INPUT_RELEASE_UNAVAILABLE");
        }

        if (pendingFailure != null)
            throw pendingFailure;
        return result;
    }

    private static void VerifyRouteHealth(int port, string expectedEpoch)
    {
        if (!SendInputRelease(port))
            throw new InvalidOperationException("INPUT_RELEASE_UNAVAILABLE");

        string healthResult;
        try
        {
            healthResult = HealthAsync().GetAwaiter().GetResult();
        }
        catch (Exception)
        {
            throw new InvalidOperationException("SERVER_SESSION_CHANGED");
        }
        if (!String.Equals(healthResult, "HEALTH READY " + expectedEpoch,
                StringComparison.Ordinal))
            throw new InvalidOperationException("SERVER_SESSION_CHANGED");
    }

    private static string SetViewInput(int port, int mask)
    {
        var command = new StringBuilder(ViewReleaseCommand());
        AppendViewPresses(command, mask);
        if (!TrySendDevCon(port, command.ToString(), 0))
            throw new InvalidOperationException("VIEW_UNAVAILABLE");
        return "VIEW " + port.ToString(CultureInfo.InvariantCulture) + " "
            + mask.ToString(CultureInfo.InvariantCulture);
    }

    private static string PressHotbar(int port, int slot, int milliseconds)
    {
        string commandName = "hotkey" + slot.ToString(CultureInfo.InvariantCulture);
        bool pressed = false;
        try
        {
            // ox_lib registers ox_inventory hotbar mappings as +hotkey1..+hotkey5.
            // Drive that registered command instead of synthesising a foreground key.
            if (!TrySendDevCon(port, "-" + commandName + ";+" + commandName, 0))
                throw new InvalidOperationException("HOTBAR_UNAVAILABLE");
            pressed = true;
            Thread.Sleep(milliseconds);
            if (!TrySendDevCon(port, "-" + commandName, 0))
                throw new InvalidOperationException("HOTBAR_RELEASE_UNAVAILABLE");
            pressed = false;
            return "HOTBAR " + port.ToString(CultureInfo.InvariantCulture) + " "
                + slot.ToString(CultureInfo.InvariantCulture);
        }
        finally
        {
            if (pressed)
                TrySendDevCon(port, "-" + commandName, 0);
        }
    }

    private static string PressInventory(int port, int milliseconds)
    {
        bool pressed = false;
        try
        {
            // ox_inventory registers its main keybind as "inv" through ox_lib.
            if (!TrySendDevCon(port, "-inv;+inv", 0))
                throw new InvalidOperationException("INVENTORY_KEY_UNAVAILABLE");
            pressed = true;
            Thread.Sleep(milliseconds);
            if (!TrySendDevCon(port, "-inv", 0))
                throw new InvalidOperationException("INVENTORY_KEY_RELEASE_UNAVAILABLE");
            pressed = false;
            return "INVENTORY " + port.ToString(CultureInfo.InvariantCulture);
        }
        finally
        {
            if (pressed)
                TrySendDevCon(port, "-inv", 0);
        }
    }

    private static string InputReleaseCommand()
    {
        return "-move_up_only;-move_left_only;-move_down_only;-move_right_only;"
            + ViewReleaseCommand()
            + ";-hotkey1;-hotkey2;-hotkey3;-hotkey4;-hotkey5;-inv";
    }

    private static string ViewReleaseCommand()
    {
        return "-look_up_only;-look_down_only;-look_left_only;-look_right_only;"
            + "-look_up;-look_down;-look_left;-look_right;"
            + "-scaled_look_up_only;-scaled_look_down_only;"
            + "-scaled_look_left_only;-scaled_look_right_only";
    }

    private static void AppendRoutePresses(StringBuilder command, int mask)
    {
        if ((mask & 1) != 0) command.Append(";+move_up_only");
        if ((mask & 2) != 0) command.Append(";+move_down_only");
        if ((mask & 4) != 0) command.Append(";+move_left_only");
        if ((mask & 8) != 0) command.Append(";+move_right_only");
        AppendViewPresses(command, (mask >> 4) & 15);
    }

    private static void AppendViewPresses(StringBuilder command, int mask)
    {
        // The *_ONLY controls have no keyboard default and did not move the camera
        // on supported production clients. The direct look controls are the same
        // controls used by mouse look, while still being releasable through DevCon.
        if ((mask & 1) != 0) command.Append(";+look_up");
        if ((mask & 2) != 0) command.Append(";+look_down");
        if ((mask & 4) != 0) command.Append(";+look_left");
        if ((mask & 8) != 0) command.Append(";+look_right");
    }

    private static bool IsValidViewMask(int mask)
    {
        return mask >= 0 && mask <= 15
            && (mask & 3) != 3 && (mask & 12) != 12;
    }

    private static List<RouteStep> ParseRoute(string input)
    {
        if (String.IsNullOrEmpty(input) || input.Length > 8192)
            throw new ArgumentException();
        string[] pieces = input.Split(',');
        if (pieces.Length == 0 || pieces.Length > MaximumRouteSteps)
            throw new ArgumentException();
        var steps = new List<RouteStep>(pieces.Length);
        int total = 0;
        foreach (string piece in pieces)
        {
            string[] fields = piece.Split(':');
            int duration;
            int mask;
            if (fields.Length != 2
                || !Int32.TryParse(fields[0], NumberStyles.None, CultureInfo.InvariantCulture, out duration)
                || !Int32.TryParse(fields[1], NumberStyles.None, CultureInfo.InvariantCulture, out mask)
                || duration < 25 || duration > 3000 || mask < 0 || mask > 255
                || ((mask & 1) != 0 && (mask & 2) != 0)
                || ((mask & 4) != 0 && (mask & 8) != 0)
                || ((mask & 16) != 0 && (mask & 32) != 0)
                || ((mask & 64) != 0 && (mask & 128) != 0))
                throw new ArgumentException();
            total += duration;
            if (total > MaximumRouteMilliseconds)
                throw new ArgumentException();
            steps.Add(new RouteStep(duration, mask));
        }
        return steps;
    }

    private static bool TryParseProductionDevConPort(string value, out int port)
    {
        return Int32.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out port)
            && (port == 29200 || port == 29300);
    }

    private static bool IsValidServerEpoch(string value)
    {
        if (!ServerEpochPattern.IsMatch(value ?? String.Empty))
            return false;
        try
        {
            string decoded = DecodeBase64Url(value);
            string[] frameIds = decoded.Split('\n');
            if (frameIds.Length != 3)
                return false;
            foreach (string frameId in frameIds)
            {
                if (String.IsNullOrEmpty(frameId))
                    return false;
                foreach (char character in frameId)
                    if (Char.IsControl(character))
                        return false;
            }
            return true;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }

    private static bool TryParseDevConPort(string value, string testToken, out int port,
        out bool testPortAuthorized)
    {
        testPortAuthorized = false;
        if (!Int32.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out port))
            return false;
        if (port == 29200 || port == 29300)
            return String.IsNullOrEmpty(testToken);
        if (port < 1024 || port > 65535 || !TestTokenPattern.IsMatch(testToken ?? String.Empty))
            return false;

        int configuredPort;
        string configuredPortText = Environment.GetEnvironmentVariable(TestPortEnvironmentVariable);
        string configuredToken = Environment.GetEnvironmentVariable(TestTokenEnvironmentVariable);
        if (!Int32.TryParse(configuredPortText, NumberStyles.None, CultureInfo.InvariantCulture,
                out configuredPort)
            || configuredPort != port
            || !TestTokenPattern.IsMatch(configuredToken ?? String.Empty)
            || !FixedTimeEquals(configuredToken, testToken))
            return false;

        testPortAuthorized = true;
        return true;
    }

    private static bool FixedTimeEquals(string left, string right)
    {
        if (left == null || right == null || left.Length != right.Length)
            return false;
        int difference = 0;
        for (int index = 0; index < left.Length; index++)
            difference |= left[index] ^ right[index];
        return difference == 0;
    }

    private static bool TrySendDevCon(int port, string command, int postWriteDelayMs = 75)
    {
        try
        {
            using (var client = new TcpClient())
            {
                Task connecting = client.ConnectAsync("127.0.0.1", port);
                if (!connecting.Wait(800)) return false;
                byte[] payload = Encoding.UTF8.GetBytes(command + "\0");
                int totalLength = 12 + payload.Length;
                byte[] packet = new byte[totalLength];
                packet[0] = (byte)'C'; packet[1] = (byte)'M';
                packet[2] = (byte)'N'; packet[3] = (byte)'D';
                packet[4] = 0x00; packet[5] = 0xD3;
                packet[6] = (byte)((totalLength >> 24) & 0xFF);
                packet[7] = (byte)((totalLength >> 16) & 0xFF);
                packet[8] = (byte)((totalLength >> 8) & 0xFF);
                packet[9] = (byte)(totalLength & 0xFF);
                packet[10] = 0; packet[11] = 0;
                Buffer.BlockCopy(payload, 0, packet, 12, payload.Length);
                NetworkStream stream = client.GetStream();
                stream.Write(packet, 0, packet.Length);
                stream.Flush();
                if (postWriteDelayMs > 0)
                    Thread.Sleep(postWriteDelayMs);
                return true;
            }
        }
        catch { return false; }
    }

    private static Dictionary<string, int> ParseBaseline(string input)
    {
        if (input == "-")
            return new Dictionary<string, int>(StringComparer.Ordinal);
        if (String.IsNullOrEmpty(input) || input.Length > 24000)
            throw new ArgumentException();
        var result = new Dictionary<string, int>(StringComparer.Ordinal);
        var seenSlots = new HashSet<int>();
        string previous = null;
        foreach (string pair in input.Split(','))
        {
            Match match = BaselineEntryPattern.Match(pair);
            int count;
            if (!match.Success
                || !Int32.TryParse(match.Groups["count"].Value, NumberStyles.None,
                    CultureInfo.InvariantCulture, out count)
                || count <= 0)
                throw new ArgumentException();
            int slot;
            if (!Int32.TryParse(match.Groups["slot"].Value, NumberStyles.None,
                    CultureInfo.InvariantCulture, out slot) || slot < 1 || slot > 1000
                || !seenSlots.Add(slot))
                throw new ArgumentException();
            string encodedKey = match.Groups["slot"].Value + "."
                + match.Groups["name"].Value + "." + match.Groups["meta"].Value;
            if (previous != null && String.CompareOrdinal(previous, encodedKey) >= 0)
                throw new ArgumentException();
            previous = encodedKey;
            string metadata = RequireValidMetadata(DecodeBase64Url(match.Groups["meta"].Value));
            result.Add(slot.ToString(CultureInfo.InvariantCulture) + "\n"
                + match.Groups["name"].Value + "\n" + metadata, count);
        }
        return result;
    }

    private static string RequireValidMetadata(string metadata)
    {
        object value;
        try
        {
            value = Json.DeserializeObject(metadata);
        }
        catch (Exception ex)
        {
            throw new ArgumentException("Baseline metadata is not valid JSON.", ex);
        }

        StringBuilder builder = new StringBuilder(metadata.Length);
        try
        {
            AppendCanonicalJson(builder, value, 0);
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw new ArgumentException("Baseline metadata cannot be normalized.", ex);
        }

        // Exact canonical equality is checked in the NUI with the same JSON.stringify
        // normalizer that produced the snapshot. .NET and ECMAScript can format valid
        // floating-point values differently (for example exponent notation).
        return metadata;
    }

    private static void AppendCanonicalJson(StringBuilder builder, object value, int depth)
    {
        if (depth > 64)
            throw new ArgumentException("Baseline metadata nesting is too deep.");
        if (value == null)
        {
            builder.Append("null");
            return;
        }

        string text = value as string;
        if (text != null)
        {
            AppendCanonicalJsonString(builder, text);
            return;
        }
        if (value is bool)
        {
            builder.Append((bool)value ? "true" : "false");
            return;
        }

        IDictionary<string, object> dictionary = value as IDictionary<string, object>;
        if (dictionary != null)
        {
            List<string> keys = new List<string>(dictionary.Keys);
            keys.Sort(StringComparer.Ordinal);
            builder.Append('{');
            for (int index = 0; index < keys.Count; index++)
            {
                if (index != 0)
                    builder.Append(',');
                string key = keys[index];
                AppendCanonicalJsonString(builder, key);
                builder.Append(':');
                AppendCanonicalJson(builder, dictionary[key], depth + 1);
            }
            builder.Append('}');
            return;
        }

        object[] array = value as object[];
        if (array != null)
        {
            builder.Append('[');
            for (int index = 0; index < array.Length; index++)
            {
                if (index != 0)
                    builder.Append(',');
                AppendCanonicalJson(builder, array[index], depth + 1);
            }
            builder.Append(']');
            return;
        }

        TypeCode typeCode = Type.GetTypeCode(value.GetType());
        if (typeCode == TypeCode.Byte || typeCode == TypeCode.SByte
            || typeCode == TypeCode.Int16 || typeCode == TypeCode.UInt16
            || typeCode == TypeCode.Int32 || typeCode == TypeCode.UInt32
            || typeCode == TypeCode.Int64 || typeCode == TypeCode.UInt64
            || typeCode == TypeCode.Single || typeCode == TypeCode.Double
            || typeCode == TypeCode.Decimal)
        {
            string number = Json.Serialize(value);
            if (!JsonNumberPattern.IsMatch(number))
                throw new ArgumentException("Baseline metadata contains an invalid number.");
            builder.Append(number);
            return;
        }

        throw new ArgumentException("Baseline metadata contains an unsupported JSON value.");
    }

    private static void AppendCanonicalJsonString(StringBuilder builder, string value)
    {
        builder.Append('"');
        for (int index = 0; index < value.Length; index++)
        {
            char character = value[index];
            switch (character)
            {
                case '"': builder.Append("\\\""); break;
                case '\\': builder.Append("\\\\"); break;
                case '\b': builder.Append("\\b"); break;
                case '\f': builder.Append("\\f"); break;
                case '\n': builder.Append("\\n"); break;
                case '\r': builder.Append("\\r"); break;
                case '\t': builder.Append("\\t"); break;
                default:
                    if (character < 0x20
                        || (Char.IsHighSurrogate(character)
                            && (index + 1 >= value.Length || !Char.IsLowSurrogate(value[index + 1])))
                        || Char.IsLowSurrogate(character))
                    {
                        builder.Append("\\u");
                        builder.Append(((int)character).ToString("x4", CultureInfo.InvariantCulture));
                    }
                    else
                    {
                        builder.Append(character);
                        if (Char.IsHighSurrogate(character))
                            builder.Append(value[++index]);
                    }
                    break;
            }
        }
        builder.Append('"');
    }

    private static string DecodeIdentifier(string encoded)
    {
        if (String.IsNullOrEmpty(encoded) || encoded.Length > 512 || !Base64Pattern.IsMatch(encoded)
            || encoded.Length % 4 != 0)
            throw new ArgumentException();
        byte[] bytes = Convert.FromBase64String(encoded);
        if (bytes.Length == 0 || bytes.Length > 256 || Convert.ToBase64String(bytes) != encoded)
            throw new ArgumentException();
        string value = new UTF8Encoding(false, true).GetString(bytes);
        if (String.IsNullOrEmpty(value))
            throw new ArgumentException();
        foreach (char character in value)
            if (Char.IsControl(character)) throw new ArgumentException();
        return value;
    }

    private static string EncodeIdentifier(string value)
    {
        byte[] bytes = new UTF8Encoding(false, true).GetBytes(value);
        if (bytes.Length == 0 || bytes.Length > 256)
            throw new InvalidOperationException("STORAGE_UNAVAILABLE");
        return Convert.ToBase64String(bytes);
    }

    private static string EncodeBase64Url(string value)
    {
        byte[] bytes = new UTF8Encoding(false, true).GetBytes(value);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static string DecodeBase64Url(string value)
    {
        if (String.IsNullOrEmpty(value) || value.Length > MaximumMetadataTokenLength
            || !Regex.IsMatch(value, "^[A-Za-z0-9_-]+$", RegexOptions.CultureInvariant))
            throw new ArgumentException();
        string padded = value.Replace('-', '+').Replace('_', '/');
        int remainder = padded.Length % 4;
        if (remainder == 1)
            throw new ArgumentException();
        if (remainder != 0)
            padded += new string('=', 4 - remainder);
        byte[] bytes = Convert.FromBase64String(padded);
        if (bytes.Length == 0 || bytes.Length > MaximumMetadataBytes)
            throw new ArgumentException();
        string decoded = new UTF8Encoding(false, true).GetString(bytes);
        if (EncodeBase64Url(decoded) != value)
            throw new ArgumentException();
        return decoded;
    }

    private static string FindRootSocketUrl()
    {
        string text;
        using (var client = new TimeoutWebClient())
        {
            client.Encoding = Encoding.UTF8;
            text = client.DownloadString(TargetsUrl);
        }
        var targets = Json.DeserializeObject(text) as object[];
        if (targets == null)
            throw new InvalidOperationException("DEBUG_TARGET_UNAVAILABLE");
        foreach (object item in targets)
        {
            var target = item as Dictionary<string, object>;
            if (target == null) continue;
            string url = GetString(target, "url");
            string socket = GetString(target, "webSocketDebuggerUrl");
            if (url == "nui://game/ui/root.html" && !String.IsNullOrEmpty(socket))
                return socket;
        }
        throw new InvalidOperationException("ROOT_UI_UNAVAILABLE");
    }

    private static async Task<Dictionary<string, object>> CommandAsync(
        ClientWebSocket socket, string method, Dictionary<string, object> parameters, CancellationToken token)
    {
        int id = Interlocked.Increment(ref _nextId);
        var message = new Dictionary<string, object> { { "id", id }, { "method", method } };
        if (parameters != null) message["params"] = parameters;
        byte[] payload = Encoding.UTF8.GetBytes(Json.Serialize(message));
        await socket.SendAsync(new ArraySegment<byte>(payload), WebSocketMessageType.Text, true, token).ConfigureAwait(false);

        while (true)
        {
            string responseText = await ReceiveTextAsync(socket, token).ConfigureAwait(false);
            var response = Json.DeserializeObject(responseText) as Dictionary<string, object>;
            if (response == null || !response.ContainsKey("id") || Convert.ToInt32(response["id"]) != id)
                continue;
            if (response.ContainsKey("error"))
                throw new InvalidOperationException("CDP_COMMAND_FAILED");
            return response;
        }
    }

    private static async Task<int> FindDefaultContextAsync(
        ClientWebSocket socket, string frameId, CancellationToken token)
    {
        int id = Interlocked.Increment(ref _nextId);
        var message = new Dictionary<string, object>
        {
            { "id", id }, { "method", "Runtime.enable" },
            { "params", new Dictionary<string, object>() }
        };
        byte[] payload = Encoding.UTF8.GetBytes(Json.Serialize(message));
        await socket.SendAsync(new ArraySegment<byte>(payload), WebSocketMessageType.Text, true, token).ConfigureAwait(false);

        bool responseReceived = false;
        int contextId = 0;
        while (!responseReceived || contextId == 0)
        {
            string responseText = await ReceiveTextAsync(socket, token).ConfigureAwait(false);
            var response = Json.DeserializeObject(responseText) as Dictionary<string, object>;
            if (response == null) continue;
            object responseId;
            if (response.TryGetValue("id", out responseId) && Convert.ToInt32(responseId) == id)
            {
                if (response.ContainsKey("error"))
                    throw new InvalidOperationException("CDP_CONTEXT_FAILED");
                responseReceived = true;
            }
            if (GetString(response, "method") != "Runtime.executionContextCreated")
                continue;
            try
            {
                var parameters = GetObject(response, "params");
                var context = GetObject(parameters, "context");
                var auxData = GetObject(context, "auxData");
                object isDefaultValue;
                bool isDefault = auxData.TryGetValue("isDefault", out isDefaultValue)
                    && Convert.ToBoolean(isDefaultValue);
                if (isDefault && GetString(auxData, "frameId") == frameId)
                    contextId = Convert.ToInt32(GetValue(context, "id"));
            }
            catch { }
        }
        return contextId;
    }

    private static async Task<string> ReceiveTextAsync(ClientWebSocket socket, CancellationToken token)
    {
        var buffer = new byte[8192];
        using (var stream = new MemoryStream())
        {
            WebSocketReceiveResult result;
            do
            {
                result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), token).ConfigureAwait(false);
                if (result.MessageType == WebSocketMessageType.Close)
                    throw new IOException("CDP_SOCKET_CLOSED");
                stream.Write(buffer, 0, result.Count);
            } while (!result.EndOfMessage);
            return Encoding.UTF8.GetString(stream.ToArray());
        }
    }

    private static string FindFrame(Dictionary<string, object> frameTree, string framePart)
    {
        var frame = GetObject(frameTree, "frame");
        if (GetString(frame, "url").IndexOf(framePart, StringComparison.OrdinalIgnoreCase) >= 0)
            return GetString(frame, "id");
        object childrenObject;
        if (frameTree.TryGetValue("childFrames", out childrenObject))
        {
            var children = childrenObject as object[];
            if (children != null)
            {
                foreach (object child in children)
                {
                    var childDictionary = child as Dictionary<string, object>;
                    if (childDictionary == null) continue;
                    string found = FindFrame(childDictionary, framePart);
                    if (!String.IsNullOrEmpty(found)) return found;
                }
            }
        }
        return null;
    }

    private static string ProbeExpression(string targetLabel, bool exactOnly)
    {
        return "(() => {"
            + "const q=" + Json.Serialize(targetLabel) + ",exact=" + (exactOnly ? "true" : "false")
            + ",n=s=>String(s||'').replace(/\\s+/g,' ').trim(),body=document.body;"
            + "if(!body||getComputedStyle(body).visibility!=='visible')return false;"
            + "const root=document.querySelector('#options-wrapper');if(!root)return false;"
            + "const match=t=>exact?t===q:(t===q||t.startsWith(q+' ')||t.startsWith(q+'（')||t.startsWith(q+'('));"
            + "const matches=[...root.querySelectorAll('*')].filter(e=>{const t=n(e.textContent);"
            + "return match(t)&&![...e.children].some(c=>match(n(c.textContent)));});"
            + "if(matches.length!==1)return false;const e=matches[0],s=getComputedStyle(e),r=e.getBoundingClientRect();"
            + "return s.visibility!=='hidden'&&s.display!=='none'&&r.width>0&&r.height>0;})()";
    }

    private static int AdvanceWashProgressState(int state, bool visible)
    {
        if (visible)
            return state == 0 ? 1 : 2;
        if (state == 0)
            return 0;
        if (state == 1)
            return 0;
        if (state == 2)
            return 3;
        if (state == 3)
            return 4;
        return state;
    }

    private static bool WashProgressCompletionReady(
        long progressArmedAt, long progressAbsentAt, long elapsedMilliseconds)
    {
        return progressArmedAt >= 0 && progressAbsentAt >= 0
            && elapsedMilliseconds >= progressArmedAt
                + WashProgressMinimumActiveMilliseconds
            && elapsedMilliseconds >= progressAbsentAt
                + WashProgressStableAbsentMilliseconds;
    }

    private static bool WashProgressStartTimedOut(
        int progressState, int idleAbsentSamples, long elapsedMilliseconds)
    {
        return progressState == 0 && idleAbsentSamples >= 3
            && elapsedMilliseconds >= WashProgressStartMilliseconds;
    }

    private static string WashProgressExpression()
    {
        return "(() => {"
            + "const q='石を洗っています',n=s=>String(s||'').replace(/\\s+/g,' ').trim(),body=document.body;"
            + "if(!body||!body.isConnected)return false;"
            + "const visible=e=>{if(!e||!e.isConnected)return false;for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);"
            + "if(s.visibility==='hidden'||s.display==='none'||Number(s.opacity)<=0)return false;}const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};"
            + "const progress=e=>{for(let p=e;p&&p!==body;p=p.parentElement){const s=getComputedStyle(p),names=String(s.animationName||'').split(',').map(v=>v.trim());"
            + "if(names.includes('progress-bar')&&String(s.animationPlayState||'running')!=='paused')return true;}return false;};"
            + "const starts=e=>n(e.textContent).startsWith(q),nodes=[...body.querySelectorAll('*')];"
            + "return nodes.some(e=>starts(e)&&![...e.children].some(starts)&&visible(e)&&progress(e));})()";
    }

    private static string WashTargetExpression(bool click)
    {
        // 洗浄地点は重なるzoneから同じラベルが複数届くことがあります。実際に操作可能な
        // hit要素へまとめ、選択状態、照準との距離、DOM順の順に一意に選びます。
        return "(() => {"
            + "const q='石を洗う',n=s=>String(s||'').replace(/\\s+/g,' ').trim(),body=document.body;"
            + "const shown=e=>{if(!e||!e.isConnected)return false;for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);"
            + "if(s.visibility==='hidden'||s.display==='none'||Number(s.opacity)<=0)return false;}return true;};"
            + "const visible=e=>{if(!shown(e))return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};"
            + "const usable=e=>visible(e)&&getComputedStyle(e).pointerEvents!=='none'&&!e.matches(':disabled')&&e.getAttribute('aria-disabled')!=='true';"
            + "if(!shown(body))return false;const root=document.querySelector('#options-wrapper');if(!shown(root))return false;"
            + "const match=e=>n(e.textContent)===q,leaves=[...root.querySelectorAll('*')].filter(e=>match(e)&&![...e.children].some(match));"
            + "const seen=new Set(),candidates=[];for(let order=0;order<leaves.length;order++){const leaf=leaves[order];"
            + "const hit=leaf.closest('.option-container,li,button,[role=button]')||leaf.closest('a')||leaf;"
            + "if(!root.contains(hit)||seen.has(hit)||!usable(leaf)||!usable(hit))continue;seen.add(hit);candidates.push({leaf,hit,order});}"
            + "if(!candidates.length)return false;"
            + (click
                ? "const semantic=e=>e.matches(':hover,:focus,:focus-within,.active,.selected,[aria-selected=true],[aria-current=true]')||!!e.querySelector(':hover,.active,.selected,[aria-selected=true],[aria-current=true]');"
                    + "const eye=[document.querySelector('#eyeicon'),document.querySelector('#eye')].find(visible),er=eye?eye.getBoundingClientRect():null;"
                    + "const ax=er?er.left+er.width/2:innerWidth/2,ay=er?er.top+er.height/2:innerHeight/2;"
                    + "for(const candidate of candidates){const r=candidate.hit.getBoundingClientRect(),dx=r.left+r.width/2-ax,dy=r.top+r.height/2-ay;"
                    + "candidate.preferred=semantic(candidate.hit)||semantic(candidate.leaf);candidate.distance=dx*dx+dy*dy;}"
                    + "candidates.sort((a,b)=>(b.preferred?1:0)-(a.preferred?1:0)||a.distance-b.distance||a.order-b.order);"
                    + "const choice=candidates[0];if(!usable(choice.leaf)||!usable(choice.hit))return false;choice.hit.click();return true;"
                : "return true;")
            + "})()";
    }

    private static string ProbeStorageExpression()
    {
        return StorageTargetExpression(false);
    }

    private static string ClickStorageExpression()
    {
        return StorageTargetExpression(true);
    }

    private static string StorageTargetExpression(bool click)
    {
        // ox_inventoryの標準ラベルに加え、同じ車両用途で使われる日本語表記だけを
        // 許可します。候補が複数なら何も押さないことで、近接車両を誤操作しません。
        return "(() => {"
            + "const qs=['ストレージを開く','トランクを開く','荷台を開く'],n=s=>String(s||'').replace(/\\s+/g,' ').trim(),body=document.body;"
            + "if(!body||getComputedStyle(body).visibility!=='visible')return 'MISSING';"
            + "const root=document.querySelector('#options-wrapper');if(!root)return 'MISSING';"
            + "const match=t=>qs.includes(t),matches=[...root.querySelectorAll('*')].filter(e=>{const t=n(e.textContent);"
            + "return match(t)&&![...e.children].some(c=>match(n(c.textContent)));});"
            + "if(matches.length>1)return 'AMBIGUOUS';if(matches.length!==1)return 'MISSING';const leaf=matches[0],s=getComputedStyle(leaf),r=leaf.getBoundingClientRect();"
            + "if(s.visibility==='hidden'||s.display==='none'||s.pointerEvents==='none'||Number(s.opacity)<=0||r.width<=0||r.height<=0)return 'MISSING';"
            + (click
                ? "let hit=leaf.closest('.option-container,li,button,[role=button]')||leaf.closest('a')||leaf;"
                    + "const hs=getComputedStyle(hit),hr=hit.getBoundingClientRect();if(!root.contains(hit)||!hit.isConnected||hs.visibility==='hidden'||hs.display==='none'||hs.pointerEvents==='none'||Number(hs.opacity)<=0||hr.width<=0||hr.height<=0||hit.matches(':disabled')||hit.getAttribute('aria-disabled')==='true')return 'MISSING';hit.click();return 'CLICKED';"
                : "return 'PRESENT';")
            + "})()";
    }

    private static string ClickExpression(string targetLabel, bool exactOnly)
    {
        return "(() => {"
            + "const q=" + Json.Serialize(targetLabel) + ",exact=" + (exactOnly ? "true" : "false")
            + ",n=s=>String(s||'').replace(/\\s+/g,' ').trim(),body=document.body;"
            + "if(!body||getComputedStyle(body).visibility!=='visible')return false;"
            + "const root=document.querySelector('#options-wrapper');if(!root)return false;"
            + "const match=t=>exact?t===q:(t===q||t.startsWith(q+' ')||t.startsWith(q+'（')||t.startsWith(q+'('));"
            + "const matches=[...root.querySelectorAll('*')].filter(e=>{const t=n(e.textContent);"
            + "return match(t)&&![...e.children].some(c=>match(n(c.textContent)));});"
            + "if(matches.length!==1)return false;const leaf=matches[0];"
            + "let hit=leaf.closest('.option-container,li,button,[role=button]')||leaf.closest('a')||leaf;"
            + "const usable=e=>{if(!e||!e.isConnected)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();"
            + "return s.visibility!=='hidden'&&s.display!=='none'&&s.pointerEvents!=='none'&&Number(s.opacity)>0"
            + "&&r.width>0&&r.height>0&&!e.matches(':disabled')&&e.getAttribute('aria-disabled')!=='true';};"
            + "if(!root.contains(hit)||!usable(leaf)||!usable(hit))return false;hit.click();return true;})()";
    }

    private sealed class CdpSession : IDisposable
    {
        private readonly ClientWebSocket _socket;
        private readonly CancellationTokenSource _timeout;
        private readonly int _contextId;

        private CdpSession(ClientWebSocket socket, CancellationTokenSource timeout, int contextId)
        {
            _socket = socket;
            _timeout = timeout;
            _contextId = contextId;
        }

        public CancellationToken Token { get { return _timeout.Token; } }

        public static async Task<CdpSession> OpenAsync(string framePart, TimeSpan timeoutValue)
        {
            var timeout = new CancellationTokenSource(timeoutValue);
            var socket = new ClientWebSocket();
            try
            {
                await socket.ConnectAsync(new Uri(FindRootSocketUrl()), timeout.Token).ConfigureAwait(false);
                var response = await CommandAsync(socket, "Page.getFrameTree", null, timeout.Token).ConfigureAwait(false);
                string frameId = FindFrame(GetObject(GetObject(response, "result"), "frameTree"), framePart);
                if (String.IsNullOrEmpty(frameId))
                    throw new InvalidOperationException("NUI_FRAME_NOT_FOUND");
                int contextId = await FindDefaultContextAsync(socket, frameId, timeout.Token).ConfigureAwait(false);
                return new CdpSession(socket, timeout, contextId);
            }
            catch
            {
                try { socket.Abort(); } catch { }
                socket.Dispose();
                timeout.Dispose();
                throw;
            }
        }

        public async Task<bool> EvaluateBooleanAsync(string expression, bool userGesture)
        {
            object value = await EvaluateAsync(expression, userGesture).ConfigureAwait(false);
            return value != null && Convert.ToBoolean(value, CultureInfo.InvariantCulture);
        }

        public async Task<string> EvaluateStringAsync(string expression, bool userGesture)
        {
            object value = await EvaluateAsync(expression, userGesture).ConfigureAwait(false);
            string text = value == null ? null : Convert.ToString(value, CultureInfo.InvariantCulture);
            if (String.IsNullOrEmpty(text))
                throw new InvalidOperationException("NUI_RESULT_INVALID");
            return OneLine(text);
        }

        private async Task<object> EvaluateAsync(string expression, bool userGesture)
        {
            var evaluateParams = new Dictionary<string, object>
            {
                { "expression", expression }, { "contextId", _contextId },
                { "returnByValue", true }, { "awaitPromise", true },
                { "userGesture", userGesture }, { "includeCommandLineAPI", false }
            };
            var response = await CommandAsync(_socket, "Runtime.evaluate", evaluateParams, _timeout.Token).ConfigureAwait(false);
            var commandResult = GetObject(response, "result");
            if (commandResult.ContainsKey("exceptionDetails"))
                throw new InvalidOperationException("NUI_EVALUATION_FAILED");
            var remoteObject = GetObject(commandResult, "result");
            object value;
            if (!remoteObject.TryGetValue("value", out value))
                throw new InvalidOperationException("NUI_RESULT_MISSING");
            return value;
        }

        public void Dispose()
        {
            try { _socket.Abort(); } catch { }
            _socket.Dispose();
            _timeout.Dispose();
        }
    }

    private sealed class TimeoutWebClient : WebClient
    {
        protected override WebRequest GetWebRequest(Uri address)
        {
            WebRequest request = base.GetWebRequest(address);
            request.Timeout = 3000;
            var httpRequest = request as HttpWebRequest;
            if (httpRequest != null) httpRequest.ReadWriteTimeout = 3000;
            return request;
        }
    }

    private sealed class CompanionState
    {
        public string ResourceVersion;
        public string Epoch;
        public string Token;
        public long Sequence;
        public string Status;
        public bool OpenCargo;
        public bool ServerRegistrationSynchronized;
        public bool RegistrationTransactionSupported;
        public bool RegistrationTransactionPending;
        public string RegistrationTransactionId;
        public string RegistrationTransactionPreviousId;
        public long RegistrationTransactionStartedAt;
        public long RegistrationTransactionExpiresAt;
        public string RegistrationTransactionStatus;
        public bool Registered;
        public string RegistrationId;
        public string Plate;
        public string Label;
        public long Model;
        public long NetworkId;
        public bool Available;
        public long DistanceCentimeters;
        public bool LastResultPresent;
        public string LastRequestId;
        public string LastCommand;
        public bool LastOk;
        public string LastCode;
        public string LastRegistrationId;
        public long LastNetworkId;
    }

    private sealed class RouteStep
    {
        public RouteStep(int duration, int mask) { Duration = duration; Mask = mask; }
        public int Duration { get; private set; }
        public int Mask { get; private set; }
    }

    private static Dictionary<string, object> GetObject(Dictionary<string, object> source, string key)
    {
        object value;
        if (source == null || !source.TryGetValue(key, out value))
            throw new InvalidOperationException("CDP_FIELD_MISSING");
        var dictionary = value as Dictionary<string, object>;
        if (dictionary == null)
            throw new InvalidOperationException("CDP_FIELD_INVALID");
        return dictionary;
    }

    private static object GetValue(Dictionary<string, object> source, string key)
    {
        object value;
        if (source == null || !source.TryGetValue(key, out value))
            throw new InvalidOperationException("CDP_FIELD_MISSING");
        return value;
    }

    private static string GetString(Dictionary<string, object> source, string key)
    {
        object value;
        return source != null && source.TryGetValue(key, out value) && value != null
            ? Convert.ToString(value, CultureInfo.InvariantCulture) : "";
    }

    private static string IntegerField(Dictionary<string, object> source, string key)
    {
        object value = GetValue(source, key);
        decimal number;
        if (!Decimal.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), NumberStyles.Number,
            CultureInfo.InvariantCulture, out number) || number < 0 || number > Int64.MaxValue)
            throw new InvalidOperationException("STORAGE_UNAVAILABLE");
        return Decimal.ToInt64(Decimal.Round(number, 0, MidpointRounding.AwayFromZero))
            .ToString(CultureInfo.InvariantCulture);
    }

    private static string SafeErrorToken(string message)
    {
        string token = (message ?? "UNKNOWN").Trim().ToUpperInvariant();
        if (!Regex.IsMatch(token, "^[A-Z0-9_]{1,48}$", RegexOptions.CultureInvariant))
            return "BRIDGE_FAILURE";
        return token;
    }

    private static string OneLine(string value)
    {
        if (value == null) return "ERROR UNKNOWN";
        var result = new StringBuilder(Math.Min(value.Length, 32768));
        foreach (char character in value)
        {
            if (result.Length >= 32768) break;
            result.Append(character == '\r' || character == '\n' || character == '\t' || Char.IsControl(character)
                ? ' ' : character);
        }
        return result.ToString().Trim();
    }
}
