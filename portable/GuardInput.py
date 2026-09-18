from pathlib import Path
root=Path(__file__).resolve().parent
p=root/'Engine.cs';s=p.read_text(encoding='utf-8-sig')
old='bool sent=false;\n        if(options.BackgroundMode&&sceneLink!=null&&scene.Present&&scene.Key==key)sent=sceneLink.Digit(scene,key).GetAwaiter().GetResult();'
new='''bool sent=false,uncertain=false;
        if(options.BackgroundMode&&sceneLink!=null&&scene.Present&&scene.Key==key){
         try{sent=sceneLink.Digit(scene,key).GetAwaiter().GetResult();}
         catch(OperationCanceledException){if(token.IsCancellationRequested)throw;uncertain=true;}
         catch(Exception e){uncertain=true;Log("key_delivery_unconfirmed",e.GetType().Name+" latched=1 no_duplicate=1");}
         if(uncertain){sceneLink.Dispose();sceneLink=null;sceneRetry=Now+800;reason="入力結果を再確認中。二重入力せず次の画面変化を待ちます";}
        }'''
assert s.count(old)==1
s=s.replace(old,new,1)
old='else {round.InputRejected();LogThrottled("round_not_sent","stale_round_or_no_safe_backend");}'
new='else if(!uncertain){round.InputRejected();LogThrottled("round_not_sent","stale_round_or_no_safe_backend");}'
assert s.count(old)==1
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8-sig',newline='\n')
print('KEY_DELIVERY_GUARD: cancellation maintained; uncertain dispatch is never blindly repeated')
