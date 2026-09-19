using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using FishingPilot;
class Integration : Form {
 [StructLayout(LayoutKind.Sequential)]struct Input{public uint type;public Union data;}
 [StructLayout(LayoutKind.Explicit)]struct Union{[FieldOffset(0)]public Key ki;[FieldOffset(0)]public Mouse mi;}
 [StructLayout(LayoutKind.Sequential)]struct Key{public ushort vk,scan;public uint flags,time;public UIntPtr extra;}
 [StructLayout(LayoutKind.Sequential)]struct Mouse{public int dx,dy;public uint data,flags,time;public UIntPtr extra;}
 [DllImport("user32.dll")]static extern bool RegisterHotKey(IntPtr h,int id,uint mod,uint key);
 [DllImport("user32.dll")]static extern bool UnregisterHotKey(IntPtr h,int id);
 [DllImport("user32.dll")]static extern uint SendInput(uint n,Input[] inputs,int size);
 [DllImport("user32.dll")]static extern uint MapVirtualKey(uint code,uint map);
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]static extern bool SetProcessDPIAware();
 readonly string output;readonly Engine engine;Status last=new Status();int starts,stops,rodDown,rodUp,digitDown,digitUp;string fault="";
 Integration(string path){output=path;Text="FiveM - FishingPilot integration fixture (not a real game)";ClientSize=new Size(700,560);StartPosition=FormStartPosition.CenterScreen;BackColor=Color.FromArgb(10,20,35);KeyPreview=true;
  engine=new Engine(path,Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"digit-templates.json"));engine.Changed+=delegate(Status s){last=s;};
  KeyDown+=delegate(object s,KeyEventArgs e){if(e.KeyCode==Keys.D2){rodDown++;File.WriteAllText(Path.Combine(output,"rod.sent"),"2");}if(e.KeyCode==Keys.D4){digitDown++;File.WriteAllText(Path.Combine(output,"digit.sent"),"4");}};
  KeyUp+=delegate(object s,KeyEventArgs e){if(e.KeyCode==Keys.D2)rodUp++;if(e.KeyCode==Keys.D4)digitUp++;};
 }
 protected override void WndProc(ref Message m){if(m.Msg==0x312){if(m.WParam.ToInt32()==1){starts++;try{engine.Start(new Options{AutoNeeds=false,ObserveOnly=false,BackgroundMode=false,ShowOverlay=false});}catch(Exception e){fault=e.ToString();}}else if(m.WParam.ToInt32()==2){stops++;engine.Stop();}}base.WndProc(ref m);}
 static void KeyStroke(uint vk){var d=new Input{type=1,data=new Union{ki=new Key{scan=(ushort)MapVirtualKey(vk,0),flags=8}}};var u=d;u.data.ki.flags|=2;if(SendInput(2,new[]{d,u},Marshal.SizeOf(typeof(Input)))!=2)throw new Exception("Test hotkey send failed");}
 static void Pump(int ms){var sw=Stopwatch.StartNew();while(sw.ElapsedMilliseconds<ms){Application.DoEvents();Thread.Sleep(3);}}
 [STAThread]static int Main(string[] args){SetProcessDPIAware();Application.EnableVisualStyles();string path=Path.GetFullPath(args[0]);Directory.CreateDirectory(path);bool blocked=args.Length>1&&args[1]=="blocked";var result=new Dictionary<string,object>();
  try{using(var f=new Integration(path)){f.Show();f.Activate();Pump(400);if(GetForegroundWindow()!=f.Handle)throw new Exception("Fixture lacks foreground");bool a=RegisterHotKey(f.Handle,1,0x4000,0x74),b=RegisterHotKey(f.Handle,2,0x4000,0x75);if(!a||!b)throw new Exception("Fixture hotkey registration failed");
   KeyStroke(0x74);var sw=Stopwatch.StartNew();while(sw.ElapsedMilliseconds<(blocked?4500:15000)){Application.DoEvents();Thread.Sleep(4);if(!blocked&&f.last.Results>=1)break;}
   bool pass=blocked?f.starts==1&&f.rodDown==0:f.starts==1&&f.rodDown>=1&&f.rodUp>=1&&f.digitDown==1&&f.digitUp==1&&f.last.Results>=1;
   result["phase"]=f.last.Phase;result["detail"]=f.last.Detail;result["results"]=f.last.Results;result["fault"]=f.fault;result["expected_blocked"]=blocked;
   KeyStroke(0x75);Pump(500);int stoppedRods=f.rodDown;Pump(700);pass&=f.stops==1&&!f.engine.Running&&f.rodDown==stoppedRods;
   result["F5_received"]=f.starts;result["F6_received"]=f.stops;result["rod_down"]=f.rodDown;result["rod_up"]=f.rodUp;result["digit_down"]=f.digitDown;result["digit_up"]=f.digitUp;result["no_input_after_stop"]=f.rodDown==stoppedRods;result["pass"]=pass;result["real_fivem"]=false;
   // Exercise the actual private frame traversal with .NET's nested-list shapes.
   var bridge=typeof(Engine).Assembly.GetType("CdpBridge+FishingConnection");var collect=bridge.GetMethod("Collect",BindingFlags.NonPublic|BindingFlags.Static);var json=new JavaScriptSerializer();
   foreach(string shape in new[]{"json","arraylist"}){var tree=(Dictionary<string,object>)json.DeserializeObject("{\"frame\":{\"url\":\"nui://game/ui/root.html\"},\"childFrames\":[{\"frame\":{\"url\":\"https://cfx-nui-ox_lib/web/build/index.html\"}}]}");if(shape=="arraylist")tree["childFrames"]=new ArrayList((ICollection)tree["childFrames"]);var urls=new List<string>();try{collect.Invoke(null,new object[]{tree,urls});result[shape+"_traversal_ok"]=urls.Count==2;}catch(Exception e){result[shape+"_traversal_ok"]=false;result[shape+"_error"]=e.InnerException==null?e.Message:e.InnerException.Message;}}
   f.engine.Dispose();UnregisterHotKey(f.Handle,1);UnregisterHotKey(f.Handle,2);f.Close();File.WriteAllText(Path.Combine(path,"RESULT.json"),json.Serialize(result));return pass?0:1;
  }}catch(Exception e){result["pass"]=false;result["exception"]=e.ToString();File.WriteAllText(Path.Combine(path,"RESULT.json"),new JavaScriptSerializer().Serialize(result));return 1;}
 }
}
