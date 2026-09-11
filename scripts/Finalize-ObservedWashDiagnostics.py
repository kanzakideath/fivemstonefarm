from pathlib import Path
R=Path(__file__).resolve().parents[1]
def edit(name,old,new):
 p=R/name;b=p.read_bytes();s=b.decode('utf-8-sig').replace('\r\n','\n')
 if s.count(old)!=1:raise RuntimeError('Missing audited boundary: '+name+' '+old[:80])
 p.write_bytes((b'\xef\xbb\xbf' if b.startswith(b'\xef\xbb\xbf') else b'')+s.replace(old,new).encode('utf-8'))
# NCC already normalizes contrast; retain low-light details with >=2 gray levels
# of standard deviation. Keep all match quality, distinctiveness, support and
# maximum displacement guards. Uniform images still fail the self-test.
edit('src/wash-position/WashPosition.cs','va/n<36 || vb/n<36','va/n<4 || vb/n<4')
edit('src/wash-position/WashPosition.cs','        Match m=Estimate(a,Shift(a,0,4,0));', '''        var dark=new byte[a.Length];
        for(int n=0;n<a.Length;n++)dark[n]=(byte)(10+a[n]/16);
        if(!AtAnchor(Estimate(dark,dark)) || !Estimate(dark,Shift(dark,0,3,0)).valid)
            throw new Exception("LOW_LIGHT_UNIQUE_TEXTURE_TEST");
        Match m=Estimate(a,Shift(a,0,4,0));''')
edit('src/mining-auto.ahk','isHistoryImportTestRun := HasCommandLineArgument("--history-import-self-test")',
'isHistoryImportTestRun := HasCommandLineArgument("--history-import-self-test")\nif isValidationRun || isUiTestRun\n    OnError(ValidationFatalError)')
p=R/'src/wash-position.ahk';b=p.read_bytes();s=b.decode('utf-8-sig')
s+=r'''

; Validation must exit non-zero with a trace, never wait on an invisible dialog.
; This handler is installed only by --validate / UI test modes.
ValidationFatalError(err, mode) {
    message := "VALIDATION_ERROR " mode
    try message .= " line=" err.Line " " err.Message "`n" err.Stack
    try FileAppend message "`n", "**", "UTF-8-RAW"
    ExitApp(146)
}
'''
p.write_bytes((b'\xef\xbb\xbf' if b.startswith(b'\xef\xbb\xbf') else b'')+s.encode('utf-8'))
edit('scripts/Build.ps1','        $testProcess = Start-Process -FilePath $outputExe -ArgumentList $testMode -PassThru -WindowStyle Hidden', '''        $testStdout = Join-Path $stageRoot ($testMode.TrimStart('-') + '.stdout.log')
        $testStderr = Join-Path $stageRoot ($testMode.TrimStart('-') + '.stderr.log')
        $testProcess = Start-Process -FilePath $outputExe -ArgumentList @('/ErrorStdOut=UTF-8', $testMode) -PassThru -WindowStyle Hidden -RedirectStandardOutput $testStdout -RedirectStandardError $testStderr''')
edit('scripts/Build.ps1','            throw "Compiled application $testMode failed with exit code $($testProcess.ExitCode)."', '''            $detail = if (Test-Path $testStderr) { Get-Content $testStderr -Raw } else { '' }
            throw "Compiled application $testMode failed with exit code $($testProcess.ExitCode): $detail"
''')
print('Low-light unique feature tests and non-interactive validation error reporting applied.')
