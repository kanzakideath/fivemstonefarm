using System;
using System.Collections.Generic;
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
    private const string InventoryFramePart = "cfx-nui-ox_inventory/web/build/index.html";
    private const string Capabilities = "CAPS 4 MINE WASH GOLD NUDGE STORAGE INVENTORY ROUTE TRY";
    private const int MaximumRouteSteps = 240;
    private const int MaximumRouteMilliseconds = 120000;
    private const int MaximumMetadataBytes = 8192;
    private const int MaximumMetadataTokenLength = 10923;
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 };
    private static readonly Regex ItemNamePattern = new Regex("^[A-Za-z0-9_-]{1,64}$", RegexOptions.CultureInvariant);
    private static readonly Regex Base64Pattern = new Regex("^[A-Za-z0-9+/]+={0,2}$", RegexOptions.CultureInvariant);
    private static readonly Regex OperationTokenPattern = new Regex("^[A-Za-z0-9_-]{1,64}$", RegexOptions.CultureInvariant);
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
            || mode == "probe-washing" || mode == "click-washing"
            || mode == "probe-gold" || mode == "click-gold"
            || mode == "probe-storage" || mode == "click-storage"
            || mode == "inventory-snapshot" || mode == "capture-storage"
            || mode == "close-inventory"
            || mode == "try-mining" || mode == "try-probe-mining"
            || mode == "try-washing" || mode == "try-gold"
            || mode == "activate" || mode == "deactivate"
            || mode == "deactivate-29200" || mode == "deactivate-29300");
        bool nudgeMode = args.Length == 4 && mode == "nudge-forward";
        bool routeMode = args.Length == 4 && mode == "play-route";
        bool depositMode = args.Length == 6 && mode == "deposit-delta";
        bool cancelOperationMode = args.Length == 3 && mode == "cancel-operation";
        if (!twoArgumentMode && !nudgeMode && !routeMode && !depositMode && !cancelOperationMode)
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
                if (!TryParseDevConPort(args[2], out port)
                    || !Int32.TryParse(args[3], NumberStyles.None, CultureInfo.InvariantCulture, out milliseconds)
                    || milliseconds < 50 || milliseconds > 250)
                    return 64;
                result = NudgeForward(port, milliseconds);
            }
            else if (routeMode)
            {
                int port;
                if (!TryParseDevConPort(args[2], out port))
                    return 64;
                List<RouteStep> steps = ParseRoute(args[3]);
                result = PlayRoute(port, steps);
            }
            else if (depositMode)
            {
                string storageId = DecodeIdentifier(args[2]);
                string storageType = DecodeIdentifier(args[3]).ToLowerInvariant();
                if (storageType != "trunk" && storageType != "glovebox")
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
            else if (mode == "activate")
            {
                result = ActivateAsync().GetAwaiter().GetResult();
            }
            else if (mode.StartsWith("deactivate", StringComparison.Ordinal))
            {
                int selectedPort = mode.EndsWith("29200", StringComparison.Ordinal) ? 29200
                    : mode.EndsWith("29300", StringComparison.Ordinal) ? 29300 : 0;
                SendRelease(selectedPort);
                result = "RELEASED";
            }
            else if (mode.StartsWith("try-", StringComparison.Ordinal))
            {
                result = TryActionAsync(mode).GetAwaiter().GetResult();
            }
            else if (mode == "inventory-snapshot")
            {
                result = InventorySnapshotAsync().GetAwaiter().GetResult();
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
            || result.StartsWith("SNAPSHOT ", StringComparison.Ordinal)
            || result.StartsWith("STORAGE ", StringComparison.Ordinal)
            || result.StartsWith("DEPOSITED ", StringComparison.Ordinal)
            || result == "CLOSED" || result == "RELEASED" || result == "CANCELLED";
    }

    private static string RunSelfTest()
    {
        List<RouteStep> route = ParseRoute("150:1,25:0,150:8");
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
        int count;
        if (route.Count != 3 || route[0].Mask != 1 || route[2].Mask != 8
            || !baseline.TryGetValue("1\nore\n{}", out count) || count != 10
            || !canonicalBaseline.TryGetValue("2\nore\n" + canonicalMetadata, out count) || count != 3
            || largeToken.Length <= 8192 || largeToken.Length > MaximumMetadataTokenLength
            || !largeBaseline.TryGetValue("3\nore\n" + largeMetadata, out count) || count != 7
            || !exponentBaseline.TryGetValue("4\nore\n" + exponentMetadata, out count) || count != 2
            || !BaselineMetadataIsRejected("not-json")
            || DecodeIdentifier(EncodeIdentifier("trunk-test")) != "trunk-test"
            || DecodeBase64Url(EncodeBase64Url("{\"quality\":100}")) != "{\"quality\":100}")
            throw new InvalidOperationException("SELFTEST_FAILED");
        return "SELFTEST OK";
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

    private static async Task<string> RunTargetAsync(string mode)
    {
        bool clickMode = mode.StartsWith("click-", StringComparison.Ordinal);
        bool washingMode = mode.EndsWith("washing", StringComparison.Ordinal);
        bool goldMode = mode.EndsWith("gold", StringComparison.Ordinal);
        bool storageMode = mode.EndsWith("storage", StringComparison.Ordinal);
        string targetLabel = washingMode ? "石を洗う"
            : goldMode ? "砂金採りトレイ"
            : storageMode ? "ストレージを開く" : "鉱石を採掘する";
        string actionToken = washingMode ? "WASH" : goldMode ? "GOLD" : storageMode ? "STORAGE" : "MINE";
        bool exactOnly = washingMode || goldMode || storageMode;

        using (var session = await CdpSession.OpenAsync(TargetFramePart, TimeSpan.FromSeconds(4)).ConfigureAwait(false))
        {
            bool value = await session.EvaluateBooleanAsync(
                clickMode ? ClickExpression(targetLabel, exactOnly) : ProbeExpression(targetLabel, exactOnly),
                clickMode).ConfigureAwait(false);
            if (clickMode && value)
                await Task.Delay(300, session.Token).ConfigureAwait(false);
            return (value ? (clickMode ? "CLICKED " : "PRESENT ") : "MISSING ") + actionToken;
        }
    }

    private static async Task<string> TryActionAsync(string mode)
    {
        bool probeOnly = mode == "try-probe-mining";
        bool washingMode = mode == "try-washing";
        bool goldMode = mode == "try-gold";
        string targetLabel = washingMode ? "石を洗う" : goldMode ? "砂金採りトレイ" : "鉱石を採掘する";
        string actionToken = washingMode ? "WASH" : goldMode ? "GOLD" : "MINE";
        bool exactOnly = washingMode || goldMode;
        int port = 0;
        try
        {
            SendRelease(0);
            port = ActivatePort();
            using (var session = await CdpSession.OpenAsync(TargetFramePart, TimeSpan.FromSeconds(5)).ConfigureAwait(false))
            {
                if (probeOnly)
                {
                    await Task.Delay(350, session.Token).ConfigureAwait(false);
                    bool probeResult = await session.EvaluateBooleanAsync(
                        ProbeExpression(targetLabel, exactOnly), false).ConfigureAwait(false);
                    return (probeResult ? "PRESENT " : "MISSING ") + actionToken;
                }
                DateTime deadline = DateTime.UtcNow.AddMilliseconds(1600);
                while (DateTime.UtcNow < deadline)
                {
                    bool present = await session.EvaluateBooleanAsync(
                        ProbeExpression(targetLabel, exactOnly), false).ConfigureAwait(false);
                    if (present)
                    {
                        bool clicked = await session.EvaluateBooleanAsync(
                            ClickExpression(targetLabel, exactOnly), true).ConfigureAwait(false);
                        if (clicked)
                        {
                            await Task.Delay(300, session.Token).ConfigureAwait(false);
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
            if (port != 0) SendRelease(port);
            else SendRelease(0);
        }
    }

    private static async Task<string> InventorySnapshotAsync()
    {
        string expression = "(() => {" + InventoryPrelude()
            + "const store=findStore();if(!store)return 'ERROR INVENTORY_UNAVAILABLE';"
            + "let inv;try{inv=store.getState().inventory;}catch(e){return 'ERROR INVENTORY_UNAVAILABLE';}"
            + "const left=inv&&inv.leftInventory;if(!left||String(left.type||'').toLowerCase()!=='player')return 'ERROR INVENTORY_UNAVAILABLE';"
            + "const meta=v=>{if(v===undefined||v===null)return '{}';try{if(typeof v!=='object')return JSON.stringify(v);"
            + "const clean=x=>{if(x===null||typeof x!=='object')return x;if(Array.isArray(x))return x.map(clean);const o=Object.create(null);for(const k of Object.keys(x).sort())o[k]=clean(x[k]);return o;};return JSON.stringify(clean(v));}catch(e){return ''}};"
            + "const items=Array.isArray(left.items)?left.items:[],entries=[];let weight=0,used=0;"
            + "for(const item of items){if(!item||!item.name||num(item.count)<=0)continue;"
            + "const name=String(item.name),count=Math.trunc(num(item.count));if(!/^[A-Za-z0-9_-]{1,64}$/.test(name))return 'ERROR UNSUPPORTED_ITEM_NAME';"
            + "if(count<=0||count>2147483647)return 'ERROR INVALID_INVENTORY';const metadata=meta(item.metadata);if(!metadata)return 'ERROR INVALID_METADATA';"
            + "const slot=Math.trunc(num(item.slot));if(slot<1||slot>1000)return 'ERROR INVALID_INVENTORY';"
            + "entries.push({slot:slot,name:name,count:count,meta:metadata});weight+=Math.max(0,num(item.weight));used++;}"
            + "return 'SNAPSHOT_DETAIL '+JSON.stringify({weight:whole(weight),max:whole(left.maxWeight),used:used,slots:whole(left.slots),items:entries});})()";
        string raw = await EvaluateInventoryStringAsync(expression, TimeSpan.FromSeconds(5), false).ConfigureAwait(false);
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

    private static async Task<string> CaptureStorageAsync()
    {
        string expression = "(() => {" + InventoryPrelude()
            + "if(!inventoryVisible())return 'ERROR INVENTORY_CLOSED';const store=findStore();if(!store)return 'ERROR INVENTORY_UNAVAILABLE';"
            + "let inv;try{inv=store.getState().inventory;}catch(e){return 'ERROR INVENTORY_UNAVAILABLE';}"
            + "const right=inv&&inv.rightInventory,type=String(right&&right.type||'').toLowerCase();"
            + "if(!right||right.id===undefined||right.id===null||String(right.id).length===0)return 'ERROR STORAGE_UNAVAILABLE';"
            + "if(type!=='trunk'&&type!=='glovebox')return 'ERROR NOT_VEHICLE_STORAGE';"
            + "const items=Array.isArray(right.items)?right.items:[];let weight=0,used=0;for(const item of items){"
            + "if(!item||!item.name||num(item.count)<=0)continue;weight+=Math.max(0,num(item.weight));used++;}"
            + "return 'CAPTURE '+JSON.stringify({id:String(right.id),type:type,weight:whole(weight),max:whole(right.maxWeight),used:used,slots:whole(right.slots)});})()";
        string raw = await EvaluateInventoryStringAsync(expression, TimeSpan.FromSeconds(5), false).ConfigureAwait(false);
        if (!raw.StartsWith("CAPTURE ", StringComparison.Ordinal))
            return raw;
        var capture = Json.DeserializeObject(raw.Substring(8)) as Dictionary<string, object>;
        if (capture == null)
            return "ERROR STORAGE_UNAVAILABLE";
        string id = GetString(capture, "id");
        string type = GetString(capture, "type");
        if (String.IsNullOrEmpty(id) || (type != "trunk" && type != "glovebox"))
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
            + "let rightWeight=0,addWeight=0;for(const item of rightItems)if(item&&item.name&&num(item.count)>0)rightWeight+=Math.max(0,num(item.weight));"
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
        SendRelease(0);
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

    private static void SendRelease(int selectedPort)
    {
        if (selectedPort == 29200 || selectedPort == 29300)
        {
            TrySendDevCon(selectedPort, "-ox_target");
            SendMovementRelease(selectedPort);
        }
        else
        {
            foreach (int port in new[] { 29200, 29300 })
            {
                TrySendDevCon(port, "-ox_target");
                SendMovementRelease(port);
            }
        }
    }

    private static void SendMovementRelease(int port)
    {
        TrySendDevCon(port, "-move_up_only;-move_left_only;-move_down_only;-move_right_only", 0);
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
            if (!TrySendDevCon(port, MovementReleaseCommand(), 0))
                throw new InvalidOperationException("MOVEMENT_UNAVAILABLE");

            // Keep timing in this owned helper instead of queuing a long `wait` command in
            // FiveM.  The parent can terminate this helper on F9 and issue an immediate release;
            // no future movement remains buffered inside the game after cancellation.
            foreach (RouteStep step in steps)
            {
                var command = new StringBuilder(MovementReleaseCommand());
                AppendMovementPresses(command, step.Mask);
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
            SendMovementRelease(port);
        }
    }

    private static string MovementReleaseCommand()
    {
        return "-move_up_only;-move_left_only;-move_down_only;-move_right_only";
    }

    private static void AppendMovementPresses(StringBuilder command, int mask)
    {
        if ((mask & 1) != 0) command.Append(";+move_up_only");
        if ((mask & 2) != 0) command.Append(";+move_down_only");
        if ((mask & 4) != 0) command.Append(";+move_left_only");
        if ((mask & 8) != 0) command.Append(";+move_right_only");
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
                || duration < 10 || duration > 5000 || mask < 0 || mask > 15
                || ((mask & 1) != 0 && (mask & 2) != 0)
                || ((mask & 4) != 0 && (mask & 8) != 0))
                throw new ArgumentException();
            total += duration;
            if (total > MaximumRouteMilliseconds)
                throw new ArgumentException();
            steps.Add(new RouteStep(duration, mask));
        }
        return steps;
    }

    private static bool TryParseDevConPort(string value, out int port)
    {
        return Int32.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out port)
            && (port == 29200 || port == 29300);
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
