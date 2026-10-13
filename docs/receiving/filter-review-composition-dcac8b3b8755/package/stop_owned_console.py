"""Send Ctrl+C only to the new console of the child started by receive_package.py."""
import ctypes,json,os,sys,time
pid=int(sys.argv[1])
kernel=ctypes.WinDLL("kernel32",use_last_error=True)
kernel.FreeConsole()
if not kernel.AttachConsole(pid):
    raise ctypes.WinError(ctypes.get_last_error())
try:
    if not kernel.SetConsoleCtrlHandler(None,True):
        raise ctypes.WinError(ctypes.get_last_error())
    ids=(ctypes.c_ulong*16)()
    count=kernel.GetConsoleProcessList(ids,16)
    attached=set(ids[:min(count,16)])
    if count!=2 or attached!={pid,os.getpid()}:
        raise RuntimeError("Refusing a console containing any other process: "+repr(sorted(attached)))
    if not kernel.GenerateConsoleCtrlEvent(0,0):
        raise ctypes.WinError(ctypes.get_last_error())
    time.sleep(0.25)
    print(json.dumps({"owned_child":pid,"helper":os.getpid(),"console_processes":sorted(attached),"ctrl_c_sent":True}))
finally:
    kernel.FreeConsole()
