import paramiko
import json

VPS_HOST = '213.136.76.153'
VPS_USER = 'root'
VPS_PASS = 'qLAPgtTM2R5d'
API_KEY = 'xCdANIh_JYwEwczVoPOfp1SdV0YTvhBkNqWPsjkfhVBiazJm6cCyJraMVEo9jxvp'
SESSION_ID = 'ses_e188d728-ef4a-4ef5-8dd7-970aa5ed964d'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=30)

payload = json.dumps({
    "to": "918017603931",
    "text": "System check: Anti-detection FIFO queue verified active"
})

cmd = f"""curl -s -X POST http://localhost:8090/api/v1/sessions/{SESSION_ID}/messages/send-text \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: {API_KEY}" \\
  -d '{payload}'"""

print("Executing:", cmd)
stdin, stdout, stderr = ssh.exec_command(cmd)
print("Response:", stdout.read().decode('utf-8'))
ssh.close()
