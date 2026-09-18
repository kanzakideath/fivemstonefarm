from pathlib import Path
r=Path(__file__).parent

def edit(name,old,new):
 p=r/name;s=p.read_text(encoding='utf-8-sig')
 if new in s:return
 if s.count(old)!=1:raise RuntimeError(f'{name}: expected one original fragment: {old[:70]}')
 p.write_text(s.replace(old,new),encoding='utf-8-sig')

# document.write/set_content preserves the window's const bindings: each scenario needs a new document.
# This changes the test fixture reset, not the production transfer error or any safety expectation.
edit('TestStorage.py','def fresh():page.set_content(html)',"def fresh():page.goto('about:blank');page.set_content(html)")
# An already-open recovery inventory must not receive food/rod hotkeys before the transfer is reconciled.
edit('Engine.cs','phase="full";bool needsReady=HandleNeeds(now,token,foreground);','phase="full";bool needsReady=reconcileStorage||HandleNeeds(now,token,foreground);')
edit('FishingStorage.cs','journal.Confirm(pending);log("storage_reconciled"','journal.Confirm(pending);moved+=pending.Count;log("storage_reconciled"')
edit('FishingStorage.cs','System.IO.File.Delete(System.IO.Path.Combine(root,"storage-pending.json"));break;','System.IO.File.Delete(System.IO.Path.Combine(root,"storage-pending.json"));System.IO.File.Delete(System.IO.Path.Combine(root,"storage-pending.json.bak"));break;')
print('Recovery priority and isolated fault-injection documents ready')
