from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse,parse_qs
import json
class H(BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def send(self,status,body):
  self.send_response(status); self.send_header('Access-Control-Allow-Origin','http://127.0.0.1:3037'); self.send_header('Access-Control-Allow-Headers','Authorization,Content-Type'); self.send_header('Access-Control-Allow-Methods','GET,OPTIONS'); self.send_header('Content-Type','application/json'); self.end_headers(); self.wfile.write(json.dumps(body).encode())
 def do_OPTIONS(self): self.send(204,{})
 def do_GET(self):
  u=urlparse(self.path); p=u.path; station=parse_qs(u.query).get('restaurant',[''])[0]; role='cook' if station.endswith('kitchen') else 'server'
  days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  body={}; status=200
  if p=='/api/auth/verify': pass
  elif p=='/api/inventory/CR3/list': body={'rev':0,'sheets':None}
  elif p.startswith('/api/cashout/') or p=='/api/inventory/CR3': body={'days':[]}
  elif p=='/api/writeups': body={'writeUps':[]}
  elif p=='/api/forms': body={'forms':[]}
  elif p in ('/api/employees','/api/staff'): body={'employees':[{'id':'sample-1','name':'Sample Employee','roles':[role],'recurringAvailability':{d:[{'start':540,'end':1380}] for d in days},'maxDaysPerWeek':7,'maxShiftsPerWeek':7,'allowDoubles':False,'active':True,'incompatibleEmployeeIds':[],'priority':3}], 'rev':1,'updatedAt':'2026-11-10T12:00:00Z','canUndo':False}
  elif p=='/api/template': body={'template':{d:[{'period':'AM','role':role,'label':'Morning coverage','start':600,'end':960,'required':True}] for d in days},'rev':1,'updatedAt':'2026-11-10T12:00:00Z'}
  elif p=='/api/schedule': body={'weeks':[],'rev':1,'notModified':False}
  elif p.startswith('/api/schedule/'): status=404
  elif p.startswith('/api/internal/schedule-requests/'): body={'record':None}
  else: status=404
  self.send(status,body)
 def do_PUT(self): self.send(405,{'error':'Research fixture refuses writes'})
 do_POST=do_PUT
 do_DELETE=do_PUT
ThreadingHTTPServer(('127.0.0.1',8799),H).serve_forever()
