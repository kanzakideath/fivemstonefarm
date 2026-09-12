; Bounded local journal. Mirrors diagnostics without changing the legacy
; reward-recovery log. No game input, network, screenshot or automatic upload.
InitSupportDiagnostics(root, disabled, pid) {
    global SupportDiag
    SupportDiag := {enabled: !disabled, root: root "\diagnostics", session: A_NowUTC "-" pid "-" Random(100000,999999),
        seq: 0, bytes: 0, failed: 0, busy: false, exporting: false, feedback: "", lastZip: ""}
    if disabled
        return
    try {
        DirCreate SupportDiag.root
        path := SupportDiag.root "\events.jsonl"
        if FileExist(path)
            SupportDiag.bytes := FileGetSize(path)
        SupportWriteEvent("APP_START", "local_only=1 images=0 automatic_upload=0")
    } catch {
        SupportDiag.failed += 1
    }
    OnError SupportUnhandledError
    OnExit SupportDiagnosticExit
    SetTimer SupportHeartbeat, 5000
}

SupportState(name, fallback := "") {
    global State
    try return State.%name%
    return fallback
}
SupportConfig(name, fallback := "") {
    global Config
    try return Config.%name%
    return fallback
}
SupportSanitize(text) {
    text := SubStr(String(text), 1, 3000)
    text := RegExReplace(text, "(?s)[\r\n\t]+", " ")
    text := RegExReplace(text, "(?i)https?://[^\s]+", "[url]")
    text := RegExReplace(text, "(?i)(?:[a-z]:\\|\\\\)[^|]*", "[path]")
    text := RegExReplace(text, "(?i)[\w.+-]+@[\w.-]+\.[a-z]{2,}", "[email]")
    text := RegExReplace(text, "\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b", "[address]")
    text := RegExReplace(text, "(?i)\b(?:token|secret|password|authorization|cookie|epoch|storageId|plate|license|identifier|playerName|vehicleName|metadata|baseline|snapshot|reference|hwnd)\s*[:=]\s*.*", "[private-fields-omitted]")
    text := RegExReplace(text, "[A-Za-z0-9_+/=-]{48,}", "[long-value]")
    return SubStr(text, 1, 1600)
}
SupportSnapshotJson() {
    global SupportDiag
    foreground := false
    hwnd := SupportState("targetHwnd", 0)
    if hwnd
        try foreground := WinActive("ahk_id " hwnd) != 0
    body := '{"running":' (SupportState("running", false) ? "true" : "false")
        . ',"mode":' JsonQuote(SupportState("runMode", SupportConfig("actionMode")))
        . ',"fsm":' JsonQuote(SupportState("farmState"))
        . ',"generation":' (SupportState("generation", 0) + 0)
        . ',"task":' (SupportState("farmStateTaskId", 0) + 0)
        . ',"washAttempt":' (SupportState("washRecoveryAttemptId", 0) + 0)
        . ',"foreground":' (foreground ? "true" : "false")
        . ',"correctionEnabled":' (SupportConfig("washForwardCorrection", false) ? "true" : "false")
        . ',"storageEnabled":' (SupportConfig("vehicleStorageEnabled", false) ? "true" : "false")
        . ',"writeFailures":' SupportDiag.failed
        . ',"attempts":' (SupportState("attempts", 0) + 0)
        . ',"successes":' (SupportState("successes", 0) + 0)
        . ',"storageTrips":' (SupportState("storageTrips", 0) + 0)
        . ',"storageRetries":' (SupportState("storageRetryCount", 0) + 0)
        . ',"bridgeMode":' JsonQuote(SupportState("activeBridgeMode"))
        . ',"rawStoneCount":' (SupportState("lastRawStoneCount", -1) + 0)
    return body '}'
}
SupportWriteEvent(kind, message := "") {
    global SupportDiag, AppVersion
    try {
        if !IsSet(SupportDiag) || !SupportDiag.enabled || SupportDiag.busy
            return
        wasCritical := A_IsCritical
        Critical "On"
        SupportDiag.busy := true
        try {
            path := SupportDiag.root "\events.jsonl"
            if SupportDiag.bytes >= 2097152 {
                ; Five files at 2 MiB each. Startup/reset never deletes this history.
                if FileExist(path ".4")
                    FileDelete path ".4"
                Loop 3 {
                    n := 4 - A_Index
                    if FileExist(path "." n)
                        FileMove path "." n, path "." (n + 1), true
                }
                if FileExist(path)
                    FileMove path, path ".1", true
                SupportDiag.bytes := 0
            }
            SupportDiag.seq += 1
            line := '{"schema":1,"utc":' JsonQuote(FormatTime(A_NowUTC, "yyyy-MM-dd'T'HH:mm:ss'Z'"))
                . ',"monotonicMs":' DllCall("GetTickCount64", "UInt64")
                . ',"version":' JsonQuote(AppVersion) ',"session":' JsonQuote(SupportDiag.session)
                . ',"seq":' SupportDiag.seq ',"event":' JsonQuote(SupportSanitize(kind))
                . ',"message":' JsonQuote(SupportSanitize(message)) ',"context":' SupportSnapshotJson() '}' "`n"
            FileAppend line, path, "UTF-8-RAW"
            SupportDiag.bytes += StrPut(line, "UTF-8") - 1
        } catch {
            SupportDiag.failed += 1
        } finally {
            SupportDiag.busy := false
            if !wasCritical
                Critical "Off"
        }
    }
}
SupportHeartbeat(*) {
    if SupportState("running", false)
        SupportWriteEvent("HEARTBEAT")
}
SupportUnhandledError(err, mode) {
    detail := "mode=" mode
    try detail .= " line=" err.Line " message=" err.Message " stack=" err.Stack
    SupportWriteEvent("UNHANDLED_ERROR", detail)
    return 0 ; Preserve normal error handling.
}
SupportDiagnosticExit(reason, code) {
    SupportWriteEvent("APP_EXIT", "reason=" reason " code=" code)
}
SupportMarkProblem(*) {
    global SupportDiag
    SupportWriteEvent("USER_MARK", "user_reported_problem=1")
    SupportDiag.feedback := "不具合の目印を記録しました。F9で停止後、診断ZIPを保存してこのチャットへ添付してください。"
    QueueWebUiFlush(true)
}
SupportReportEvent(path, kind) {
    ; Only small helper summary scalars; never persist its reference tiles here.
    try {
        if !FileExist(path) || FileGetSize(path) > 131072
            return
        text := FileRead(path, "UTF-8")
        summary := ""
        for field in ["startedUtc", "result", "pulses", "inputMs", "beforeError", "afterError", "elapsedMs", "stableWaitMs", "inputsReleased"] {
            pattern := '"' field '"\s*:\s*("[^"\r\n]{0,160}"|-?[0-9]+(?:\.[0-9]+)?|true|false)'
            if RegExMatch(text, pattern, &m)
                summary .= field "=" m[1] " "
        }
        SupportWriteEvent(kind, summary)
        pos := 1
        Loop 40 {
            if !RegExMatch(text, '"([0-9]+ms W_(?:DOWN|UP) actual_ms=[0-9]+)"', &pulse, pos)
                break
            SupportWriteEvent("WASH_INPUT", pulse[1])
            pos := pulse.Pos + pulse.Len
        }
    }
}
SupportUiJson() {
    global SupportDiag
    try return '{"enabled":' (SupportDiag.enabled ? "true" : "false")
        . ',"busy":' (SupportDiag.exporting ? "true" : "false")
        . ',"writeFailures":' SupportDiag.failed ',"session":' JsonQuote(SupportDiag.session)
        . ',"feedback":' JsonQuote(SupportDiag.feedback) '}'
    return '{}'
}
ExportSupportDiagnostics(*) {
    global SupportDiag, State, LocalNav, AppVersion, persistentDataRoot
    if SupportState("running", false) || State.startInProgress || State.registrationActive
        || LocalNav.busy || LocalNav.requestActive || State.updateApplying || SupportDiag.exporting {
        SupportDiag.feedback := "作業・設定・更新を停止してから診断ZIPを保存してください。"
        QueueWebUiFlush(true)
        return
    }
    if State.visualTest {
        SupportDiag.feedback := "表示テスト：診断ZIPはWindows版の実操作で保存します。自動送信はしません。"
        QueueWebUiFlush(true)
        return
    }
    if MsgBox("診断ZIPには直近の処理履歴・停止理由・入力回数と時間・補正結果・バージョンを含めます。`n`n画像、音声、チャット、セーブ、INI全体、ルート画像は含めません。識別情報は可能な範囲で除外しますが、共有前にZIP内の内容を確認してください。外部へ自動送信しません。`n`n保存先を選び、作成したZIPをこのチャットに添付してください。", "診断ZIPの保存", "OKCancel") != "OK"
        return
    destination := FileSelect("S16", A_Desktop "\AI-Miner-diagnostics-" A_Now ".zip", "診断ZIPを保存", "ZIP (*.zip)")
    if !destination
        return
    if !RegExMatch(destination, "i)\.zip$")
        destination .= ".zip"
    if FileExist(destination) {
        SupportDiag.feedback := "同名のファイルがあります。別の名前で保存してください。"
        QueueWebUiFlush(true)
        return
    }
    SupportDiag.exporting := true
    SupportDiag.feedback := "診断ZIPを作成中。元のログ・設定・セーブは変更しません。"
    QueueWebUiFlush(true)
    resultPath := A_Temp "\ai-miner-support-result-" DllCall("GetCurrentProcessId") ".txt"
    helper := A_Temp "\ai-miner-diagnostics-" DllCall("GetCurrentProcessId") ".exe"
    try {
        FileInstall "Diagnostics.exe", helper, true
        SupportWriteEvent("EXPORT_REQUEST")
        try FileDelete resultPath
        code := RunWait('"' helper '" export "' resultPath '" "' persistentDataRoot '" "' destination '" "' A_ScriptFullPath '" "' AppVersion '"', , "Hide")
        result := FileExist(resultPath) ? Trim(FileRead(resultPath, "UTF-8")) : "ERROR NO_RESULT"
        if code != 0 || result != "EXPORTED" || !FileExist(destination)
            throw Error(result)
        SupportDiag.lastZip := destination
        SupportDiag.feedback := "診断ZIPを保存しました。このチャットへZIPを添付してください（自動送信なし）。"
        SupportWriteEvent("EXPORT_COMPLETE", "zip_created=1")
        Run 'explorer.exe /select,"' destination '"'
    } catch as err {
        SupportDiag.feedback := "診断ZIPの保存に失敗：" SupportSanitize(err.Message) "。別の保存先を選んでください。"
        SupportWriteEvent("EXPORT_FAILED", err.Message)
    } finally {
        SupportDiag.exporting := false
        try FileDelete helper
        try FileDelete resultPath
        QueueWebUiFlush(true)
    }
}
ValidateSupportDiagnostics() {
    global SupportDiag
    saved := SupportDiag
    root := A_Temp "\ai-miner-journal-test-" DllCall("GetCurrentProcessId") "-" Random(100000,999999)
    try {
        DirCreate root
        SupportDiag := {enabled:true, root:root, session:"test-session", seq:0, bytes:0, failed:0, busy:false}
        SupportWriteEvent("USER_MARK", "token=PRIVATE_CANARY")
        path := root "\events.jsonl"
        text := FileRead(path,"UTF-8")
        if InStr(text,"PRIVATE_CANARY") || !InStr(text,'"event":"USER_MARK"') || !InStr(text,'"context":')
            return false
        Loop 6 {
            SupportDiag.bytes := 2097152
            SupportWriteEvent("ROTATION_TEST", "iteration=" A_Index)
        }
        if !FileExist(path ".4") || FileExist(path ".5") || SupportDiag.failed
            return false
        before := SupportDiag.seq
        SupportWriteEvent("RESTART_TEST")
        if SupportDiag.seq != before+1 || !InStr(FileRead(path,"UTF-8"),"ROTATION_TEST")
            return false
        SupportDiag.root := root "\does-not-exist\nested"
        SupportWriteEvent("DISK_FAILURE_TEST")
        return SupportDiag.failed = 1 && !SupportDiag.busy
    } catch {
        return false
    } finally {
        SupportDiag := saved
        try DirDelete root, true
    }
}
