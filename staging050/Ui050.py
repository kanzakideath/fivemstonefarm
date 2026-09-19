from pathlib import Path
r=Path('portable')
def edit(file,fn):
 p=r/file;s=p.read_text(encoding='utf-8-sig');p.write_text(fn(s),encoding='utf-8-sig')
p=r/'ui/index.html';s=p.read_text(encoding='utf-8-sig').replace('F8','F5').replace('F9','F6').replace('0.4.0','0.5.0')
marker='<h2>今回の記録</h2>'
new='<h2>現在の所持品 <span id="stock-fresh" class="stock-fresh">読み取り待ち</span></h2><div class="card" id="current-items"><p class="footnote">現在のインベントリを確認中です。</p></div><p class="footnote">インベントリの最新値です。手動収納・使用・譲渡で減った品は自動で更新し、0個になると消えます。</p><h2>釣り後の増加累計</h2><div class="card" id="catch-totals"><p class="footnote">確認した増加はまだありません。</p></div><p class="footnote">釣りの終了後に確認した増加分を保存します。収納しても累計は減りません。釣り中に別の人から受け取った品は厳密に区別できないため、同時の受け渡しは避けてください。</p>'
assert s.count(marker)==1;s=s.replace(marker,new+marker)
start='<h2>自動操作</h2><div class="card">'
addition='<label class="row"><span>ゲーム上に状態を表示<small>操作を遮らず、現在所持数と状態を表示</small></span><span class="toggle toggle-init"><input id="ShowOverlay" type="checkbox"><span class="toggle-icon"></span></span></label>'
assert start in s;s=s.replace(start,start+addition).replace('対応するゲームUIへ入力','前面は実画面、裏画面はゲームUIを検出').replace('円は描画中の位置・大きさを読み取ります。','円はゲームのクライアント領域を基準に検出します。').replace('描画確認と入力を同じ処理へ','前面画像の復旧・裏画面の再探索').replace('送信・受付・再試行','送信・受付・再試行・待機理由')
p.write_text(s,encoding='utf-8-sig')
p=r/'ui/app.js';s=p.read_text(encoding='utf-8-sig').replace("'IncludeExistingCatch'];","'IncludeExistingCatch','ShowOverlay'];").replace('F8','F5').replace('F9','F6')
assert "applyStorage(data);text('recognition'" in s
s=s.replace("applyStorage(data);text('recognition'", "renderInventory(s);applyStorage(data);text('recognition'")
s+='''
function renderInventory(s){
 text('stock-fresh',s.InventoryFresh?'最新':'更新待ち');
 for(const [id,rows,total] of [['current-items',s.CurrentItems,false],['catch-totals',s.CatchTotals,true]]){
  const host=$(id);host.replaceChildren();
  for(const item of (rows||[]).filter(x=>Number(total?x.Caught:x.Count)>0)){
   const row=document.createElement('div');row.className='row stock-row';row.dataset.item=item.Name;
   const name=document.createElement('span');name.textContent=item.Label||item.Name;
   const amount=document.createElement('strong');amount.textContent=String(total?item.Caught:item.Count)+' 個';row.append(name,amount);host.append(row);
  }
  if(!host.children.length){const p=document.createElement('p');p.className='footnote';p.textContent=total?'釣り後の増加はまだありません。':s.InventoryFresh?'現在の所持品はありません。':'インベントリを読み取り中です。';host.append(p);}
 }
}
'''
p.write_text(s,encoding='utf-8-sig')
p=r/'TestUi.py';s=p.read_text(encoding='utf-8-sig').replace('0.4.0','0.5.0').replace("'BackgroundMode':True,'AutoNeeds'", "'BackgroundMode':True,'ShowOverlay':True,'AutoNeeds'")
s=s.replace("  results.append({'width':width", '''  stock={**state,'status':{**state['status'],'InventoryFresh':True,'CurrentItems':[{'Name':'fish','Label':'サバ','Count':5,'Caught':12}],'CatchTotals':[{'Name':'fish','Label':'サバ','Count':5,'Caught':12}]}}
  page.evaluate('(d)=>window.__receive({data:d})',stock)
  assert page.locator('#current-items [data-item=fish]').inner_text().endswith('5 個')
  assert page.locator('#catch-totals [data-item=fish]').inner_text().endswith('12 個')
  stock['status']['CurrentItems']=[];stock['status']['CatchTotals'][0]['Count']=0
  page.evaluate('(d)=>window.__receive({data:d})',stock)
  assert page.locator('#current-items [data-item=fish]').count()==0
  assert page.locator('#catch-totals [data-item=fish]').inner_text().endswith('12 個')
  assert 'F5' in page.locator('#start-help').inner_text() or state['settings']['ObserveOnly']
  results.append({'manual_storage_current_row_removed':True,'cumulative_preserved':True,'width':width''')
p.write_text(s,encoding='utf-8-sig')
p=r/'README.txt';s=p.read_text(encoding='utf-8-sig').replace('0.4.0','0.5.0').replace('F8','F5').replace('F9','F6')
s=s.replace('認識\n----','''0.5.0での修正
--------------
バックグラウンドONでも、ゲームが前面なら実画面の画像で円を検出します。
裏画面では、SVGを検出できなくてもNUI描画画像を調べます。円のDOM検出を画像検索の前提にしません。
DOM数字は入れ子の要素・open Shadow DOMにも対応する探索を追加しました。
画面/入力方式は実際に使っている経路を表示します。描画が停止した最小化、画面ロック、
非対応NUIでの入力、排他的フルスクリーンでの外部オーバーレイ表示は保証しません。
「どんな解像度でも成功」という保証ではなく、クライアント領域とDPIを基準に正規化します。
通常の開始停止は F5/F6 です。旧F8/F9では開始停止しません。

状態オーバーレイと所持数
----------------------
設定「ゲーム上に状態を表示」がONなら、FiveM前面時に左上へクリック透過で状態を表示します。
別のアプリを操作しているときはオーバーレイを隠し、そのアプリの画面やキーを取りません。
「現在の所持品」は所持品の最新スナップショットで毎回置き換えます。収納した品は減り、0個は消えます。
停止中もゲームの読み取りが可能なら約2秒ごとに確認します。未取得データを0個と捏造しません。
「釣り後の増加累計」は別保存で、収納しても減りません。他人からの受取との厳密な区別はできません。
所持品画面が開かれた釣りでは、手動移動を釣果累計に加えません。
累計保存は catch-totals.json。既存の設定・登録・転送記録は削除しません。

認識
----''')
p.write_text(s,encoding='utf-8-sig')
