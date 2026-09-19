using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
namespace FishingPilot {
 internal static class Native {
  [StructLayout(LayoutKind.Sequential)]public struct RECT{public int Left,Top,Right,Bottom;}
  [StructLayout(LayoutKind.Sequential)]public struct POINT{public int X,Y;}
  [StructLayout(LayoutKind.Sequential)]struct INPUT{public uint type;public UNION data;}
  [StructLayout(LayoutKind.Explicit)]struct UNION{[FieldOffset(0)]public KEYBDINPUT ki;[FieldOffset(0)]public MOUSEINPUT mi;}
  [StructLayout(LayoutKind.Sequential)]struct KEYBDINPUT{public ushort vk,scan;public uint flags,time;public UIntPtr extra;}
  [StructLayout(LayoutKind.Sequential)]struct MOUSEINPUT{public int dx,dy;public uint data,flags,time;public UIntPtr extra;}
  [DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]public static extern bool GetClientRect(IntPtr h,out RECT r);
  [DllImport("user32.dll")]public static extern bool ClientToScreen(IntPtr h,ref POINT p);
  [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
  [DllImport("user32.dll")]public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")]public static extern short GetAsyncKeyState(int k);
  [DllImport("user32.dll",SetLastError=true)]static extern uint SendInput(uint n,INPUT[] inputs,int size);
  [DllImport("user32.dll")]static extern uint MapVirtualKey(uint code,uint map);
  [DllImport("user32.dll",SetLastError=true)]public static extern bool RegisterHotKey(IntPtr h,int id,uint mod,uint key);
  [DllImport("user32.dll")]public static extern bool UnregisterHotKey(IntPtr h,int id);
  [DllImport("user32.dll")]public static extern bool SetProcessDPIAware();
  [DllImport("winmm.dll")]public static extern uint timeBeginPeriod(uint p);
  [DllImport("winmm.dll")]public static extern uint timeEndPeriod(uint p);
  public static IntPtr FishingWindow(){IntPtr h=GetForegroundWindow();var s=new StringBuilder(512);GetWindowText(h,s,512);if(!s.ToString().StartsWith("FiveM",StringComparison.OrdinalIgnoreCase))return IntPtr.Zero;uint id;GetWindowThreadProcessId(h,out id);try{if(Process.GetProcessById((int)id).ProcessName.IndexOf("FiveM",StringComparison.OrdinalIgnoreCase)<0)return IntPtr.Zero;}catch{return IntPtr.Zero;}return h;}
  delegate bool EnumProc(IntPtr hwnd,IntPtr data);
  [DllImport("user32.dll")]static extern bool EnumWindows(EnumProc callback,IntPtr data);
  [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr hwnd);
  public static IntPtr FindFishingWindow(){IntPtr found=IntPtr.Zero;int count=0;EnumWindows(delegate(IntPtr h,IntPtr unused){if(!IsWindowVisible(h))return true;var title=new StringBuilder(512);GetWindowText(h,title,512);if(!title.ToString().StartsWith("FiveM",StringComparison.OrdinalIgnoreCase))return true;uint p;GetWindowThreadProcessId(h,out p);try{if(Process.GetProcessById((int)p).ProcessName.IndexOf("FiveM",StringComparison.OrdinalIgnoreCase)>=0){found=h;count++;}}catch{}return true;},IntPtr.Zero);return count==1?found:IntPtr.Zero;}
  public static Rectangle Client(IntPtr h){RECT r;POINT p=new POINT();if(!GetClientRect(h,out r)||!ClientToScreen(h,ref p))return Rectangle.Empty;return new Rectangle(p.X,p.Y,r.Right-r.Left,r.Bottom-r.Top);}
  public static Bitmap Capture(Rectangle area,int width,int height){using(var b=new Bitmap(area.Width,area.Height,PixelFormat.Format32bppArgb)){using(Graphics g=Graphics.FromImage(b))g.CopyFromScreen(area.Location,Point.Empty,area.Size,CopyPixelOperation.SourceCopy);var result=new Bitmap(width,height,PixelFormat.Format32bppArgb);using(Graphics g=Graphics.FromImage(result)){g.InterpolationMode=System.Drawing.Drawing2D.InterpolationMode.Bilinear;g.DrawImage(b,0,0,width,height);}return result;}}
  [DllImport("iphlpapi.dll", SetLastError=true)]static extern uint GetExtendedTcpTable(IntPtr table,ref int size,bool order,int family,int type,uint reserved);
  public static int FiveMConsolePort(){
   int size=0;GetExtendedTcpTable(IntPtr.Zero,ref size,false,2,3,0);if(size<=4||size>4000000)return 0;
   IntPtr buffer=Marshal.AllocHGlobal(size);
   try{if(GetExtendedTcpTable(buffer,ref size,false,2,3,0)!=0)return 0;int count=Marshal.ReadInt32(buffer);var found=new System.Collections.Generic.List<int>();
    for(int i=0;i<count;i++){int offset=4+i*24;if(offset+24>size)break;int state=Marshal.ReadInt32(buffer,offset);int port=Marshal.ReadByte(buffer,offset+8)*256+Marshal.ReadByte(buffer,offset+9);int pid=Marshal.ReadInt32(buffer,offset+20);if(state!=2||(port!=29200&&port!=29300))continue;
     try{if(Process.GetProcessById(pid).ProcessName.IndexOf("FiveM",StringComparison.OrdinalIgnoreCase)>=0&&!found.Contains(port))found.Add(port);}catch{}
    }return found.Count==1?found[0]:0;
   }finally{Marshal.FreeHGlobal(buffer);}
  }
  [ThreadStatic] public static string LastInputDiagnostic;
  public static bool Press(IntPtr h,uint expectedPid,int digit,CancellationToken cancel,int holdMs=24){
   uint pid;GetWindowThreadProcessId(h,out pid);
   LastInputDiagnostic="target_or_cancel_guard";
   if(cancel.IsCancellationRequested||h!=GetForegroundWindow()||pid!=expectedPid||!IsWindow(h)||digit<0||digit>9||holdMs<10||holdMs>200)return false;
   int vk=0x30+digit;if((GetAsyncKeyState(vk)&0x8000)!=0){LastInputDiagnostic="key_already_down";return false;}
   var down=new INPUT{type=1,data=new UNION{ki=new KEYBDINPUT{scan=(ushort)MapVirtualKey((uint)vk,0),flags=0x0008}}};
   var up=down;up.data.ki.flags|=0x0002;
   bool sent=false;
   try{sent=SendInput(1,new[]{down},Marshal.SizeOf(typeof(INPUT)))==1;int error=Marshal.GetLastWin32Error();LastInputDiagnostic=sent?"keydown_sent hold_ms="+holdMs:"SendInput_failed win32="+error+" integrity_or_input_block_possible";if(sent)cancel.WaitHandle.WaitOne(holdMs);return sent;}
   finally{if(sent)SendInput(1,new[]{up},Marshal.SizeOf(typeof(INPUT)));}
  }
  public static bool HoldForward(IntPtr h,uint expectedPid,int milliseconds,CancellationToken cancel,Func<bool> enabled){
   uint pid;GetWindowThreadProcessId(h,out pid);
   if(cancel.IsCancellationRequested||!enabled()||h!=GetForegroundWindow()||pid!=expectedPid||!IsWindow(h)||milliseconds<100||milliseconds>700||(GetAsyncKeyState(0x57)&0x8000)!=0)return false;
   var down=new INPUT{type=1,data=new UNION{ki=new KEYBDINPUT{scan=(ushort)MapVirtualKey(0x57,0),flags=0x0008}}};var up=down;up.data.ki.flags|=0x0002;bool sent=false;
   try{sent=SendInput(1,new[]{down},Marshal.SizeOf(typeof(INPUT)))==1;if(sent){var sw=Stopwatch.StartNew();while(sw.ElapsedMilliseconds<milliseconds&&!cancel.IsCancellationRequested&&enabled()&&GetForegroundWindow()==h)cancel.WaitHandle.WaitOne(10);}return sent;}
   finally{if(sent)SendInput(1,new[]{up},Marshal.SizeOf(typeof(INPUT)));}
  }
 }
}
