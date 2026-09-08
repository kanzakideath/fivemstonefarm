using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace AiMiner.UiHost
{
    internal static class BackendIdentity
    {
        internal static bool TryValidate(IntPtr window, int expectedPid, out string error)
        {
            error = null;
            if (window == IntPtr.Zero || !IsWindow(window))
            {
                error = "本体ウィンドウが見つかりません。";
                return false;
            }
            uint actualPid;
            GetWindowThreadProcessId(window, out actualPid);
            if (actualPid != (uint)expectedPid)
            {
                error = "本体ウィンドウとプロセスが一致しません。";
                return false;
            }
            try
            {
                using (Process process = Process.GetProcessById(expectedPid))
                {
                    if (process.HasExited)
                    {
                        error = "本体プロセスは終了しています。";
                        return false;
                    }
                }
            }
            catch
            {
                error = "本体プロセスを確認できません。";
                return false;
            }
            return true;
        }

        internal static bool IsMatchingSender(IntPtr sender, IntPtr expectedWindow, int expectedPid)
        {
            if (sender == IntPtr.Zero || sender != expectedWindow || !IsWindow(sender))
                return false;
            uint actualPid;
            GetWindowThreadProcessId(sender, out actualPid);
            return actualPid == (uint)expectedPid;
        }

        internal static bool IsBackendAlive(IntPtr expectedWindow, int expectedPid)
        {
            string ignored;
            return TryValidate(expectedWindow, expectedPid, out ignored);
        }

        [DllImport("user32.dll")]
        private static extern bool IsWindow(IntPtr window);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    }
}
