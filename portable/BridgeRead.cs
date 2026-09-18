using System;
using System.Threading.Tasks;

internal static partial class CdpBridge {
 public static async Task<FishingPilot.Telemetry> FishingReadOnlyAsync() {
  var t=new FishingPilot.Telemetry();
  string h=await HealthAsync().ConfigureAwait(false);
  if(!h.StartsWith("HEALTH READY ",StringComparison.Ordinal)){t.Error="対応NUIに接続できません";return t;}
  t.Epoch=h.Substring(13);
  string raw=await InventorySnapshotAsync().ConfigureAwait(false);
  t.Inventory=FishingPilot.Inventory.Parse(raw);
  // Read visible notification text only. Never invoke a skill-check or reward callback.
  try {
   using(var s=await CdpSession.OpenAsync(ProgressFramePart,TimeSpan.FromSeconds(1.5)).ConfigureAwait(false)) {
    const string expr="(() => {const t=(document.body&&document.body.innerText||'');return /魚に逃げ|釣りに失敗|逃げられ/.test(t)?'FAIL':/釣り竿.*壊|釣り餌.*[足無]|餌が[足無]|エサが[足無]|持ち物.*いっぱい/.test(t)?'BLOCK':'NONE';})()";
    t.Notice=await s.EvaluateStringAsync(expr,false).ConfigureAwait(false);
   }
  } catch {t.Notice="UNKNOWN";}
  string h2=await HealthAsync().ConfigureAwait(false);
  if(h2!=h){t.Epoch="";t.Error="接続が変わりました";return t;}
  t.Known=t.Inventory.Known;t.Error=t.Known?"":"ゲーム内で所持品を一度開いて閉じてください";
  return t;
 }
}
