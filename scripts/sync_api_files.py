import paramiko
import os
import sys

VPS_HOST = '213.136.76.153'
VPS_USER = 'root'
VPS_PASS = 'qLAPgtTM2R5d'
LOCAL_BASE = r'c:\client\reachout-automation2.0'
REMOTE_BASE = '/opt/velurix-backend'

files_to_sync = [
    ('apps/api/src/services/spintax_service.rs', '/opt/velurix-backend/apps/api/src/services/spintax_service.rs'),
    ('apps/api/src/services/campaign_worker.rs', '/opt/velurix-backend/apps/api/src/services/campaign_worker.rs'),
    ('apps/api/src/services/message_service.rs', '/opt/velurix-backend/apps/api/src/services/message_service.rs'),
    ('apps/api/src/m2_unit_tests.rs', '/opt/velurix-backend/apps/api/src/m2_unit_tests.rs'),
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
sftp = ssh.open_sftp()

for local_rel, remote_path in files_to_sync:
    local_path = os.path.join(LOCAL_BASE, local_rel.replace('/', os.sep))
    print(f"Uploading {local_rel} -> {remote_path}...", flush=True)
    sftp.put(local_path, remote_path)
    print("  Done.", flush=True)

sftp.close()
ssh.close()
print("All updated files successfully synced to VPS.", flush=True)
