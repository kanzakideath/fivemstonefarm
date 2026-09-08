using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

namespace AiMiner.UiTests
{
    public sealed class WindowDescriptor
    {
        public long Hwnd { get; set; }
        public int ProcessId { get; set; }
        public string Title { get; set; }
        public string ClassName { get; set; }
        public bool Visible { get; set; }
        public bool Minimized { get; set; }
        public bool Cloaked { get; set; }
        public int WindowLeft { get; set; }
        public int WindowTop { get; set; }
        public int WindowWidth { get; set; }
        public int WindowHeight { get; set; }
        public int FrameLeft { get; set; }
        public int FrameTop { get; set; }
        public int FrameWidth { get; set; }
        public int FrameHeight { get; set; }
        public int Dpi { get; set; }
    }

    public sealed class MonitorDescriptor
    {
        public long Handle { get; set; }
        public string DeviceName { get; set; }
        public bool Primary { get; set; }
        public int Left { get; set; }
        public int Top { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
        public int WorkLeft { get; set; }
        public int WorkTop { get; set; }
        public int WorkWidth { get; set; }
        public int WorkHeight { get; set; }
        public int EffectiveDpiX { get; set; }
        public int EffectiveDpiY { get; set; }
        public int ScalePercent { get; set; }
    }

    public sealed class CaptureMetrics
    {
        public int WindowWidth { get; set; }
        public int WindowHeight { get; set; }
        public int CropLeft { get; set; }
        public int CropTop { get; set; }
        public int CropWidth { get; set; }
        public int CropHeight { get; set; }
        public double PhysicalToCaptureScaleX { get; set; }
        public double PhysicalToCaptureScaleY { get; set; }
        public string TargetDpiAwareness { get; set; }
    }

    public static class NativeWindowCapture
    {
        private const uint PW_RENDERFULLCONTENT = 0x00000002;
        private const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
        private const int DWMWA_CLOAKED = 14;
        private const uint MONITORINFOF_PRIMARY = 0x00000001;
        private const int MDT_EFFECTIVE_DPI = 0;
        private static readonly IntPtr DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = new IntPtr(-4);

        private delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr parameter);
        private delegate bool MonitorEnumProc(IntPtr monitor, IntPtr hdc, ref RECT rect, IntPtr parameter);

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct MONITORINFOEX
        {
            public int Size;
            public RECT Monitor;
            public RECT Work;
            public uint Flags;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
            public string DeviceName;
        }

        [DllImport("user32.dll")]
        private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr parameter);

        [DllImport("user32.dll")]
        private static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, MonitorEnumProc callback, IntPtr parameter);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool IsWindow(IntPtr hwnd);

        [DllImport("user32.dll")]
        private static extern bool IsWindowVisible(IntPtr hwnd);

        [DllImport("user32.dll")]
        private static extern bool IsIconic(IntPtr hwnd);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);

        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int maximumCount);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int GetWindowTextLength(IntPtr hwnd);

        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern int GetClassName(IntPtr hwnd, StringBuilder className, int maximumCount);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool PrintWindow(IntPtr hwnd, IntPtr destinationDc, uint flags);

        [DllImport("user32.dll")]
        private static extern uint GetDpiForWindow(IntPtr hwnd);

        [DllImport("user32.dll")]
        private static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);

        [DllImport("user32.dll")]
        private static extern IntPtr GetWindowDpiAwarenessContext(IntPtr hwnd);

        [DllImport("user32.dll")]
        private static extern int GetAwarenessFromDpiAwarenessContext(IntPtr context);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFOEX monitorInfo);

        [DllImport("dwmapi.dll")]
        private static extern int DwmGetWindowAttribute(IntPtr hwnd, int attribute, out RECT value, int valueSize);

        [DllImport("dwmapi.dll")]
        private static extern int DwmGetWindowAttribute(IntPtr hwnd, int attribute, out int value, int valueSize);

        [DllImport("dwmapi.dll")]
        private static extern int DwmFlush();

        [DllImport("shcore.dll")]
        private static extern int GetDpiForMonitor(IntPtr monitor, int dpiType, out uint dpiX, out uint dpiY);

        [DllImport("shcore.dll")]
        private static extern int GetScaleFactorForMonitor(IntPtr monitor, out int scaleFactor);

        public static WindowDescriptor[] EnumerateWindows(int processId)
        {
            if (processId <= 0)
            {
                throw new ArgumentOutOfRangeException("processId");
            }

            List<WindowDescriptor> windows = new List<WindowDescriptor>();
            EnumWindows(delegate(IntPtr hwnd, IntPtr ignored)
            {
                uint owner;
                GetWindowThreadProcessId(hwnd, out owner);
                if (owner == (uint)processId)
                {
                    try
                    {
                        windows.Add(DescribeWindow(hwnd));
                    }
                    catch
                    {
                        // A window can disappear between EnumWindows and inspection.
                    }
                }
                return true;
            }, IntPtr.Zero);
            return windows.ToArray();
        }

        public static WindowDescriptor DescribeWindow(long hwndValue)
        {
            return DescribeWindow(new IntPtr(hwndValue));
        }

        public static bool PrintWindowToDc(long hwndValue, long destinationDcValue)
        {
            IntPtr hwnd = new IntPtr(hwndValue);
            if (!IsWindow(hwnd))
            {
                throw new ArgumentException("The supplied HWND is no longer valid.", "hwndValue");
            }
            if (destinationDcValue == 0)
            {
                throw new ArgumentException("A destination device context is required.", "destinationDcValue");
            }
            if (IsIconic(hwnd))
            {
                throw new InvalidOperationException("The target window is minimized; PrintWindow output would not be reliable.");
            }

            try { DwmFlush(); } catch (DllNotFoundException) { }
            return PrintWindow(hwnd, new IntPtr(destinationDcValue), PW_RENDERFULLCONTENT);
        }

        public static int LastWin32Error()
        {
            return Marshal.GetLastWin32Error();
        }

        public static long EnterPerMonitorDpiContext()
        {
            return TrySetThreadDpiContext().ToInt64();
        }

        public static void LeaveDpiContext(long previousContext)
        {
            RestoreThreadDpiContext(new IntPtr(previousContext));
        }

        public static long EnterWindowDpiContext(long hwndValue)
        {
            IntPtr hwnd = new IntPtr(hwndValue);
            if (!IsWindow(hwnd))
            {
                throw new ArgumentException("The supplied HWND is no longer valid.", "hwndValue");
            }
            try
            {
                IntPtr targetContext = GetWindowDpiAwarenessContext(hwnd);
                if (targetContext != IntPtr.Zero)
                {
                    return SetThreadDpiAwarenessContext(targetContext).ToInt64();
                }
            }
            catch (EntryPointNotFoundException) { }
            return TrySetThreadDpiContext().ToInt64();
        }

        public static CaptureMetrics GetCaptureMetrics(long hwndValue)
        {
            IntPtr hwnd = new IntPtr(hwndValue);
            if (!IsWindow(hwnd))
            {
                throw new ArgumentException("The supplied HWND is no longer valid.", "hwndValue");
            }

            RECT physicalWindow;
            RECT physicalFrame;
            IntPtr previous = TrySetThreadDpiContext();
            try
            {
                if (!GetWindowRect(hwnd, out physicalWindow))
                {
                    throw new InvalidOperationException("GetWindowRect failed with Win32 error " + Marshal.GetLastWin32Error() + ".");
                }
                physicalFrame = GetFrameRect(hwnd, physicalWindow);
            }
            finally
            {
                RestoreThreadDpiContext(previous);
            }

            RECT captureWindow;
            IntPtr targetContext = IntPtr.Zero;
            string awareness = "unknown";
            try
            {
                targetContext = GetWindowDpiAwarenessContext(hwnd);
                int awarenessValue = GetAwarenessFromDpiAwarenessContext(targetContext);
                if (awarenessValue == 0) { awareness = "unaware"; }
                else if (awarenessValue == 1) { awareness = "system-aware"; }
                else if (awarenessValue == 2) { awareness = "per-monitor-aware"; }
            }
            catch (EntryPointNotFoundException) { }

            previous = IntPtr.Zero;
            try
            {
                if (targetContext != IntPtr.Zero)
                {
                    previous = SetThreadDpiAwarenessContext(targetContext);
                }
                if (!GetWindowRect(hwnd, out captureWindow))
                {
                    throw new InvalidOperationException("GetWindowRect failed with Win32 error " + Marshal.GetLastWin32Error() + ".");
                }
            }
            finally
            {
                RestoreThreadDpiContext(previous);
            }

            int physicalWidth = physicalWindow.Right - physicalWindow.Left;
            int physicalHeight = physicalWindow.Bottom - physicalWindow.Top;
            int captureWidth = captureWindow.Right - captureWindow.Left;
            int captureHeight = captureWindow.Bottom - captureWindow.Top;
            if (physicalWidth <= 0 || physicalHeight <= 0 || captureWidth <= 0 || captureHeight <= 0)
            {
                throw new InvalidOperationException("The target window has invalid capture dimensions.");
            }

            double scaleX = physicalWidth / (double)captureWidth;
            double scaleY = physicalHeight / (double)captureHeight;
            int cropLeft = Math.Max(0, (int)Math.Round((physicalFrame.Left - physicalWindow.Left) / scaleX));
            int cropTop = Math.Max(0, (int)Math.Round((physicalFrame.Top - physicalWindow.Top) / scaleY));
            int cropWidth = Math.Min(captureWidth - cropLeft,
                (int)Math.Round((physicalFrame.Right - physicalFrame.Left) / scaleX));
            int cropHeight = Math.Min(captureHeight - cropTop,
                (int)Math.Round((physicalFrame.Bottom - physicalFrame.Top) / scaleY));

            return new CaptureMetrics
            {
                WindowWidth = captureWidth,
                WindowHeight = captureHeight,
                CropLeft = cropLeft,
                CropTop = cropTop,
                CropWidth = cropWidth,
                CropHeight = cropHeight,
                PhysicalToCaptureScaleX = scaleX,
                PhysicalToCaptureScaleY = scaleY,
                TargetDpiAwareness = awareness
            };
        }

        public static MonitorDescriptor[] EnumerateMonitors()
        {
            List<MonitorDescriptor> monitors = new List<MonitorDescriptor>();
            IntPtr previousDpiContext = TrySetThreadDpiContext();
            try
            {
                EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero,
                    delegate(IntPtr monitor, IntPtr ignoredHdc, ref RECT ignoredRect, IntPtr ignored)
                    {
                        MONITORINFOEX info = new MONITORINFOEX();
                        info.Size = Marshal.SizeOf(typeof(MONITORINFOEX));
                        if (!GetMonitorInfo(monitor, ref info))
                        {
                            return true;
                        }

                        uint dpiX = 0;
                        uint dpiY = 0;
                        int scale = 0;
                        try { GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, out dpiX, out dpiY); }
                        catch (DllNotFoundException) { }
                        try { GetScaleFactorForMonitor(monitor, out scale); }
                        catch (DllNotFoundException) { }
                        if (dpiX == 0) { dpiX = 96; }
                        if (dpiY == 0) { dpiY = 96; }
                        if (scale == 0) { scale = (int)Math.Round(dpiX * 100.0 / 96.0); }

                        monitors.Add(new MonitorDescriptor
                        {
                            Handle = monitor.ToInt64(),
                            DeviceName = info.DeviceName ?? String.Empty,
                            Primary = (info.Flags & MONITORINFOF_PRIMARY) != 0,
                            Left = info.Monitor.Left,
                            Top = info.Monitor.Top,
                            Width = info.Monitor.Right - info.Monitor.Left,
                            Height = info.Monitor.Bottom - info.Monitor.Top,
                            WorkLeft = info.Work.Left,
                            WorkTop = info.Work.Top,
                            WorkWidth = info.Work.Right - info.Work.Left,
                            WorkHeight = info.Work.Bottom - info.Work.Top,
                            EffectiveDpiX = (int)dpiX,
                            EffectiveDpiY = (int)dpiY,
                            ScalePercent = scale
                        });
                        return true;
                    }, IntPtr.Zero);
            }
            finally
            {
                RestoreThreadDpiContext(previousDpiContext);
            }
            return monitors.ToArray();
        }

        private static WindowDescriptor DescribeWindow(IntPtr hwnd)
        {
            if (!IsWindow(hwnd))
            {
                throw new ArgumentException("Invalid HWND.", "hwnd");
            }

            IntPtr previousDpiContext = TrySetThreadDpiContext();
            try
            {
                uint processId;
                GetWindowThreadProcessId(hwnd, out processId);
                RECT windowRect;
                if (!GetWindowRect(hwnd, out windowRect))
                {
                    throw new InvalidOperationException("GetWindowRect failed with Win32 error " + Marshal.GetLastWin32Error() + ".");
                }
                RECT frameRect = GetFrameRect(hwnd, windowRect);
                int cloaked = 0;
                try { DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, out cloaked, sizeof(int)); }
                catch (DllNotFoundException) { }

                uint dpi = 96;
                try
                {
                    uint candidate = GetDpiForWindow(hwnd);
                    if (candidate > 0) { dpi = candidate; }
                }
                catch (EntryPointNotFoundException) { }

                return new WindowDescriptor
                {
                    Hwnd = hwnd.ToInt64(),
                    ProcessId = (int)processId,
                    Title = ReadWindowText(hwnd),
                    ClassName = ReadClassName(hwnd),
                    Visible = IsWindowVisible(hwnd),
                    Minimized = IsIconic(hwnd),
                    Cloaked = cloaked != 0,
                    WindowLeft = windowRect.Left,
                    WindowTop = windowRect.Top,
                    WindowWidth = windowRect.Right - windowRect.Left,
                    WindowHeight = windowRect.Bottom - windowRect.Top,
                    FrameLeft = frameRect.Left,
                    FrameTop = frameRect.Top,
                    FrameWidth = frameRect.Right - frameRect.Left,
                    FrameHeight = frameRect.Bottom - frameRect.Top,
                    Dpi = (int)dpi
                };
            }
            finally
            {
                RestoreThreadDpiContext(previousDpiContext);
            }
        }

        private static RECT GetFrameRect(IntPtr hwnd, RECT fallback)
        {
            RECT frame;
            try
            {
                int result = DwmGetWindowAttribute(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS,
                    out frame, Marshal.SizeOf(typeof(RECT)));
                if (result == 0 && frame.Right > frame.Left && frame.Bottom > frame.Top)
                {
                    return frame;
                }
            }
            catch (DllNotFoundException) { }
            return fallback;
        }

        private static string ReadWindowText(IntPtr hwnd)
        {
            int length = GetWindowTextLength(hwnd);
            StringBuilder text = new StringBuilder(Math.Max(length + 1, 2));
            GetWindowText(hwnd, text, text.Capacity);
            return text.ToString();
        }

        private static string ReadClassName(IntPtr hwnd)
        {
            StringBuilder className = new StringBuilder(512);
            GetClassName(hwnd, className, className.Capacity);
            return className.ToString();
        }

        private static IntPtr TrySetThreadDpiContext()
        {
            try { return SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2); }
            catch (EntryPointNotFoundException) { return IntPtr.Zero; }
        }

        private static void RestoreThreadDpiContext(IntPtr previousContext)
        {
            if (previousContext == IntPtr.Zero) { return; }
            try { SetThreadDpiAwarenessContext(previousContext); }
            catch (EntryPointNotFoundException) { }
        }
    }
}
