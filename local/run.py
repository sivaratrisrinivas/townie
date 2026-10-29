import json,subprocess,time,sys
tag,U=sys.argv[1],sys.argv[2]
J={"bonjovi":"I am so old my first concert was Bon Jovi.","kardashians":"My cousin binge watches The Kardashians and calls it research.","cruise":"My uncle thinks Tom Cruise is a role model and Olive Garden is fine dining.","swift":"My sister cried at a Taylor Swift concert, and she doesn't even cry at weddings."}
C=["New York City","Los Angeles","Chicago","Houston","Austin","Atlanta","Boston","Mumbai","Delhi","Bengaluru","Hyderabad","Chennai","Kolkata","Pune"]
out=[]
for k,j in J.items():
  for c in C:
    r=subprocess.run(["curl","-s","-b","/tmp/nj.txt","-X","POST","-H","content-type: application/json","-d",json.dumps({"joke":j,"city":c}),U+"/api/townie"],capture_output=True,text=True).stdout
    try: d=json.loads(r)
    except: d={"status":"bad"}
    p=d.get("picks") or []; sel=next((x for x in p if x["id"]==d.get("selectedId")),None)
    s=d.get("slots") or []; i=d.get("slotIndex") or 0
    a=d.get("localAngle") or {}
    row={"joke":k,"city":c,"status":d.get("status"),"slot":s[i]["text"] if s else None,"pick":sel["name"] if sel else None,"top":[x["name"] for x in p[:3]],"angle":(a.get("reference") or "")+" ["+(a.get("category") or "")+"]" if a else None,"msg":d.get("message")}
    out.append(row); print(json.dumps(row),flush=True); time.sleep(1.5)
json.dump(out,open(f"/workspace/townie-app/local/{tag}.json","w"),indent=1)
