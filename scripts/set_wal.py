import paramiko

VPS_HOST = '213.136.76.153'
VPS_USER = 'root'
VPS_PASS = 'qLAPgtTM2R5d'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=30)

cmd = '''python3 -c "
import sqlite3
con = sqlite3.connect('/var/lib/docker/volumes/velurix-backend_velurix-backend-data/_data/velurix.db')
print('Before:', con.execute('PRAGMA journal_mode;').fetchall())
con.execute('PRAGMA journal_mode = WAL;')
con.execute('PRAGMA synchronous = NORMAL;')
print('After:', con.execute('PRAGMA journal_mode;').fetchall())
con.close()
"'''

stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:", stdout.read().decode('utf-8'))
print("STDERR:", stderr.read().decode('utf-8'))
ssh.close()
