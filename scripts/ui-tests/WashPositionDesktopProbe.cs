// Desktop integration test, not a FiveM test. The production helper is launched
// unchanged against this foreground window. It must capture real pixels and
// deliver real Windows W down/up events; no input or image adapters are mocked.
using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

internal sealed class WashPositionDesktopProbe : Form
{
    private readonly string helper, output;
    private readonly Bitmap texture;
    private readonly StringBuilder evidence = new StringBuilder();
    private int offset, keyDowns, keyUps, microPixels;
    private bool keyHeld, noEffect, wrongDirection;
    private int status=1;
    private Process child;
    private readonly string directory;
    [STAThread] private static int Main(string[] args)
    {
        if(args.Length!=2)return 64;
        try {SetProcessDpiAwarenessContext(new IntPtr(-4));} catch(EntryPointNotFoundException){}
        Application.EnableVisualStyles();
        using(var p=new WashPositionDesktopProbe(Path.GetFullPath(args[0]),Path.GetFullPath(args[1])))
        {Application.Run(p);return p.status;}
    }
    private WashPositionDesktopProbe(string executable,string result)
    {
        helper=executable;output=result;directory=Path.Combine(Path.GetDirectoryName(output),"desktop-probe");
        Directory.CreateDirectory(directory);texture=new Bitmap(256,144);
        var rng=new Random(31499);
        for(int y=0;y<144;y++)for(int x=0;x<256;x++)
        {int value=rng.Next(25,210);texture.SetPixel(x,y,Color.FromArgb(value,value,value));}
        FormBorderStyle=FormBorderStyle.None;AutoScaleMode=AutoScaleMode.None;
        ClientSize=new Size(1024,576);StartPosition=FormStartPosition.Manual;Location=new Point(0,0);
        DoubleBuffered=true;KeyPreview=true;
        KeyDown+=delegate(object s,KeyEventArgs e){if(e.KeyCode==Keys.W&&!keyHeld){keyHeld=true;keyDowns++;if(!noEffect){if(microPixels>0)microPixels--;else offset+=wrongDirection?1:-1;}Invalidate();Update();}};
        KeyUp+=delegate(object s,KeyEventArgs e){if(e.KeyCode==Keys.W){keyHeld=false;keyUps++;}};
        Shown+=delegate{BeginInvoke(new Action(Run));};
        FormClosed+=delegate{if(child!=null&&!child.HasExited)try{child.Kill();}catch{};texture.Dispose();};
    }
    protected override void OnPaint(PaintEventArgs e)
    {
        e.Graphics.Clear(Color.Black);e.Graphics.InterpolationMode=InterpolationMode.NearestNeighbor;
        e.Graphics.PixelOffsetMode=PixelOffsetMode.Half;
        e.Graphics.DrawImage(texture,new Rectangle(0,offset*4+microPixels,1024,576),0,0,256,144,GraphicsUnit.Pixel);
    }
    private static void Check(bool okay,string reason){if(!okay)throw new Exception(reason);}
    private void Pump(int ms)
    {var clock=Stopwatch.StartNew();while(clock.ElapsedMilliseconds<ms){Application.DoEvents();Thread.Sleep(5);}}
    private string Execute(string operation,string label,bool cancel)
    {
        string result=Path.Combine(directory,label+".txt"),cancelFile=Path.Combine(directory,label+".cancel");
        if(File.Exists(result))File.Delete(result);if(File.Exists(cancelFile))File.Delete(cancelFile);
        if(cancel)File.WriteAllText(cancelFile,"cancel");
        Activate();SetForegroundWindow(Handle);Pump(100);
        Check(GetForegroundWindow()==Handle,"DESKTOP_NOT_FOREGROUND");
        int pid=Process.GetCurrentProcess().Id;
        string args=operation+" \""+result+"\" "+Handle.ToInt64()+" "+pid+" \""+cancelFile+"\" \""+Path.Combine(directory,"anchor.json")+"\" 1 "+pid;
        child=Process.Start(new ProcessStartInfo(helper,args){UseShellExecute=false});
        var timeout=Stopwatch.StartNew();
        while(!child.HasExited){Pump(10);if(timeout.ElapsedMilliseconds>25000){child.Kill();throw new Exception("HELPER_TIMEOUT "+label);}}
        Pump(100);string text=File.Exists(result)?File.ReadAllText(result).Trim():"NO_RESULT";
        evidence.AppendLine(label+": "+text+" Wdown="+keyDowns+" Wup="+keyUps+" offset="+offset+" microPixels="+microPixels);
        child.Dispose();child=null;
        Check(!keyHeld && (GetAsyncKeyState(0x57)&0x8000)==0,"W_STUCK "+label);
        Check(keyDowns==keyUps,"UNBALANCED_KEY_EVENTS "+label);
        return text;
    }
    private void Reset(int displacement,bool noMove,bool wrong)
    {offset=displacement;microPixels=0;keyDowns=keyUps=0;noEffect=noMove;wrongDirection=wrong;keyHeld=false;Invalidate();Update();Pump(150);}
    private void Run()
    {
        try
        {
            Reset(0,false,false);
            Check(Execute("wash-anchor","anchor",false)=="WASH_ANCHORED","ANCHOR_FAILED");
            Check(keyDowns==0,"ANCHOR_INJECTED_INPUT");
            Reset(0,false,false);
            Check(Execute("wash-correct","no-drift",false).StartsWith("WASH_STABLE 0 0 "),"NO_DRIFT_RESULT");
            Check(keyDowns==0,"NO_DRIFT_MOVED");
            Reset(4,false,false);
            Check(Execute("wash-correct","observed-correction",false).StartsWith("WASH_STABLE "),"CORRECTION_FAILED");
            Check(offset==0&&keyDowns==4,"PHYSICAL_CORRECTION_NOT_OBSERVED");
            Reset(3,true,false);
            Check(Execute("wash-correct","no-effect",false)=="ERROR FORWARD_NO_OBSERVED_EFFECT","NO_EFFECT_NOT_REJECTED");
            Check(keyDowns==2&&offset==3,"NO_EFFECT_BUDGET");
            Reset(3,false,true);
            Check(Execute("wash-correct","wrong-direction",false)=="ERROR WRONG_DIRECTION_OR_CAMERA_MOVED","WRONG_DIRECTION_NOT_REJECTED");
            Check(keyDowns==1&&offset==4,"WRONG_DIRECTION_BUDGET");
            Reset(3,false,false);
            Check(Execute("wash-correct","pre-cancel",true)=="ERROR CANCELLED","CANCEL_FAILED");
            Check(keyDowns==0,"CANCEL_INJECTED_INPUT");
            Reset(0,false,false);
            Check(Execute("wash-maintain","nearby-no-drift",false).StartsWith("WASH_STABLE 0 0 "),"NEARBY_NO_DRIFT_MOVED");
            // One physical screen pixel is 0.25px in the captured 256-wide image.
            // This previously fell inside the 0.65px no-input band.
            Reset(0,false,false);microPixels=1;Invalidate();Update();Pump(150);
            Check(Execute("wash-correct","micro-standard-baseline",false).StartsWith("WASH_STABLE 0 0 "),"STANDARD_PROFILE_CHANGED");
            Check(microPixels==1 && keyDowns==0,"STANDARD_BASELINE_MOVED");
            for(int cycle=0;cycle<8;cycle++)
            {
                keyDowns=keyUps=0;microPixels=1;Invalidate();Update();Pump(150);
                Check(Execute("wash-maintain","micro-cycle-"+cycle,false).StartsWith("WASH_STABLE "),"MICRO_CYCLE_FAILED");
                Check(microPixels==0 && offset==0 && keyDowns==1,"MICRO_NATIVE_INPUT_NOT_OBSERVED");
            }
            Reset(3,true,false);
            Check(Execute("wash-maintain","nearby-no-effect",false)=="ERROR FORWARD_NO_OBSERVED_EFFECT","NEARBY_NO_EFFECT_GUARD");
            Check(keyDowns==2,"NEARBY_NO_EFFECT_BUDGET");
            Reset(3,false,true);
            Check(Execute("wash-maintain","nearby-wrong-direction",false)=="ERROR WRONG_DIRECTION_OR_CAMERA_MOVED","NEARBY_DIRECTION_GUARD");
            Check(keyDowns==1,"NEARBY_DIRECTION_BUDGET");
            Reset(3,false,false);
            Check(Execute("wash-maintain","nearby-pre-cancel",true)=="ERROR CANCELLED","NEARBY_CANCEL");
            Check(keyDowns==0,"NEARBY_CANCEL_INPUT");
            Reset(0,false,false);
            Check(Execute("wash-service","service-no-drift",false).StartsWith("WASH_SERVICE 0 0 "),"SERVICE_NO_DRIFT");
            Reset(2,false,true);
            Check(Execute("wash-service","service-camera-residual",false).StartsWith("WASH_SERVICE 1 "),"SERVICE_RESULT");
            Check(keyDowns==1 && keyUps==1 && offset==3,"SERVICE_ONE_PULSE_ONLY");
            Reset(2,true,false);
            Check(Execute("wash-service","service-no-motion",false).StartsWith("WASH_SERVICE 1 "),"SERVICE_NEEDS_TASK_PROOF");
            Check(keyDowns==1 && offset==2,"SERVICE_NO_MOTION_LIMIT");
            Reset(2,false,false);
            Check(Execute("wash-service","service-cancel",true)=="ERROR CANCELLED","SERVICE_CANCEL");
            Check(keyDowns==0,"SERVICE_CANCEL_INPUT");
            evidence.AppendLine("DESKTOP_PROBE OK (synthetic Windows target, NOT FiveM)");status=0;
        }
        catch(Exception e){evidence.AppendLine("DESKTOP_PROBE ERROR "+e.Message);}
        finally{File.WriteAllText(output,evidence.ToString(),new UTF8Encoding(false));Close();}
    }
    [DllImport("user32.dll")]private static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")]private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")]private static extern bool SetProcessDpiAwarenessContext(IntPtr context);
}
