import paramiko
import os
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = '213.136.76.153'
VPS_USER = 'root'
VPS_PASS = 'qLAPgtTM2R5d'
LOCAL_BASE = r'c:\client\reachout-automation2.0'
REMOTE_BASE = '/opt/velurix-backend'

def deploy():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=30)
    sftp = ssh.open_sftp()

    print("Uploading src files to VPS...")
    local_src = os.path.join(LOCAL_BASE, 'apps', 'whatsapp-engine', 'src')
    remote_src = f"{REMOTE_BASE}/apps/whatsapp-engine/src"
    for fname in os.listdir(local_src):
        l_path = os.path.join(local_src, fname)
        r_path = f"{remote_src}/{fname}"
        if os.path.isfile(l_path):
            print(f"  Uploading src/{fname}...")
            sftp.put(l_path, r_path)

    print("Uploading dist files to VPS...")
    local_dist = os.path.join(LOCAL_BASE, 'apps', 'whatsapp-engine', 'dist')
    remote_dist = f"{REMOTE_BASE}/apps/whatsapp-engine/dist"
    
    # Ensure remote dist dir exists
    try:
        sftp.mkdir(remote_dist)
    except:
        pass

    for fname in os.listdir(local_dist):
        l_path = os.path.join(local_dist, fname)
        r_path = f"{remote_dist}/{fname}"
        if os.path.isfile(l_path):
            print(f"  Uploading {fname}...")
            sftp.put(l_path, r_path)

    sftp.close()
    print("Files uploaded to VPS.")

    print("Copying dist files into docker container...")
    cmd = "docker cp /opt/velurix-backend/apps/whatsapp-engine/dist/. velurix-backend:/app/apps/whatsapp-engine/dist/"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    stdout.channel.recv_exit_status()
    print("Files copied into container.")

    print("Querying active WhatsApp sessions on VPS...")
    import json
    cmd_sess = "curl -s http://localhost:8090/api/v1/sessions -H 'X-API-Key: xCdANIh_JYwEwczVoPOfp1SdV0YTvhBkNqWPsjkfhVBiazJm6cCyJraMVEo9jxvp'"
    stdin, stdout, stderr = ssh.exec_command(cmd_sess)
    sess_out = stdout.read().decode('utf-8', errors='replace')
    try:
        sess_data = json.loads(sess_out)
        sessions = sess_data.get('data', [])
        if sessions:
            active_id = sessions[0]['id']
            print(f"Restarting active WhatsApp session {active_id} ({sessions[0].get('displayName')})...")
            cmd_restart = f"curl -s -X POST http://localhost:8090/api/v1/sessions/{active_id}/restart -H 'X-API-Key: xCdANIh_JYwEwczVoPOfp1SdV0YTvhBkNqWPsjkfhVBiazJm6cCyJraMVEo9jxvp'"
            stdin, stdout, stderr = ssh.exec_command(cmd_restart)
            out = stdout.read().decode('utf-8', errors='replace')
            print("Restart response:", out)
        else:
            print("No sessions found to restart.")
    except Exception as e:
        print(f"Error restarting session: {e}")

    ssh.close()
    print("Deployment completed successfully.")

if __name__ == '__main__':
    deploy()
