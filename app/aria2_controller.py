import http.server
import json
import subprocess
import os
import signal
import sys
import re
import time

PORT = 8085
ARIA2_CONF = "/gemini/app/aria2_config/aria2.conf"
ARIA2_CMD = ["aria2c", "--conf-path=" + ARIA2_CONF, "--daemon=true"]
PID_FILE = "/gemini/app/aria2_config/aria2.pid"

def get_aria2_pid():
    try:
        # Check if process name contains aria2c
        cmd = "pgrep -f 'aria2c --conf-path'"
        pid = subprocess.check_output(cmd, shell=True).decode().strip()
        if pid:
            return int(pid.split('\n')[0])
    except subprocess.CalledProcessError:
        pass
    return None

def update_config(max_downloads, split):
    try:
        with open(ARIA2_CONF, 'r') as f:
            lines = f.readlines()
        
        new_lines = []
        keys_found = {'max-concurrent-downloads': False, 'split': False, 'max-connection-per-server': False}
        
        for line in lines:
            if line.startswith("max-concurrent-downloads="):
                new_lines.append(f"max-concurrent-downloads={max_downloads}\n")
                keys_found['max-concurrent-downloads'] = True
            elif line.startswith("split="):
                new_lines.append(f"split={split}\n")
                keys_found['split'] = True
            elif line.startswith("max-connection-per-server="):
                new_lines.append(f"max-connection-per-server={split}\n") # Usually keep same as split
                keys_found['max-connection-per-server'] = True
            else:
                new_lines.append(line)
        
        if not keys_found['max-concurrent-downloads']:
            new_lines.append(f"max-concurrent-downloads={max_downloads}\n")
        if not keys_found['split']:
            new_lines.append(f"split={split}\n")
        if not keys_found['max-connection-per-server']:
            new_lines.append(f"max-connection-per-server={split}\n")
            
        with open(ARIA2_CONF, 'w') as f:
            f.writelines(new_lines)
        return True
    except Exception as e:
        print(f"Error updating config: {e}")
        return False

class RequestHandler(http.server.BaseHTTPRequestHandler):
    def _send_response(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        self._send_response({})

    def do_GET(self):
        if self.path == '/status':
            pid = get_aria2_pid()
            max_downloads = 3
            split = 5
            try:
                with open(ARIA2_CONF, 'r') as f:
                    for line in f:
                        if line.startswith("max-concurrent-downloads="):
                            max_downloads = int(line.strip().split('=')[1])
                        elif line.startswith("split="):
                            split = int(line.strip().split('=')[1])
            except:
                pass
                
            self._send_response({
                "running": pid is not None,
                "pid": pid,
                "max_concurrent_downloads": max_downloads,
                "split": split
            })
        else:
            self.send_error(404)

    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length) if content_length > 0 else b""
            
            if self.path == '/start':
                if get_aria2_pid():
                    self._send_response({"success": False, "message": "Already running"})
                else:
                    subprocess.Popen(ARIA2_CMD)
                    time.sleep(1) # Wait for startup
                    self._send_response({"success": True, "message": "Started"})
                    
            elif self.path == '/stop':
                pid = get_aria2_pid()
                if pid:
                    os.kill(pid, signal.SIGTERM)
                    self._send_response({"success": True, "message": "Stopped"})
                else:
                    self._send_response({"success": False, "message": "Not running"})
                    
            elif self.path == '/configure':
                data = json.loads(post_data)
                max_downloads = int(data.get('max_concurrent_downloads', 3))
                split = int(data.get('split', 5))
                
                if update_config(max_downloads, split):
                    # Always restart or start to apply changes
                    pid = get_aria2_pid()
                    if pid:
                        os.kill(pid, signal.SIGTERM)
                        time.sleep(1)
                    
                    # Start service
                    subprocess.Popen(ARIA2_CMD)
                    self._send_response({"success": True, "message": "Config updated and service started"})
                else:
                    self._send_response({"success": False, "message": "Failed to update config"}, 500)
            else:
                self.send_error(404)
        except Exception as e:
            self._send_response({"success": False, "message": str(e)}, 500)

print(f"Starting Control Server on port {PORT}")
http.server.HTTPServer(('127.0.0.1', PORT), RequestHandler).serve_forever()